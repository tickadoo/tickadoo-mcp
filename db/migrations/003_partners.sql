BEGIN;

ALTER TABLE partners
  ADD COLUMN IF NOT EXISTS domain TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

UPDATE partners SET is_active = true WHERE is_active IS NULL;
UPDATE partners SET revenue_share_percent = 10 WHERE revenue_share_percent IS NULL;
UPDATE partners SET category = 'other' WHERE category IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_partners_code ON partners (code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_partners_domain ON partners (domain) WHERE coalesce(is_active, true) = true;

CREATE TABLE IF NOT EXISTS partner_views (
  id BIGSERIAL PRIMARY KEY,
  partner_id TEXT NOT NULL,
  widget_type TEXT NOT NULL CHECK (widget_type IN ('card','map','trio')),
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  referer TEXT,
  ip_hash TEXT,
  city_slug TEXT,
  product_slug TEXT,
  result_count INT
);
CREATE INDEX IF NOT EXISTS idx_partner_views_partner_time ON partner_views (partner_id, viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_partner_views_widget ON partner_views (widget_type, viewed_at DESC);

ALTER TABLE partner_commissions
  ADD COLUMN IF NOT EXISTS booking_id TEXT,
  ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS currency CHAR(3),
  ADD COLUMN IF NOT EXISTS booked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_out BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_out_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_out_ref TEXT;

UPDATE partner_commissions
SET gross_amount = order_amount
WHERE gross_amount IS NULL AND order_amount IS NOT NULL;

UPDATE partner_commissions
SET commission_amount = partner_share
WHERE commission_amount IS NULL AND partner_share IS NOT NULL;

UPDATE partner_commissions
SET currency = left(currency_code, 3)
WHERE currency IS NULL AND currency_code IS NOT NULL;

UPDATE partner_commissions
SET booked_at = created_at
WHERE booked_at IS NULL AND created_at IS NOT NULL;

UPDATE partner_commissions
SET paid_out = (paid_at IS NOT NULL)
WHERE paid_at IS NOT NULL;

UPDATE partner_commissions
SET paid_out_at = paid_at
WHERE paid_out_at IS NULL AND paid_at IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_commissions_booking_key
  ON partner_commissions (partner_id, booking_id)
  WHERE booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_commissions_unpaid
  ON partner_commissions (partner_id)
  WHERE paid_out = false;

-- Seed a test partner for end-to-end validation
INSERT INTO partners (
  id,
  name,
  code,
  domain,
  category,
  contact_email,
  is_active,
  revenue_share_percent,
  created_at,
  updated_at
)
SELECT
  '11111111-1111-4111-8111-111111111111'::uuid,
  'tickadoo internal demo',
  'test_demo',
  'tickadoo.com',
  'other',
  'francis@tickadoo.com',
  true,
  10,
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM partners WHERE code = 'test_demo'
);

COMMIT;
