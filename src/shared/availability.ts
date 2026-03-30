import { buildBookingUrl } from "./api.js";
import {
  DEFAULT_LANGUAGE,
  GHOST_CHECKOUT_INTENT_ENDPOINT,
} from "./config.js";
import type { StructuredDataDatePrice, StructuredDataResponse } from "./types.js";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const DEFAULT_PARTY_SIZE = 2;
export const MAX_PARTY_SIZE = 50;
export const MAX_CHECK_AVAILABILITY_WINDOW_DAYS = 180;
export const CHECK_AVAILABILITY_NEXT_STEP_HINT = "💡 Tip: Use get_experience_details(slug) if you need venue, imagery, or a wider availability window.";

export type AvailabilityCheckSlot = {
  time: string | null;
  label: string | null;
  price_per_person: number;
  currency: string;
  tickets_remaining: number | null;
  availability_status: string | null;
};

export type AvailabilityCheckPayload = {
  available: boolean;
  title: string | null;
  slug: string | null;
  date: string;
  slots: AvailabilityCheckSlot[];
  total_for_party: {
    party_size: number;
    cheapest: number | null;
    currency: string;
  };
  booking_url: string | null;
  _intent_token: {
    endpoint: string;
    payload: {
      productSlug: string | null;
      date: string;
      partySize: number;
      language: string;
    };
    hint: string;
  };
};

type AvailabilityCheckOptions = {
  title?: string;
  slug?: string;
  bookingPath?: string;
  language?: string;
};

function parseIsoDate(value: string): Date | null {
  if (!ISO_DATE_PATTERN.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return null;
  }

  return date;
}

function getUtcDayStart(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function formatCurrencyAmount(currency: string, amount: number | null): string {
  if (amount == null) {
    return `${currency} unavailable`;
  }

  return `${currency} ${amount.toFixed(2)}`;
}

function normalizeClockValue(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!match) {
    return null;
  }

  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function extractSlotTime(slot: StructuredDataDatePrice): string | null {
  return normalizeClockValue(slot.time)
    ?? normalizeClockValue(slot.startTime)
    ?? normalizeClockValue(slot.start_time)
    ?? normalizeClockValue(slot.variantName);
}

function extractSlotInventory(slot: StructuredDataDatePrice): number | null {
  const candidates = [
    slot.ticketsRemaining,
    slot.tickets_remaining,
    slot.inventoryLevel,
    slot.inventory_level,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
  }

  return null;
}

function extractAvailabilityStatus(slot: StructuredDataDatePrice): string | null {
  return slot.availabilityStatus
    ?? slot.availability_status
    ?? "InStock";
}

function slotSortValue(slot: AvailabilityCheckSlot): number {
  if (!slot.time) {
    return Number.MAX_SAFE_INTEGER;
  }

  const [hours, minutes] = slot.time.split(":").map(Number);
  return hours * 60 + minutes;
}

function buildSlotLabel(slot: StructuredDataDatePrice): string | null {
  const label = slot.variantName?.trim();
  return label ? label : null;
}

function buildAvailabilityBookingUrl(
  bookingPath: string | undefined,
  date: string,
  partySize: number,
  language: string,
): string | null {
  if (!bookingPath) {
    return null;
  }

  const url = new URL(buildBookingUrl(bookingPath, language));
  url.searchParams.set("date", date);
  url.searchParams.set("adults", String(partySize));
  url.searchParams.set("lang", language);
  return url.toString();
}

export function calculateAvailabilityWindowDays(date: string, now = new Date()): number {
  const targetDate = parseIsoDate(date);
  if (!targetDate) {
    throw new Error("Date must be a valid ISO date in YYYY-MM-DD format.");
  }

  const deltaDays = Math.floor((getUtcDayStart(targetDate) - getUtcDayStart(now)) / 86_400_000);
  if (deltaDays < 0) {
    throw new Error("Date must be today or later.");
  }

  if (deltaDays >= MAX_CHECK_AVAILABILITY_WINDOW_DAYS) {
    throw new Error(`Availability checks currently support dates up to ${MAX_CHECK_AVAILABILITY_WINDOW_DAYS} days ahead.`);
  }

  return deltaDays + 1;
}

export function buildAvailabilityCheckPayload(
  date: string,
  partySize: number,
  details: StructuredDataResponse,
  options: AvailabilityCheckOptions = {},
): AvailabilityCheckPayload {
  const language = options.language ?? DEFAULT_LANGUAGE;
  const dateSlots = details.dates
    .filter(slot => slot.date === date)
    .map(slot => ({
      time: extractSlotTime(slot),
      label: buildSlotLabel(slot),
      price_per_person: slot.minPrice,
      currency: details.currencyCode,
      tickets_remaining: extractSlotInventory(slot),
      availability_status: extractAvailabilityStatus(slot),
    }))
    .sort((left, right) => {
      const timeDelta = slotSortValue(left) - slotSortValue(right);
      if (timeDelta !== 0) {
        return timeDelta;
      }

      const priceDelta = left.price_per_person - right.price_per_person;
      if (priceDelta !== 0) {
        return priceDelta;
      }

      return (left.label ?? "").localeCompare(right.label ?? "");
    });

  const cheapest = dateSlots.length
    ? Math.min(...dateSlots.map(slot => slot.price_per_person * partySize))
    : null;

  return {
    available: dateSlots.length > 0,
    title: options.title ?? null,
    slug: options.slug ?? null,
    date,
    slots: dateSlots,
    total_for_party: {
      party_size: partySize,
      cheapest,
      currency: details.currencyCode,
    },
    booking_url: buildAvailabilityBookingUrl(options.bookingPath, date, partySize, language),
    _intent_token: {
      endpoint: GHOST_CHECKOUT_INTENT_ENDPOINT,
      payload: {
        productSlug: options.slug ?? null,
        date,
        partySize,
        language,
      },
      hint: "POST this payload to mint a Ghost Checkout intent token for a pre-filled checkout URL.",
    },
  };
}

export function formatAvailabilityCheck(payload: AvailabilityCheckPayload): string {
  const title = payload.title ?? payload.slug ?? "tickadoo experience";
  const lines = [
    `🎟️ ${title}`,
    `📅 Date: ${payload.date}`,
  ];

  if (payload.available) {
    const guestLabel = payload.total_for_party.party_size === 1 ? "guest" : "guests";
    lines.push(
      `✅ Available for ${payload.total_for_party.party_size} ${guestLabel}. Cheapest total: ${formatCurrencyAmount(payload.total_for_party.currency, payload.total_for_party.cheapest)}`,
      "",
      "Slots:",
    );

    for (const slot of payload.slots) {
      const parts = [
        slot.time ? slot.time : slot.label ?? "Untimed entry",
        slot.label && slot.label !== slot.time ? `(${slot.label})` : undefined,
        `from ${formatCurrencyAmount(slot.currency, slot.price_per_person)} pp`,
        slot.tickets_remaining != null ? `${slot.tickets_remaining} tickets left` : undefined,
      ].filter(Boolean);
      lines.push(`- ${parts.join(" — ")}`);
    }
  } else {
    lines.push(`❌ No availability returned for ${payload.total_for_party.party_size} guests on this date.`);
  }

  if (payload.booking_url) {
    lines.push("", `🔗 Booking URL: ${payload.booking_url}`);
  }

  lines.push(
    "",
    `⚡ Ghost Checkout: POST ${JSON.stringify(payload._intent_token.payload)} to ${payload._intent_token.endpoint}`,
  );

  return lines.join("\n");
}
