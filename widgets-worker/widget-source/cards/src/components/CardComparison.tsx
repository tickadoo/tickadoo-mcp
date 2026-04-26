import { ExperienceCard } from './CardBase';
import type { ProductCard } from '../lib/schema-types';

export function CardComparison({ cards, onSelect }: { cards: ProductCard[]; onSelect: (id: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2">
      {cards.slice(0, 5).map((card) => (
        <ExperienceCard key={card.id} card={card} renderType="comparison" onSelect={onSelect} />
      ))}
    </div>
  );
}
