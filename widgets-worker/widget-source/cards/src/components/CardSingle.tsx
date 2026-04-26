import { ExperienceCard } from './CardBase';
import type { ProductCard } from '../lib/schema-types';

export function CardSingle({ cards, onSelect }: { cards: ProductCard[]; onSelect: (id: string) => void }) {
  const [card] = cards;
  if (!card) return null;
  return (
    <div className="mx-auto max-w-xl">
      <ExperienceCard card={card} renderType="single" onSelect={onSelect} />
    </div>
  );
}
