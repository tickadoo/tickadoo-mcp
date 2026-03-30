import { productStructuredData } from "./shared/format.js";
import type { Product, StructuredDataDatePrice, StructuredDataResponse } from "./shared/types.js";

export const DEFAULT_LAST_MINUTE_HOURS = 3;
export const MAX_LAST_MINUTE_HOURS = 12;
const MAX_LAST_MINUTE_RESULTS = 12;

export type LastMinuteCandidate = {
  product: Product;
  details: StructuredDataResponse;
  bookingPath: string;
  language: string;
  popular?: boolean;
};

export type LastMinuteEntry = {
  tickadooProductId: string;
  slug: string;
  title: string;
  description: string | null;
  bookingUrl: string;
  imageUrl?: string;
  priceAmount: number | null;
  priceCurrency: string | null;
  rating: number | null;
  reviewCount: number | null;
  popular: boolean;
  tags: string[];
  audience: string[];
  indoorOutdoor: "Indoor" | "Outdoor" | "Mixed" | null;
  physicalLevel: "Easy" | "Moderate" | "Demanding" | null;
  cancellation: string | null;
  address: string | null;
  startDate: string;
  startTime: string;
  startDateTime: string;
  startsInMinutes: number;
  countdownText: string;
  urgencyBadges: string[];
  highUrgency: boolean;
  ticketsRemaining: number | null;
  inventoryLevel: number | null;
  availabilityStatus: string | null;
};

export type LastMinuteResult = {
  city: string;
  citySlug: string;
  hours: number;
  generatedAt: string;
  total: number;
  showing: number;
  results: LastMinuteEntry[];
};

type BuildLastMinuteOptions = {
  city: string;
  citySlug: string;
  hours?: number;
  now?: Date;
};

function formatHoursLabel(hours: number): string {
  const normalized = Number.isInteger(hours)
    ? String(hours)
    : hours.toFixed(1).replace(/\.0$/, "");
  return `${normalized} hour${hours === 1 ? "" : "s"}`;
}

function formatReviewCount(reviewCount: number | null): string | null {
  if (typeof reviewCount !== "number" || reviewCount <= 0) {
    return null;
  }

  return `${reviewCount.toLocaleString()} review${reviewCount === 1 ? "" : "s"}`;
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

  const match = trimmed.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!match) {
    return null;
  }

  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function extractTicketsRemaining(slot: StructuredDataDatePrice): number | null {
  const candidates = [
    slot.ticketsRemaining,
    slot.tickets_remaining,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }

  return null;
}

function extractInventoryLevel(slot: StructuredDataDatePrice): number | null {
  const candidates = [
    slot.inventoryLevel,
    slot.inventory_level,
    slot.ticketsRemaining,
    slot.tickets_remaining,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }

  return null;
}

function extractAvailabilityStatus(slot: StructuredDataDatePrice): string | null {
  return slot.availabilityStatus ?? slot.availability_status ?? "InStock";
}

function isAvailableSlot(slot: StructuredDataDatePrice): boolean {
  const ticketsRemaining = extractTicketsRemaining(slot);
  if (ticketsRemaining === 0) {
    return false;
  }

  const availabilityStatus = extractAvailabilityStatus(slot)?.trim().toLowerCase();
  if (!availabilityStatus) {
    return true;
  }

  return !["soldout", "sold_out", "unavailable", "inactive", "closed"].includes(availabilityStatus);
}

function buildSlotDateTime(slot: StructuredDataDatePrice, startTime: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slot.date)) {
    return null;
  }

  const date = new Date(`${slot.date}T${startTime}:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildCountdownText(startsInMinutes: number): string {
  if (startsInMinutes <= 1) {
    return "starts in 1 minute";
  }

  if (startsInMinutes < 60) {
    return `starts in ${startsInMinutes} minutes`;
  }

  const hours = Math.floor(startsInMinutes / 60);
  const minutes = startsInMinutes % 60;
  if (!minutes) {
    return `starts in ${hours} hour${hours === 1 ? "" : "s"}`;
  }

  return `starts in ${hours} hour${hours === 1 ? "" : "s"} ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

function buildUrgencySignals(slot: StructuredDataDatePrice, startsInMinutes: number): { urgencyBadges: string[]; highUrgency: boolean } {
  const urgencyBadges: string[] = [];

  if (startsInMinutes <= 30) {
    urgencyBadges.push("Starting very soon");
  } else if (startsInMinutes <= 60) {
    urgencyBadges.push("Starting soon");
  }

  const ticketsRemaining = extractTicketsRemaining(slot);
  if (ticketsRemaining != null && ticketsRemaining > 0 && ticketsRemaining <= 5) {
    urgencyBadges.push(`Only ${ticketsRemaining} left`);
  } else {
    const inventoryLevel = extractInventoryLevel(slot);
    if (inventoryLevel != null && inventoryLevel > 0 && inventoryLevel <= 2) {
      urgencyBadges.push("Almost sold out");
    } else if (inventoryLevel != null && inventoryLevel > 0 && inventoryLevel <= 5) {
      urgencyBadges.push("Low inventory");
    }
  }

  return {
    urgencyBadges,
    highUrgency: urgencyBadges.length > 0,
  };
}

function compareEntries(left: LastMinuteEntry, right: LastMinuteEntry): number {
  const minuteDelta = left.startsInMinutes - right.startsInMinutes;
  if (minuteDelta !== 0) {
    return minuteDelta;
  }

  const urgencyDelta = Number(right.highUrgency) - Number(left.highUrgency);
  if (urgencyDelta !== 0) {
    return urgencyDelta;
  }

  const ratingDelta = (right.rating ?? -1) - (left.rating ?? -1);
  if (ratingDelta !== 0) {
    return ratingDelta;
  }

  const reviewDelta = (right.reviewCount ?? -1) - (left.reviewCount ?? -1);
  if (reviewDelta !== 0) {
    return reviewDelta;
  }

  const priceDelta = (left.priceAmount ?? Number.POSITIVE_INFINITY) - (right.priceAmount ?? Number.POSITIVE_INFINITY);
  if (priceDelta !== 0) {
    return priceDelta;
  }

  return left.title.localeCompare(right.title);
}

function createEntry(
  candidate: LastMinuteCandidate,
  slot: StructuredDataDatePrice,
  slotDateTime: Date,
  startsInMinutes: number,
): LastMinuteEntry {
  const structured = productStructuredData(
    {
      ...candidate.product,
      popular: Boolean(candidate.popular),
    },
    candidate.bookingPath,
    candidate.language,
  );
  const startTime = normalizeStartTime(slot) ?? "00:00";
  const { urgencyBadges, highUrgency } = buildUrgencySignals(slot, startsInMinutes);

  return {
    tickadooProductId: candidate.product.id,
    slug: candidate.product.slug,
    title: structured.title,
    description: structured.description ?? null,
    bookingUrl: structured.bookingUrl,
    imageUrl: structured.imageUrl,
    priceAmount: slot.minPrice ?? structured.priceAmount ?? null,
    priceCurrency: candidate.details.currencyCode ?? structured.priceCurrency ?? null,
    rating: candidate.details.mcpProduct?.reviewRating ?? candidate.product.averageRating ?? null,
    reviewCount: candidate.details.mcpProduct?.reviewCount ?? candidate.product.mcpProduct?.reviewCount ?? null,
    popular: Boolean(candidate.popular),
    tags: candidate.details.mcpProduct?.tags ?? candidate.product.mcpProduct?.tags ?? [],
    audience: candidate.details.mcpProduct?.audience ?? candidate.product.mcpProduct?.audience ?? [],
    indoorOutdoor: candidate.details.mcpProduct?.indoorOutdoor ?? candidate.product.mcpProduct?.indoorOutdoor ?? null,
    physicalLevel: candidate.details.mcpProduct?.physicalLevel ?? candidate.product.mcpProduct?.physicalLevel ?? null,
    cancellation: structured.cancellation ?? null,
    address: candidate.details.address ?? candidate.product.address ?? null,
    startDate: slot.date,
    startTime,
    startDateTime: slotDateTime.toISOString(),
    startsInMinutes,
    countdownText: buildCountdownText(startsInMinutes),
    urgencyBadges,
    highUrgency,
    ticketsRemaining: extractTicketsRemaining(slot),
    inventoryLevel: extractInventoryLevel(slot),
    availabilityStatus: extractAvailabilityStatus(slot),
  };
}

export function buildLastMinuteResult(
  candidates: LastMinuteCandidate[],
  options: BuildLastMinuteOptions,
): LastMinuteResult {
  const now = options.now ?? new Date();
  const hours = options.hours ?? DEFAULT_LAST_MINUTE_HOURS;
  const maxWindowMs = hours * 60 * 60_000;

  const allEntries = candidates.flatMap(candidate => {
    let bestEntry: LastMinuteEntry | undefined;

    for (const slot of candidate.details.dates) {
      if (!isAvailableSlot(slot)) {
        continue;
      }

      const startTime = normalizeStartTime(slot);
      if (!startTime) {
        continue;
      }

      const slotDateTime = buildSlotDateTime(slot, startTime);
      if (!slotDateTime) {
        continue;
      }

      const deltaMs = slotDateTime.getTime() - now.getTime();
      if (deltaMs < 0 || deltaMs > maxWindowMs) {
        continue;
      }

      const startsInMinutes = Math.max(1, Math.ceil(deltaMs / 60_000));
      const entry = createEntry(candidate, slot, slotDateTime, startsInMinutes);

      if (!bestEntry || compareEntries(entry, bestEntry) < 0) {
        bestEntry = entry;
      }
    }

    return bestEntry ? [bestEntry] : [];
  }).sort(compareEntries);

  const shownEntries = allEntries.slice(0, MAX_LAST_MINUTE_RESULTS);

  return {
    city: options.city,
    citySlug: options.citySlug,
    hours,
    generatedAt: now.toISOString(),
    total: allEntries.length,
    showing: shownEntries.length,
    results: shownEntries,
  };
}

export function formatLastMinuteText(payload: LastMinuteResult): string {
  if (!payload.results.length) {
    return `No bookable experiences found in ${payload.city} starting within the next ${formatHoursLabel(payload.hours)}.`;
  }

  const header = payload.total > payload.showing
    ? `Last-minute experiences in ${payload.city} for the next ${formatHoursLabel(payload.hours)} (showing ${payload.showing} of ${payload.total}):`
    : `Last-minute experiences in ${payload.city} for the next ${formatHoursLabel(payload.hours)}:`;

  const lines = payload.results.map(entry => {
    const reviewCount = formatReviewCount(entry.reviewCount);
    const itemLines = [`🎭 ${entry.title}`];

    if (entry.description) {
      itemLines.push(`   ${entry.description}`);
    }

    itemLines.push(`   ⏰ ${entry.countdownText} (${entry.startTime})`);

    if (entry.urgencyBadges.length) {
      itemLines.push(`   🚨 ${entry.urgencyBadges.join(" · ")}`);
    }

    if (entry.priceAmount != null) {
      const priceText = Number.isInteger(entry.priceAmount)
        ? String(entry.priceAmount)
        : entry.priceAmount.toFixed(2);
      itemLines.push(`   💰 From ${entry.priceCurrency ?? ""} ${priceText}`.trimEnd());
    }

    if (entry.rating != null && entry.rating > 0) {
      const ratingLine = reviewCount
        ? `   ⭐ ${entry.rating.toFixed(1)}/5 (${reviewCount})`
        : `   ⭐ ${entry.rating.toFixed(1)}/5`;
      itemLines.push(ratingLine);
    } else if (reviewCount) {
      itemLines.push(`   🗳️ ${reviewCount}`);
    }

    if (entry.address) {
      itemLines.push(`   📍 ${entry.address}`);
    }

    itemLines.push(`   🔗 ${entry.bookingUrl}`);
    return itemLines.join("\n");
  });

  return `${header}\n\n${lines.join("\n\n")}`;
}
