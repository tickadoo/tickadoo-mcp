import type { TrustBadge as TrustBadgeType } from '../lib/schema-types';

const LABELS: Record<TrustBadgeType, { icon: string; label: string }> = {
  'verified-supplier': { icon: 'OK', label: 'Verified' },
  'instant-confirmation': { icon: 'IN', label: 'Instant' },
  'free-cancellation': { icon: 'FC', label: 'Free cancel' },
  'skip-the-line': { icon: 'SL', label: 'Skip line' },
  'mobile-ticket': { icon: 'MT', label: 'Mobile' },
};

export function TrustBadge({ badge }: { badge: TrustBadgeType }) {
  const config = LABELS[badge];
  if (!config) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-900">
      <span aria-hidden="true">{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
