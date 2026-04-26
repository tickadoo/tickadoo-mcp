import { ExperienceCard } from './CardBase';
import type { ProductCard } from '../lib/schema-types';

export function CardGrid({ cards, onSelect }: { cards: ProductCard[]; onSelect: (id: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2">
      {cards.map((card) => (
        <ExperienceCard key={card.id} card={card} renderType="grid" onSelect={onSelect} />
      ))}
    </div>
  );
}
