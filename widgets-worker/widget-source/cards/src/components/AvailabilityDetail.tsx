import type { AvailabilityResult, ProductCard } from '../lib/schema-types';

function formatSlotPrice(slot: NonNullable<AvailabilityResult['slots']>[number]): string {
  const price = slot.price;
  if (!price) return 'Check price';
  const amount = price.amount ?? (price.amount_minor != null ? price.amount_minor / 100 : null);
  const currency = price.currency_code ?? price.currency ?? 'GBP';
  return amount == null ? 'Check price' : `${currency} ${amount.toFixed(2)}`;
}

export function AvailabilityDetail({
  product,
  result,
  onBack,
}: {
  product?: ProductCard;
  result: AvailabilityResult;
  onBack: () => void;
}) {
  const slots = result.slots ?? [];
  return (
    <main className="min-h-full bg-[#f8faf8] p-4">
      <button className="mb-3 rounded border border-[#cbd8cd] bg-white px-3 py-1.5 text-sm text-[#203326]" type="button" onClick={onBack}>
        Back
      </button>
      <section className="rounded-lg border border-[#dce4dd] bg-white p-4">
        <h1 className="text-lg font-semibold text-[#172018]">{product?.name ?? result.slug ?? 'Availability'}</h1>
        <p className="mt-1 text-xs text-[#667568]">
          {result.availability_verified_at ? `Freshness: ${new Date(result.availability_verified_at).toLocaleString()}` : 'Freshness: checking live data'}
        </p>
        {result.message ? <p className="mt-3 text-sm text-[#5f4a1f]">{result.message}</p> : null}
        <div className="mt-4 grid gap-2">
          {slots.slice(0, 8).map((slot) => (
            <a
              key={`${slot.datetime}-${slot.booking_url}`}
              className="grid grid-cols-[1fr_auto] gap-3 rounded border border-[#e0e7e1] p-3 text-sm text-[#172018]"
              href={slot.booking_url}
              target="_blank"
              rel="noreferrer"
            >
              <span>
                <span className="font-medium">{slot.date}</span>
                <span className="ml-2">{slot.time}</span>
                {slot.spaces_remaining != null ? <span className="ml-2 text-[#667568]">{slot.spaces_remaining} left</span> : null}
              </span>
              <span className="font-semibold text-[#0f5f49]">{formatSlotPrice(slot)}</span>
            </a>
          ))}
          {slots.length === 0 ? <p className="text-sm text-[#667568]">No live slots returned for this experience yet.</p> : null}
        </div>
      </section>
    </main>
  );
}
