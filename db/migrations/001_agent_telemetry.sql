BEGIN;

CREATE TABLE IF NOT EXISTS agent_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tool_name TEXT NOT NULL,
  input_args JSONB NOT NULL,
  result_count INT,
  top_product_ids TEXT[] DEFAULT '{}',
  request_id TEXT,
  session_id TEXT,
  host_hint TEXT NOT NULL DEFAULT 'unknown',
  origin_host TEXT,
  latency_ms INT,
  is_error BOOLEAN DEFAULT false,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_calls_created_at ON agent_calls (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_calls_tool_time ON agent_calls (tool_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_calls_host_time ON agent_calls (host_hint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_calls_top_ids ON agent_calls USING GIN (top_product_ids);

CREATE TABLE IF NOT EXISTS agent_call_bookings (
  agent_call_id UUID NOT NULL REFERENCES agent_calls(id) ON DELETE CASCADE,
  booking_id TEXT NOT NULL,
  booked_at TIMESTAMPTZ NOT NULL,
  gross_amount NUMERIC(10,2),
  currency CHAR(3),
  supplier TEXT,
  product_slug TEXT,
  PRIMARY KEY (agent_call_id, booking_id)
);

CREATE INDEX IF NOT EXISTS idx_acb_booked_at ON agent_call_bookings (booked_at DESC);
CREATE INDEX IF NOT EXISTS idx_acb_supplier ON agent_call_bookings (supplier, booked_at DESC);

COMMIT;
