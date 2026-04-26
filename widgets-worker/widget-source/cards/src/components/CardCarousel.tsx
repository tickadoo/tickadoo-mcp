import { ExperienceCard } from './CardBase';
import type { ProductCard } from '../lib/schema-types';

export function CardCarousel({ cards, onSelect }: { cards: ProductCard[]; onSelect: (id: string) => void }) {
  return (
    <div className="flex snap-x gap-3 overflow-x-auto pb-2">
      {cards.map((card) => (
        <div key={card.id} className="w-[66%] min-w-[238px] max-w-[260px] snap-start sm:w-[23%] sm:min-w-[148px]">
          <ExperienceCard card={card} renderType="carousel" onSelect={onSelect} compact />
        </div>
      ))}
    </div>
  );
}
