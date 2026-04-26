import { useEffect, useMemo, useState } from 'react';
import { CardCarousel } from './components/CardCarousel';
import { CardComparison } from './components/CardComparison';
import { CardEmpty } from './components/CardEmpty';
import { CardGrid } from './components/CardGrid';
import { CardSingle } from './components/CardSingle';
import { AvailabilityDetail } from './components/AvailabilityDetail';
import { callTool, getMeta, getToolInput } from './lib/openai-bridge';
import type { AvailabilityResult, ExperienceCardsInput, ProductCard, ProductCardMap } from './lib/schema-types';

const DEFAULT_INPUT: ExperienceCardsInput = {
  experience_ids: [],
  render_type: 'carousel',
  render_context: { intent_summary: 'matching experiences' },
};

function toCards(input: ExperienceCardsInput, productMap: ProductCardMap | null): ProductCard[] {
  if (!productMap) return [];
  return input.experience_ids
    .map((id) => {
      const card = productMap[id];
      return card ? { id, ...card } : null;
    })
    .filter((card): card is ProductCard => Boolean(card));
}

async function fetchProductMap(ids: string[]): Promise<ProductCardMap> {
  if (!ids.length) return {};
  const response = await fetch(`/api/widget/cards?ids=${encodeURIComponent(ids.join(','))}`, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) return {};
  const payload = (await response.json()) as { _product_map?: ProductCardMap };
  return payload._product_map ?? {};
}

export default function App() {
  const [input] = useState<ExperienceCardsInput>(() => getToolInput<ExperienceCardsInput>() ?? DEFAULT_INPUT);
  const [productMap, setProductMap] = useState<ProductCardMap | null>(() => getMeta<ProductCardMap>('_product_map'));
  const [availability, setAvailability] = useState<{ product?: ProductCard; result: AvailabilityResult } | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (productMap && Object.keys(productMap).length > 0) return;
    fetchProductMap(input.experience_ids).then(setProductMap).catch(() => setProductMap({}));
  }, [input.experience_ids, productMap]);

  const cards = useMemo(() => toCards(input, productMap), [input, productMap]);

  async function handleCardClick(experienceId: string) {
    const product = cards.find((card) => card.id === experienceId);
    setLoadingId(experienceId);
    try {
      const result = await callTool<AvailabilityResult>('get_availability', {
        product_id: experienceId,
        idempotency_key: crypto.randomUUID(),
        fresh: false,
      });
      setAvailability({ product, result });
    } finally {
      setLoadingId(null);
    }
  }

  if (availability) {
    return <AvailabilityDetail product={availability.product} result={availability.result} onBack={() => setAvailability(null)} />;
  }

  if (!input.experience_ids.length || (productMap && cards.length === 0)) {
    return <CardEmpty intentSummary={input.render_context.intent_summary} />;
  }

  return (
    <main className="min-h-full bg-[#f8faf8] p-4">
      <header className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-[#172018]">{input.render_context.intent_summary}</h1>
          <p className="mt-1 text-xs text-[#667568]">
            {[input.render_context.date_hint, input.render_context.audience_hint].filter(Boolean).join(' · ')}
          </p>
        </div>
        {loadingId ? <span className="text-xs font-medium text-[#0f5f49]">Checking...</span> : null}
      </header>
      {input.render_type === 'grid' ? <CardGrid cards={cards} onSelect={handleCardClick} /> : null}
      {input.render_type === 'comparison' ? <CardComparison cards={cards} onSelect={handleCardClick} /> : null}
      {input.render_type === 'single' ? <CardSingle cards={cards} onSelect={handleCardClick} /> : null}
      {input.render_type === 'carousel' ? <CardCarousel cards={cards} onSelect={handleCardClick} /> : null}
    </main>
  );
}
