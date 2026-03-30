export const TONIGHT_URGENCY_SIGNALS = [
  "last_few_tickets",
  "selling_fast",
  "available",
] as const;

export type TonightUrgencySignal = (typeof TONIGHT_URGENCY_SIGNALS)[number];

export type TonightWeatherSummary = {
  temp?: number;
  conditions?: string;
};

export type TonightVenue = {
  name: string | null;
  address: string | null;
};

export type TonightSourceSlot = {
  date?: string | null;
  time?: string | null;
  startTime?: string | null;
  start_time?: string | null;
  variantName?: string | null;
  minPrice?: number | null;
  ticketsRemaining?: number | null;
  tickets_remaining?: number | null;
  inventoryLevel?: number | null;
  inventory_level?: number | null;
  availabilityStatus?: string | null;
  availability_status?: string | null;
};

export type TonightSourceExperience = {
  slug: string;
  title: string;
  category?: string | null;
  priceFrom?: number | null;
  currency?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
  urgencyHints?: readonly string[];
  tags?: readonly string[];
  rating?: number | null;
  bookingUrl?: string | null;
  slots?: readonly TonightSourceSlot[];
};

export type TonightListing = {
  slug: string;
  title: string;
  start_time: string;
  starts_in: string;
  price_from: number;
  currency: string;
  venue: TonightVenue;
  urgency: TonightUrgencySignal;
  tags: string[];
  rating: number | null;
  booking_url: string;
};

export type TonightResult = {
  city: string;
  tonight: TonightListing[];
  _summary: string;
  _weather?: TonightWeatherSummary;
};

export type WhatsOnTonightToolResult = {
  tonight: TonightListing[];
  _summary: string;
  _weather?: TonightWeatherSummary;
};

export type BuildTonightOptions = {
  city: string;
  date: string;
  currentTime: string;
  experiences: readonly TonightSourceExperience[];
  maxResults?: number;
  weather?: TonightWeatherSummary;
};

const DEFAULT_CURRENCY = "GBP";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatLocalIsoDate(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function formatLocalClock(now = new Date()): string {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
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

function slotStartTime(slot: TonightSourceSlot): string | null {
  return normalizeClockValue(slot.time)
    ?? normalizeClockValue(slot.startTime)
    ?? normalizeClockValue(slot.start_time)
    ?? normalizeClockValue(slot.variantName);
}

function slotInventory(slot: TonightSourceSlot): number | null {
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

function slotAvailabilityStatus(slot: TonightSourceSlot): string | null {
  return slot.availabilityStatus
    ?? slot.availability_status
    ?? "InStock";
}

function timeToMinutes(value: string): number | null {
  const normalized = normalizeClockValue(value);
  if (!normalized) {
    return null;
  }

  const [hours, minutes] = normalized.split(":").map(Number);
  return (hours * 60) + minutes;
}

function formatCountdown(diffMinutes: number): string {
  if (diffMinutes <= 0) {
    return "now";
  }

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${minutes}m`;
}

function inferVenueName(address: string | null | undefined): string | null {
  if (!address) {
    return null;
  }

  const [firstPart] = address
    .split(",")
    .map(part => part.trim())
    .filter(Boolean);

  return firstPart || null;
}

function isSoldOutStatus(status: string | null | undefined): boolean {
  return typeof status === "string"
    && /sold\s*out|unavailable|out\s*of\s*stock/i.test(status);
}

function slotIsBookable(slot: TonightSourceSlot): boolean {
  const inventory = slotInventory(slot);
  if (typeof inventory === "number" && inventory <= 0) {
    return false;
  }

  return !isSoldOutStatus(slotAvailabilityStatus(slot));
}

function resolveUrgencySignal(
  experience: TonightSourceExperience,
  slot: TonightSourceSlot,
): TonightUrgencySignal {
  const hints = (experience.urgencyHints || []).join(" ").toLowerCase();
  const inventory = slotInventory(slot);
  const status = slotAvailabilityStatus(slot);

  if (typeof inventory === "number" && inventory > 0 && inventory <= 5) {
    return "last_few_tickets";
  }

  if (typeof inventory === "number" && inventory > 0 && inventory <= 15) {
    return "selling_fast";
  }

  if (/last few|only\s+\d+\s+left|few tickets|few left|almost sold out/i.test(hints)) {
    return "last_few_tickets";
  }

  if (/selling fast|limited availability|going fast|running low/i.test(hints)) {
    return "selling_fast";
  }

  if (typeof status === "string" && /limited/i.test(status)) {
    return "selling_fast";
  }

  return "available";
}

export function formatTonightUrgencyLabel(signal: TonightUrgencySignal): string {
  switch (signal) {
    case "last_few_tickets":
      return "Last few tickets!";
    case "selling_fast":
      return "Selling fast";
    default:
      return "Available";
  }
}

function formatDisplayTime(clock: string): string {
  const [rawHour, rawMinute] = clock.split(":").map(Number);
  const hour = rawHour || 0;
  const minute = rawMinute || 0;
  const suffix = hour >= 12 ? "pm" : "am";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${pad(minute)}${suffix}`;
}

function tagBoost(experience: TonightSourceExperience): number {
  const haystack = [
    experience.category || "",
    ...(experience.tags || []),
  ].join(" ").toLowerCase();

  let boost = 0;
  if (haystack.includes("evening")) boost += 4;
  if (haystack.includes("nightlife")) boost += 4;
  if (haystack.includes("show") || haystack.includes("musical") || haystack.includes("theatre")) boost += 3;
  return boost;
}

function summaryNoun(listings: readonly TonightListing[]): string {
  const showCount = listings.filter(listing =>
    listing.tags.some(tag => /show|musical|theatre/i.test(tag)),
  ).length;

  if (showCount >= Math.ceil(Math.max(1, listings.length) / 2)) {
    return listings.length === 1 ? "show" : "shows";
  }

  return listings.length === 1 ? "experience" : "experiences";
}

function normalizeCityLabel(value: string): string {
  return value
    .split(/[-\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function pickUpcomingSlot(
  experience: TonightSourceExperience,
  date: string,
  currentMinutes: number,
): { slot: TonightSourceSlot; startTime: string; diffMinutes: number } | undefined {
  const candidates = (experience.slots || [])
    .filter(slot => slot.date === date)
    .filter(slotIsBookable)
    .map(slot => {
      const startTime = slotStartTime(slot);
      if (!startTime) {
        return undefined;
      }

      const startMinutes = timeToMinutes(startTime);
      if (startMinutes == null) {
        return undefined;
      }

      const diffMinutes = startMinutes - currentMinutes;
      if (diffMinutes <= 0) {
        return undefined;
      }

      return {
        slot,
        startTime,
        diffMinutes,
      };
    })
    .filter((value): value is { slot: TonightSourceSlot; startTime: string; diffMinutes: number } => Boolean(value))
    .sort((left, right) => left.diffMinutes - right.diffMinutes || (left.slot.minPrice ?? Number.MAX_SAFE_INTEGER) - (right.slot.minPrice ?? Number.MAX_SAFE_INTEGER));

  return candidates[0];
}

function listingEmoji(tags: readonly string[]): string {
  const joined = tags.join(" ").toLowerCase();
  if (/show|musical|theatre|concert|comedy/.test(joined)) return "🎭";
  if (/nightlife|bar|club/.test(joined)) return "🌃";
  if (/dining|food|restaurant/.test(joined)) return "🍽️";
  if (/cruise|boat|river/.test(joined)) return "🛥️";
  return "✨";
}

export function buildTonightResult(options: BuildTonightOptions): TonightResult {
  const city = normalizeCityLabel(options.city);
  const maxResults = Math.max(1, options.maxResults ?? 10);
  const currentMinutes = timeToMinutes(options.currentTime);

  if (currentMinutes == null) {
    throw new Error(`Invalid current time. Expected HH:MM, got "${options.currentTime}".`);
  }

  const tonight = options.experiences
    .map(experience => {
      const upcoming = pickUpcomingSlot(experience, options.date, currentMinutes);
      if (!upcoming) {
        return undefined;
      }

      const venueAddress = experience.venueAddress ?? null;
      const venueName = experience.venueName ?? inferVenueName(venueAddress);
      const urgency = resolveUrgencySignal(experience, upcoming.slot);
      const priceFrom = upcoming.slot.minPrice ?? experience.priceFrom ?? 0;

      return {
        slug: experience.slug,
        title: experience.title,
        start_time: upcoming.startTime,
        starts_in: formatCountdown(upcoming.diffMinutes),
        price_from: priceFrom,
        currency: experience.currency ?? DEFAULT_CURRENCY,
        venue: {
          name: venueName,
          address: venueAddress,
        },
        urgency,
        tags: Array.from(new Set((experience.tags || []).filter(Boolean))),
        rating: experience.rating ?? null,
        booking_url: experience.bookingUrl ?? "https://www.tickadoo.com",
        _diffMinutes: upcoming.diffMinutes,
        _boost: tagBoost(experience),
      };
    })
    .filter((listing): listing is TonightListing & { _diffMinutes: number; _boost: number } => Boolean(listing))
    .sort((left, right) =>
      left.start_time.localeCompare(right.start_time)
      || right._boost - left._boost
      || (right.rating ?? 0) - (left.rating ?? 0)
      || left.price_from - right.price_from,
    )
    .slice(0, maxResults)
    .map(({ _diffMinutes: _ignoredDiffMinutes, _boost: _ignoredBoost, ...listing }) => listing);

  const noun = summaryNoun(tonight);
  const summary = tonight.length
    ? `${tonight.length} ${noun} tonight in ${city}. ${tonight[0].title} starts in ${tonight[0].starts_in}.`
    : `No bookable experiences remain tonight in ${city}.`;

  return {
    city,
    tonight,
    _summary: summary,
    ...(options.weather ? { _weather: options.weather } : {}),
  };
}

export function formatTonightText(result: TonightResult): string {
  if (!result.tonight.length) {
    return `🌙 Tonight in ${result.city}\n\nNo bookable experiences remain for tonight right now.`;
  }

  const noun = summaryNoun(result.tonight);
  const body = result.tonight.map(listing => {
    const meta = [
      `From ${listing.currency} ${listing.price_from.toFixed(2)}`,
      listing.rating != null ? `⭐ ${listing.rating.toFixed(1)}` : null,
      formatTonightUrgencyLabel(listing.urgency),
    ].filter(Boolean).join(" | ");

    const venueText = listing.venue.name || listing.venue.address
      ? `\n   📍 ${[listing.venue.name, listing.venue.address].filter(Boolean).join(" — ")}`
      : "";

    return [
      `${listingEmoji(listing.tags)} ${listing.title} — ${formatDisplayTime(listing.start_time)} (starts in ${listing.starts_in})`,
      `   ${meta}`,
      venueText,
      `\n   🔗 ${listing.booking_url}`,
    ].join("");
  }).join("\n\n");

  return `🌙 Tonight in ${result.city} (${result.tonight.length} ${noun}):\n\n${body}`;
}

export function toWhatsOnTonightPayload(result: TonightResult): WhatsOnTonightToolResult {
  return {
    tonight: result.tonight,
    _summary: result._summary,
    ...(result._weather ? { _weather: result._weather } : {}),
  };
}
