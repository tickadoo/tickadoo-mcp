import { productStructuredData } from "./shared/format.js";
import type { Product, StructuredDataDatePrice, StructuredDataResponse } from "./shared/types.js";

export const WHATS_ON_THIS_WEEK_DAY_COUNT = 7;
const MAX_ENTRIES_PER_SLOT = 5;

export type WhatsOnThisWeekDayPart = "morning" | "afternoon" | "evening";

export type WhatsOnThisWeekEntry = {
  slug: string;
  title: string;
  bookingUrl: string;
  startTime: string | null;
  priceAmount: number | null;
  priceCurrency: string | null;
  rating: number | null;
  reviewCount: number | null;
  popular: boolean;
  tags: string[];
  audience: string[];
  imageUrl?: string;
};

export type WhatsOnThisWeekDay = {
  date: string;
  dayName: string;
  morning: WhatsOnThisWeekEntry[];
  afternoon: WhatsOnThisWeekEntry[];
  evening: WhatsOnThisWeekEntry[];
};

export type WhatsOnThisWeekResult = {
  city: string;
  citySlug: string;
  startDate: string;
  endDate: string;
  week: WhatsOnThisWeekDay[];
  highlights: string;
};

export type WhatsOnThisWeekCandidate = {
  product: Product;
  details: StructuredDataResponse;
  bookingPath: string;
  language: string;
  popular?: boolean;
};

type BuildWhatsOnThisWeekOptions = {
  city: string;
  citySlug: string;
  startDate: string;
  dayCount?: number;
};

type IndexedDay = WhatsOnThisWeekDay & {
  slots: Record<WhatsOnThisWeekDayPart, Map<string, WhatsOnThisWeekEntry>>;
};

function addDays(dateOnly: string, days: number): string {
  const date = new Date(`${dateOnly}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayNameFor(dateOnly: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(`${dateOnly}T00:00:00Z`));
}

export function createWhatsOnThisWeekWindow(
  referenceDate = new Date(),
  dayCount = WHATS_ON_THIS_WEEK_DAY_COUNT,
): { startDate: string; endDate: string; dayCount: number } {
  const start = new Date(Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate(),
  ));
  const startDate = start.toISOString().slice(0, 10);
  return {
    startDate,
    endDate: addDays(startDate, Math.max(dayCount - 1, 0)),
    dayCount,
  };
}

function buildEmptyIndexedWeek(startDate: string, dayCount: number): IndexedDay[] {
  return Array.from({ length: dayCount }, (_, index) => {
    const date = addDays(startDate, index);
    return {
      date,
      dayName: dayNameFor(date),
      morning: [],
      afternoon: [],
      evening: [],
      slots: {
        morning: new Map(),
        afternoon: new Map(),
        evening: new Map(),
      },
    };
  });
}

function normalizeStartTime(slot: StructuredDataDatePrice): string | null {
  const raw = slot.startTime ?? slot.start_time ?? slot.time ?? null;
  if (typeof raw !== "string") {
    return null;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/(\d{1,2}):(\d{2})/);
  if (!match) {
    return trimmed;
  }

  const hour = match[1].padStart(2, "0");
  return `${hour}:${match[2]}`;
}

function parseHour(startTime: string | null): number | null {
  if (!startTime) {
    return null;
  }

  const match = startTime.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  return Number.parseInt(match[1], 10);
}

function inferDayPart(product: Product, details: StructuredDataResponse, startTime: string | null): WhatsOnThisWeekDayPart {
  const hour = parseHour(startTime);
  if (hour != null) {
    if (hour < 12) {
      return "morning";
    }
    if (hour < 18) {
      return "afternoon";
    }
    return "evening";
  }

  const tags = [
    ...(product.mcpProduct?.tags ?? []),
    ...(details.mcpProduct?.tags ?? []),
  ].map(tag => tag.toLowerCase());
  const text = `${product.title} ${product.description ?? ""}`.toLowerCase();

  if (tags.includes("morning") || /morning|breakfast|brunch|sunrise/.test(text)) {
    return "morning";
  }

  if (tags.includes("evening") || tags.includes("nightlife") || /evening|night|sunset|dinner|cabaret/.test(text)) {
    return "evening";
  }

  return "afternoon";
}

function isAvailableSlot(slot: StructuredDataDatePrice): boolean {
  const ticketsRemaining = slot.ticketsRemaining ?? slot.tickets_remaining ?? null;
  if (ticketsRemaining === 0) {
    return false;
  }

  const availabilityStatus = (slot.availabilityStatus ?? slot.availability_status ?? "").trim().toLowerCase();
  if (!availabilityStatus) {
    return true;
  }

  return !["soldout", "sold_out", "unavailable", "inactive", "closed"].includes(availabilityStatus);
}

function compareOptionalTimes(left: string | null, right: string | null): number {
  if (left === right) {
    return 0;
  }
  if (!left) {
    return 1;
  }
  if (!right) {
    return -1;
  }
  return left.localeCompare(right);
}

function formatPrice(priceAmount: number | null, currency: string | null): string | null {
  if (priceAmount == null) {
    return null;
  }

  const normalizedPrice = Number.isInteger(priceAmount) ? String(priceAmount) : priceAmount.toFixed(2);
  return currency ? `from ${normalizedPrice} ${currency}` : `from ${normalizedPrice}`;
}

function createEntry(candidate: WhatsOnThisWeekCandidate, slot: StructuredDataDatePrice): WhatsOnThisWeekEntry {
  const structured = productStructuredData(
    {
      ...candidate.product,
      popular: Boolean(candidate.popular),
    },
    candidate.bookingPath,
    candidate.language,
  );
  const startTime = normalizeStartTime(slot);

  return {
    slug: candidate.product.slug,
    title: structured.title,
    bookingUrl: structured.bookingUrl,
    startTime,
    priceAmount: slot.minPrice ?? structured.priceAmount ?? null,
    priceCurrency: candidate.details.currencyCode ?? structured.priceCurrency ?? null,
    rating: candidate.details.mcpProduct?.reviewRating ?? candidate.product.averageRating ?? null,
    reviewCount: candidate.details.mcpProduct?.reviewCount ?? candidate.product.mcpProduct?.reviewCount ?? null,
    popular: Boolean(candidate.popular),
    tags: candidate.details.mcpProduct?.tags ?? candidate.product.mcpProduct?.tags ?? [],
    audience: candidate.details.mcpProduct?.audience ?? candidate.product.mcpProduct?.audience ?? [],
    imageUrl: structured.imageUrl,
  };
}

function shouldReplaceEntry(existing: WhatsOnThisWeekEntry, next: WhatsOnThisWeekEntry): boolean {
  const timeComparison = compareOptionalTimes(existing.startTime, next.startTime);
  if (timeComparison !== 0) {
    return timeComparison > 0;
  }

  const priceComparison = (existing.priceAmount ?? Number.POSITIVE_INFINITY) - (next.priceAmount ?? Number.POSITIVE_INFINITY);
  if (priceComparison !== 0) {
    return priceComparison > 0;
  }

  return (next.rating ?? -1) > (existing.rating ?? -1);
}

function compareEntries(left: WhatsOnThisWeekEntry, right: WhatsOnThisWeekEntry): number {
  const popularDelta = Number(right.popular) - Number(left.popular);
  if (popularDelta !== 0) {
    return popularDelta;
  }

  const ratingDelta = (right.rating ?? -1) - (left.rating ?? -1);
  if (ratingDelta !== 0) {
    return ratingDelta;
  }

  const reviewDelta = (right.reviewCount ?? -1) - (left.reviewCount ?? -1);
  if (reviewDelta !== 0) {
    return reviewDelta;
  }

  const timeComparison = compareOptionalTimes(left.startTime, right.startTime);
  if (timeComparison !== 0) {
    return timeComparison;
  }

  const priceDelta = (left.priceAmount ?? Number.POSITIVE_INFINITY) - (right.priceAmount ?? Number.POSITIVE_INFINITY);
  if (priceDelta !== 0) {
    return priceDelta;
  }

  return left.title.localeCompare(right.title);
}

function buildHighlights(week: WhatsOnThisWeekDay[]): string {
  const daySummaries = week.map(day => ({
    dayName: day.dayName,
    total: day.morning.length + day.afternoon.length + day.evening.length,
  }));
  const busiestDay = [...daySummaries]
    .sort((left, right) => right.total - left.total || left.dayName.localeCompare(right.dayName))[0];
  const dayPartTotals: Array<{ dayPart: WhatsOnThisWeekDayPart; total: number }> = [
    { dayPart: "morning", total: week.reduce((sum, day) => sum + day.morning.length, 0) },
    { dayPart: "afternoon", total: week.reduce((sum, day) => sum + day.afternoon.length, 0) },
    { dayPart: "evening", total: week.reduce((sum, day) => sum + day.evening.length, 0) },
  ];
  const busiestDayPart = [...dayPartTotals]
    .sort((left, right) => right.total - left.total || left.dayPart.localeCompare(right.dayPart))[0];
  const standout = week
    .flatMap(day => [...day.morning, ...day.afternoon, ...day.evening])
    .sort((left, right) => {
      const ratingDelta = (right.rating ?? -1) - (left.rating ?? -1);
      if (ratingDelta !== 0) {
        return ratingDelta;
      }
      const reviewDelta = (right.reviewCount ?? -1) - (left.reviewCount ?? -1);
      if (reviewDelta !== 0) {
        return reviewDelta;
      }
      return left.title.localeCompare(right.title);
    })[0];

  if (!busiestDay || busiestDay.total === 0) {
    return "No scheduled experiences surfaced for this week.";
  }

  const highlightLines = [`${busiestDay.dayName} has the most options this week (${busiestDay.total}).`];
  if (busiestDayPart && busiestDayPart.total > 0) {
    highlightLines.push(`${busiestDayPart.dayPart[0].toUpperCase()}${busiestDayPart.dayPart.slice(1)} is the strongest daypart overall.`);
  }
  if (standout?.rating != null) {
    highlightLines.push(`${standout.title} is the best-rated standout this week.`);
  }

  return highlightLines.join(" ");
}

export function buildWhatsOnThisWeek(
  candidates: WhatsOnThisWeekCandidate[],
  options: BuildWhatsOnThisWeekOptions,
): WhatsOnThisWeekResult {
  const dayCount = options.dayCount ?? WHATS_ON_THIS_WEEK_DAY_COUNT;
  const endDate = addDays(options.startDate, Math.max(dayCount - 1, 0));
  const indexedWeek = buildEmptyIndexedWeek(options.startDate, dayCount);
  const dayByDate = new Map(indexedWeek.map(day => [day.date, day]));

  for (const candidate of candidates) {
    for (const slot of candidate.details.dates) {
      if (!isAvailableSlot(slot)) {
        continue;
      }

      if (slot.date < options.startDate || slot.date > endDate) {
        continue;
      }

      const day = dayByDate.get(slot.date);
      if (!day) {
        continue;
      }

      const entry = createEntry(candidate, slot);
      const dayPart = inferDayPart(candidate.product, candidate.details, entry.startTime);
      const existing = day.slots[dayPart].get(entry.slug);

      if (!existing || shouldReplaceEntry(existing, entry)) {
        day.slots[dayPart].set(entry.slug, entry);
      }
    }
  }

  const week = indexedWeek.map(day => {
    const morning = [...day.slots.morning.values()].sort(compareEntries).slice(0, MAX_ENTRIES_PER_SLOT);
    const afternoon = [...day.slots.afternoon.values()].sort(compareEntries).slice(0, MAX_ENTRIES_PER_SLOT);
    const evening = [...day.slots.evening.values()].sort(compareEntries).slice(0, MAX_ENTRIES_PER_SLOT);

    return {
      date: day.date,
      dayName: day.dayName,
      morning,
      afternoon,
      evening,
    };
  });

  return {
    city: options.city,
    citySlug: options.citySlug,
    startDate: options.startDate,
    endDate,
    week,
    highlights: buildHighlights(week),
  };
}

function formatEntryLine(entry: WhatsOnThisWeekEntry): string {
  const parts = [entry.title];
  if (entry.startTime) {
    parts.push(entry.startTime);
  }

  const price = formatPrice(entry.priceAmount, entry.priceCurrency);
  if (price) {
    parts.push(price);
  }

  if (entry.rating != null) {
    parts.push(`${entry.rating.toFixed(1)}/5`);
  }

  return `- ${parts.join(" | ")}`;
}

function formatDayPartBlock(dayPart: WhatsOnThisWeekDayPart, entries: WhatsOnThisWeekEntry[]): string {
  const label = dayPart[0].toUpperCase() + dayPart.slice(1);
  if (!entries.length) {
    return `${label}\n- No standout experiences surfaced.`;
  }

  return `${label}\n${entries.map(formatEntryLine).join("\n")}`;
}

export function formatWhatsOnThisWeekText(result: WhatsOnThisWeekResult): string {
  const lines = [
    `What's on in ${result.city} this week (${result.startDate} to ${result.endDate})`,
    "",
    `Weekly highlights: ${result.highlights}`,
  ];

  for (const day of result.week) {
    lines.push(
      "",
      `${day.dayName} (${day.date})`,
      formatDayPartBlock("morning", day.morning),
      "",
      formatDayPartBlock("afternoon", day.afternoon),
      "",
      formatDayPartBlock("evening", day.evening),
    );
  }

  return lines.join("\n");
}
