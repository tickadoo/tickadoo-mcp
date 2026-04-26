import { AccessibilityChip } from './AccessibilityChip';
import { TrustBadge } from './TrustBadge';
import type { ProductCard, RenderType } from '../lib/schema-types';

const PLACEHOLDER = 'https://tickadoo.com/brand/apps-directory-icon.svg';

function pickImage(card: ProductCard, renderType: RenderType): string {
  const ratio = renderType === 'single' ? '16:9' : renderType === 'carousel' ? '1:1' : '4:5';
  return card.image_ratios.find((image) => image.ratio === ratio)?.url ?? card.image_ratios[0]?.url ?? PLACEHOLDER;
}

function money(card: ProductCard): string {
  if (card.price_min == null) return 'Check price';
  return `${card.currency} ${card.price_min.toFixed(2)}`;
}

export function ExperienceCard({
  card,
  renderType,
  onSelect,
  compact = false,
}: {
  card: ProductCard;
  renderType: RenderType;
  onSelect: (id: string) => void;
  compact?: boolean;
}) {
  const image = pickImage(card, renderType);
  return (
    <article className="overflow-hidden rounded-lg border border-[#dce4dd] bg-white shadow-sm">
      <button
        type="button"
        className="block h-full w-full text-left focus:outline-none focus:ring-2 focus:ring-[#0f7b5c]"
        onClick={() => onSelect(card.id)}
        aria-label={`Check availability for ${card.name}`}
      >
        <img
          src={image}
          srcSet={`${image} 1x, ${image} 2x`}
          alt={card.name}
          className={compact ? 'h-28 w-full object-cover' : 'h-36 w-full object-cover'}
          loading="lazy"
        />
        <div className="space-y-2 p-3">
          <div>
            <h2 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-[#172018]">{card.name}</h2>
            <p className="mt-1 truncate text-xs text-[#667568]">{card.place.name}</p>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-[#0f5f49]">From {money(card)}</span>
            {card.rating != null ? (
              <span className="text-[#4d594f]">{card.rating.toFixed(1)} ({card.review_count})</span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1">
            {card.trust_badges.slice(0, compact ? 2 : 3).map((badge) => (
              <TrustBadge key={badge} badge={badge} />
            ))}
            {card.accessibility.slice(0, compact ? 1 : 2).map((flag) => (
              <AccessibilityChip key={flag} flag={flag} />
            ))}
          </div>
        </div>
      </button>
    </article>
  );
}
