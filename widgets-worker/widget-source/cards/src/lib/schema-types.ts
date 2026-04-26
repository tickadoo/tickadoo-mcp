export type RenderType = 'carousel' | 'grid' | 'comparison' | 'single';

export type ExperienceCardsInput = {
  experience_ids: string[];
  render_type: RenderType;
  render_context: {
    intent_summary: string;
    date_hint?: string;
    audience_hint?: string;
    sort_basis?: 'popularity' | 'price_asc' | 'rating_desc';
  };
  idempotency_key?: string;
};

export type TrustBadge =
  | 'verified-supplier'
  | 'instant-confirmation'
  | 'free-cancellation'
  | 'skip-the-line'
  | 'mobile-ticket';

export type AccessibilityFlag =
  | 'wheelchair-accessible'
  | 'stroller-friendly'
  | 'audio-described'
  | 'sign-language'
  | 'relaxed-performance';

export type ProductCard = {
  id: string;
  name: string;
  slug: string;
  image_ratios: { ratio: '1:1' | '16:9' | '4:5'; url: string }[];
  price_min: number | null;
  price_max: number | null;
  currency: string;
  rating: number | null;
  review_count: number;
  place: { id: string; name: string; lat: number | null; lng: number | null };
  trust_badges: TrustBadge[];
  accessibility: AccessibilityFlag[];
  inventoryLevel: {
    type: 'QuantitativeValue';
    value: number;
    unitCode: 'C62';
    minValue: 0;
    maxValue: number;
  };
};

export type ProductCardMap = Record<string, Omit<ProductCard, 'id'>>;

export type AvailabilityResult = {
  product_id?: string;
  slug?: string;
  slots?: Array<{
    date: string;
    time: string;
    datetime: string;
    price?: { amount?: number; amount_minor?: number; currency_code?: string; currency?: string };
    spaces_remaining?: number | null;
    sold_out?: boolean;
    booking_url?: string;
  }>;
  next_available?: string | null;
  availability_verified_at?: string;
  provenance_level?: string;
  book_now_confidence?: number;
  message?: string;
};
