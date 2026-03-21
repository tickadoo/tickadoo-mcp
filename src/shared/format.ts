import { DETAIL_DATE_PREVIEW_LIMIT } from "./config.js";
import { buildBookingUrl } from "./api.js";
import type { Product, StructuredDataDatePrice, StructuredDataResponse } from "./types.js";

export function productStructuredData(product: Product, bookingPath = product.slug) {
  return {
    tickadooProductId: product.id,
    slug: product.slug,
    title: product.title,
    bookingUrl: buildBookingUrl(bookingPath),
    imageUrl: product.desktopFeatureImageUrl ?? product.verticalImageUrl ?? undefined,
  };
}

export function formatProduct(product: Product, bookingPath = product.slug): string {
  const lines = [`🎭 ${product.title}`];
  if (product.description) lines.push(`   ${product.description}`);
  if (product.minPrice != null) lines.push(`   💰 From ${product.currency} ${product.minPrice.toFixed(2)}`);
  if (product.averageRating != null && product.averageRating > 0) lines.push(`   ⭐ ${product.averageRating.toFixed(1)}/5`);
  if (product.address) lines.push(`   📍 ${product.address}`);
  if (product.desktopFeatureImageUrl || product.verticalImageUrl) {
    lines.push(`   🖼️ ${product.desktopFeatureImageUrl || product.verticalImageUrl}`);
  }
  lines.push(`   🔗 ${buildBookingUrl(bookingPath)}`);
  return lines.join("\n");
}

export function formatAvailabilitySummary(
  dates: StructuredDataDatePrice[],
  currencyCode: string,
): string[] {
  const groupedByDate = new Map<string, StructuredDataDatePrice[]>();
  for (const item of dates) {
    const existing = groupedByDate.get(item.date) ?? [];
    existing.push(item);
    groupedByDate.set(item.date, existing);
  }

  const groupedDates = [...groupedByDate.entries()].sort(([a], [b]) => a.localeCompare(b));
  const shownDates = groupedDates.slice(0, DETAIL_DATE_PREVIEW_LIMIT);
  const lines: string[] = [];

  for (const [date, items] of shownDates) {
    lines.push(`📅 ${date}`);
    for (const item of [...items].sort((a, b) => a.minPrice - b.minPrice || a.variantName.localeCompare(b.variantName))) {
      const endDate = item.endDate !== item.date ? ` (ends ${item.endDate})` : "";
      lines.push(`   - ${item.variantName}${endDate}: ${currencyCode} ${item.minPrice.toFixed(2)}`);
    }
  }

  if (groupedDates.length > shownDates.length) {
    lines.push(`... ${groupedDates.length - shownDates.length} more dates not shown.`);
  }

  return lines;
}

export function formatExperienceDetails(days: number, details: StructuredDataResponse): string {
  const uniqueDates = new Set(details.dates.map(item => item.date)).size;
  const lines = [
    "🎟️ Experience details",
    "   🧾 Source: tickadoo",
    `   💱 Currency: ${details.currencyCode}`,
  ];

  if (details.address) lines.push(`   📍 ${details.address}`);
  if (details.locationWithAddress.latitude != null && details.locationWithAddress.longitude != null) {
    lines.push(`   🧭 ${details.locationWithAddress.latitude.toFixed(6)}, ${details.locationWithAddress.longitude.toFixed(6)}`);
  }
  lines.push(`   🖼️ Desktop image: ${details.desktopFeatureImageUrl}`);
  lines.push(`   📱 Mobile image: ${details.mobileFeatureImageUrl}`);

  if (!details.dates.length) {
    lines.push("", `No availability returned for the next ${days} days.`);
  } else {
    lines.push(
      "",
      `Availability: ${details.dates.length} price points across ${uniqueDates} dates in the next ${days} days.`,
      ...formatAvailabilitySummary(details.dates, details.currencyCode),
    );
  }

  return lines.join("\n");
}
