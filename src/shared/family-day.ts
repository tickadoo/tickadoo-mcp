export interface FamilyDayCandidate {
  slug: string;
  title: string;
  category: string;
  priceFrom: number | null;
  currency: string | null;
  duration: string | null;
  tags: string[];
  audience: string[];
  wheelchairAccessible: boolean | null;
  strollerFriendly: boolean | null;
  physicalLevel: string | null;
  indoorOutdoor: string | null;
  bookingUrl: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  reviewCount: number | null;
}

export interface FamilyDayProfile {
  youngestAge: number | null;
  oldestAge: number | null;
  ageBand: "young_children" | "school_age" | "teens" | "mixed_family";
  requiresWheelchairAccess: boolean;
  allowsEvening: boolean;
}

export interface FamilyDayActivity {
  slug: string;
  title: string;
  category: string;
  price_from: number | null;
  currency: string | null;
  duration: string | null;
  tags: string[];
  audience: string[];
  wheelchair_accessible: boolean;
  stroller_friendly: boolean;
  booking_url: string;
  address: string | null;
}

export interface FamilyDayPayload {
  city: string;
  plan: {
    morning: FamilyDayActivity;
    lunch_tip: string;
    afternoon: FamilyDayActivity;
    evening: FamilyDayActivity | null;
  };
  total_cost: number | null;
  currency: string | null;
  all_wheelchair_accessible: boolean;
  booking_urls: Record<string, string>;
}

type Daypart = "morning" | "afternoon" | "evening";
type OrderedPair = {
  morning: FamilyDayCandidate;
  afternoon: FamilyDayCandidate;
  score: number;
};

const AREA_STOP_WORDS = new Set([
  "the",
  "and",
  "at",
  "near",
  "city",
  "centre",
  "center",
  "street",
  "road",
  "avenue",
  "pier",
  "station",
  "museum",
  "theatre",
  "theater",
  "london",
  "paris",
  "new york",
]);

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseDurationMinutes(duration: string | null): number | null {
  if (!duration) return null;
  const normalized = duration.toLowerCase().replace(/\s+/g, "");
  const hours = normalized.match(/(\d+)h/);
  const minutes = normalized.match(/(\d+)m/);
  if (hours || minutes) {
    return (hours ? parseInt(hours[1], 10) * 60 : 0) + (minutes ? parseInt(minutes[1], 10) : 0);
  }
  const numeric = normalized.match(/^(\d+)$/);
  return numeric ? parseInt(numeric[1], 10) : null;
}

function distanceKm(left: FamilyDayCandidate, right: FamilyDayCandidate): number | null {
  if (
    left.latitude == null
    || left.longitude == null
    || right.latitude == null
    || right.longitude == null
  ) {
    return null;
  }

  const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(right.latitude - left.latitude);
  const dLon = toRadians(right.longitude - left.longitude);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(left.latitude)) * Math.cos(toRadians(right.latitude)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function clusterScore(distance: number | null): number {
  if (distance == null) return 2;
  if (distance <= 0.75) return 22;
  if (distance <= 1.5) return 18;
  if (distance <= 3) return 10;
  if (distance <= 5) return 2;
  return -12;
}

function normalizeAges(kidsAges: readonly number[] = []): number[] {
  return kidsAges
    .filter(age => Number.isFinite(age) && age >= 0 && age <= 17)
    .map(age => Math.floor(age))
    .sort((left, right) => left - right);
}

export function deriveFamilyDayProfile(kidsAges: readonly number[] = []): FamilyDayProfile {
  const ages = normalizeAges(kidsAges);
  const youngestAge = ages[0] ?? null;
  const oldestAge = ages.length ? ages[ages.length - 1] : null;

  if (youngestAge == null) {
    return {
      youngestAge: null,
      oldestAge: null,
      ageBand: "mixed_family",
      requiresWheelchairAccess: false,
      allowsEvening: true,
    };
  }

  if (youngestAge < 6) {
    return {
      youngestAge,
      oldestAge,
      ageBand: "young_children",
      requiresWheelchairAccess: youngestAge < 3,
      allowsEvening: false,
    };
  }

  if (youngestAge <= 12) {
    return {
      youngestAge,
      oldestAge,
      ageBand: "school_age",
      requiresWheelchairAccess: false,
      allowsEvening: true,
    };
  }

  return {
    youngestAge,
    oldestAge,
    ageBand: "teens",
    requiresWheelchairAccess: false,
    allowsEvening: true,
  };
}

function isAdultsOnly(candidate: FamilyDayCandidate): boolean {
  const values = [...candidate.audience, ...candidate.tags].map(value => value.toLowerCase());
  return values.includes("adultsonly") || values.includes("adults only");
}

function hasFamilySignals(candidate: FamilyDayCandidate): boolean {
  const values = [
    candidate.title,
    candidate.category,
    candidate.indoorOutdoor || "",
    ...candidate.audience,
    ...candidate.tags,
  ].join(" ").toLowerCase();
  return /(family|kids|children|child|interactive|museum|zoo|aquarium|cruise|outdoor|adventure|attraction|show|light|garden|immersive)/.test(values);
}

function hasKeyword(candidate: FamilyDayCandidate, pattern: RegExp): boolean {
  const haystack = [
    candidate.title,
    candidate.category,
    candidate.indoorOutdoor || "",
    candidate.physicalLevel || "",
    ...candidate.tags,
    ...candidate.audience,
  ].join(" ");
  return pattern.test(haystack);
}

function physicalLevelScore(candidate: FamilyDayCandidate, profile: FamilyDayProfile): number {
  const level = (candidate.physicalLevel || "").toLowerCase();
  if (profile.ageBand === "young_children") {
    if (level.includes("easy")) return 14;
    if (level.includes("moderate")) return 4;
    if (level.includes("demanding") || level.includes("hard")) return -28;
    return 4;
  }

  if (profile.ageBand === "school_age") {
    if (level.includes("easy")) return 8;
    if (level.includes("moderate")) return 10;
    if (level.includes("demanding") || level.includes("hard")) return -8;
    return 5;
  }

  if (profile.ageBand === "teens") {
    if (level.includes("demanding") || level.includes("hard")) return 12;
    if (level.includes("moderate")) return 9;
    if (level.includes("easy")) return 4;
  }

  return 4;
}

function durationScore(candidate: FamilyDayCandidate, profile: FamilyDayProfile, daypart: Daypart): number {
  const minutes = parseDurationMinutes(candidate.duration);
  if (minutes == null) return 4;

  if (profile.ageBand === "young_children") {
    if (minutes <= 90) return 14;
    if (minutes <= 120) return 10;
    if (minutes <= 180) return -4;
    return -18;
  }

  if (profile.ageBand === "school_age") {
    if (minutes >= 45 && minutes <= 180) return 10;
    if (minutes <= 210) return 4;
    return -8;
  }

  if (profile.ageBand === "teens") {
    if (minutes >= 60 && minutes <= 210) return 10;
    if (minutes <= 240) return 5;
    return -6;
  }

  if (daypart === "morning" && minutes <= 120) return 8;
  return minutes <= 180 ? 6 : 0;
}

function settingScore(candidate: FamilyDayCandidate, profile: FamilyDayProfile, daypart: Daypart): number {
  const setting = (candidate.indoorOutdoor || "").toLowerCase();

  if (profile.ageBand === "young_children") {
    if (setting === "indoor" || setting === "mixed") return 8;
    if (setting === "outdoor") return 4;
    return 3;
  }

  if (profile.ageBand === "school_age") {
    if (setting === "outdoor") return 12;
    if (setting === "mixed") return 8;
    if (setting === "indoor") return 4;
    return 4;
  }

  if (profile.ageBand === "teens") {
    if (setting === "outdoor") return 10;
    if (setting === "mixed") return 7;
    if (setting === "indoor") return daypart === "evening" ? 8 : 4;
    return 4;
  }

  if (daypart === "evening" && setting === "indoor") return 6;
  return 4;
}

function keywordScore(candidate: FamilyDayCandidate, profile: FamilyDayProfile, daypart: Daypart): number {
  let score = 0;

  if (hasKeyword(candidate, /(family|kids|children|interactive|museum|science|zoo|aquarium|cruise|park)/i)) {
    score += 12;
  }

  if (profile.ageBand === "young_children") {
    if (hasKeyword(candidate, /(adventure|thrill|extreme|nightlife|bar|pub|club)/i)) score -= 24;
    if (hasKeyword(candidate, /(play|storybook|animal|aquarium|farm|garden|boat)/i)) score += 8;
  } else if (profile.ageBand === "school_age") {
    if (hasKeyword(candidate, /(interactive|science|museum|zoo|aquarium|outdoor|cruise|tour|activity|playground)/i)) score += 12;
    if (hasKeyword(candidate, /(adults only|nightlife|club)/i)) score -= 18;
  } else if (profile.ageBand === "teens") {
    if (hasKeyword(candidate, /(adventure|thrill|immersive|escape|outdoor|climb|ride|cruise)/i)) score += 12;
    if (hasKeyword(candidate, /(toddler|storybook|soft play)/i)) score -= 12;
  } else if (hasKeyword(candidate, /(interactive|family|outdoor|museum|cruise)/i)) {
    score += 8;
  }

  if (daypart === "evening") {
    if (hasKeyword(candidate, /(evening|show|light|cruise|night)/i)) score += 10;
    if (hasKeyword(candidate, /(nightlife|bar|pub|club)/i)) score -= profile.ageBand === "teens" ? 4 : 18;
  }

  return score;
}

function popularityScore(candidate: FamilyDayCandidate): number {
  const rating = candidate.rating ?? 0;
  const reviewCount = candidate.reviewCount ?? 0;
  return rating * 3 + Math.min(10, Math.log10(reviewCount + 1) * 4);
}

function familyMetadataScore(candidate: FamilyDayCandidate): number {
  const audience = candidate.audience.map(value => value.toLowerCase());
  const tags = candidate.tags.map(value => value.toLowerCase());

  let score = 0;
  if (audience.includes("family")) score += 18;
  if (audience.includes("kids") || audience.includes("children")) score += 16;
  if (tags.some(value => value.includes("kidsattraction"))) score += 18;
  if (tags.some(value => value.includes("family"))) score += 10;
  if (tags.some(value => value.includes("outdoor"))) score += 6;
  if (tags.some(value => value.includes("evening"))) score += 4;

  return score;
}

export function scoreFamilyDayCandidate(candidate: FamilyDayCandidate, profile: FamilyDayProfile, daypart: Daypart): number {
  if (!hasFamilySignals(candidate)) return -10;
  if (isAdultsOnly(candidate)) return -100;
  if (profile.requiresWheelchairAccess && candidate.wheelchairAccessible !== true) return -1000;

  let score = 40;
  score += familyMetadataScore(candidate);
  score += popularityScore(candidate);
  score += candidate.wheelchairAccessible === true ? 6 : 0;
  score += candidate.strollerFriendly === true ? 8 : 0;
  if (profile.ageBand === "young_children" && candidate.strollerFriendly === false) {
    score -= 10;
  }
  score += physicalLevelScore(candidate, profile);
  score += durationScore(candidate, profile, daypart);
  score += settingScore(candidate, profile, daypart);
  score += keywordScore(candidate, profile, daypart);

  if (daypart === "morning") {
    const minutes = parseDurationMinutes(candidate.duration);
    if (minutes != null && minutes <= 120) score += 8;
  }

  if (daypart === "afternoon") {
    const minutes = parseDurationMinutes(candidate.duration);
    if (minutes != null && minutes >= 75) score += 6;
  }

  if (daypart === "evening" && profile.ageBand !== "young_children") {
    score += 6;
  }

  return score;
}

function dedupeCandidates(candidates: readonly FamilyDayCandidate[]): FamilyDayCandidate[] {
  const unique = new Map<string, FamilyDayCandidate>();
  for (const candidate of candidates) {
    if (!unique.has(candidate.slug)) {
      unique.set(candidate.slug, candidate);
    }
  }
  return Array.from(unique.values());
}

function isEligibleFamilyCandidate(candidate: FamilyDayCandidate, profile: FamilyDayProfile): boolean {
  if (!hasFamilySignals(candidate)) return false;
  if (isAdultsOnly(candidate)) return false;
  if (profile.requiresWheelchairAccess && candidate.wheelchairAccessible !== true) return false;
  return true;
}

function filterCandidates(
  candidates: readonly FamilyDayCandidate[],
  profile: FamilyDayProfile,
  daypart?: Daypart,
): FamilyDayCandidate[] {
  return dedupeCandidates(candidates).filter(candidate => {
    if (!isEligibleFamilyCandidate(candidate, profile)) return false;

    if (daypart) {
      return scoreFamilyDayCandidate(candidate, profile, daypart) > 0;
    }

    return Math.max(
      scoreFamilyDayCandidate(candidate, profile, "morning"),
      scoreFamilyDayCandidate(candidate, profile, "afternoon"),
    ) > 0;
  });
}

function pairBudgetScore(left: FamilyDayCandidate, right: FamilyDayCandidate, budget?: number): number {
  if (budget == null || budget <= 0) return 0;
  const total = [left.priceFrom, right.priceFrom]
    .filter((value): value is number => value != null)
    .reduce((sum, value) => sum + value, 0);
  if (total <= budget) return 10;
  return -Math.min(24, ((total - budget) / budget) * 30);
}

function varietyScore(left: FamilyDayCandidate, right: FamilyDayCandidate): number {
  if (left.slug === right.slug) return -1000;
  if (left.category !== right.category) return 6;
  return -2;
}

function chooseBestPair(candidates: readonly FamilyDayCandidate[], profile: FamilyDayProfile, budget?: number): OrderedPair {
  if (candidates.length < 2) {
    throw new Error("Not enough family-friendly experiences to build a full day");
  }

  let bestPair: OrderedPair | null = null;

  for (let index = 0; index < candidates.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < candidates.length; otherIndex += 1) {
      const first = candidates[index];
      const second = candidates[otherIndex];
      const pairBase = varietyScore(first, second) + pairBudgetScore(first, second, budget) + clusterScore(distanceKm(first, second));
      const firstMorningScore = scoreFamilyDayCandidate(first, profile, "morning") + scoreFamilyDayCandidate(second, profile, "afternoon") + pairBase;
      const secondMorningScore = scoreFamilyDayCandidate(second, profile, "morning") + scoreFamilyDayCandidate(first, profile, "afternoon") + pairBase;

      const ordered = firstMorningScore >= secondMorningScore
        ? { morning: first, afternoon: second, score: firstMorningScore }
        : { morning: second, afternoon: first, score: secondMorningScore };

      if (!bestPair || ordered.score > bestPair.score) {
        bestPair = ordered;
      }
    }
  }

  if (!bestPair) {
    throw new Error("Could not cluster family activities for the day");
  }

  return bestPair;
}

function chooseEvening(candidates: readonly FamilyDayCandidate[], pair: OrderedPair, profile: FamilyDayProfile, budget?: number): FamilyDayCandidate | null {
  if (!profile.allowsEvening) return null;

  const options = filterCandidates(candidates, profile, "evening")
    .filter(candidate => candidate.slug !== pair.morning.slug && candidate.slug !== pair.afternoon.slug)
    .map(candidate => ({
      candidate,
      score: scoreFamilyDayCandidate(candidate, profile, "evening")
        + clusterScore(distanceKm(pair.afternoon, candidate))
        + pairBudgetScore(pair.morning, candidate, budget)
        + pairBudgetScore(pair.afternoon, candidate, budget),
    }))
    .sort((left, right) => right.score - left.score);

  const best = options[0];
  if (!best || best.score < 55) return null;
  return best.candidate;
}

function cleanSegment(segment: string, city: string): string | null {
  const cleaned = segment.replace(/\b\d{4,}\b/g, "").trim();
  if (!cleaned) return null;
  if (cleaned.toLowerCase() === city.toLowerCase()) return null;
  if (AREA_STOP_WORDS.has(cleaned.toLowerCase())) return null;
  return cleaned;
}

function extractSegments(address: string | null, city: string): string[] {
  if (!address) return [];
  return address
    .split(",")
    .map(segment => cleanSegment(segment, city))
    .filter((segment): segment is string => Boolean(segment));
}

function deriveClusterArea(morning: FamilyDayCandidate, afternoon: FamilyDayCandidate, city: string): string | null {
  const morningSegments = extractSegments(morning.address, city);
  const afternoonSegments = extractSegments(afternoon.address, city);
  const lookup = new Map(afternoonSegments.map(segment => [segment.toLowerCase(), segment]));
  const shared = morningSegments.find(segment => lookup.has(segment.toLowerCase()));
  if (shared) return shared;
  return morningSegments[1] || afternoonSegments[1] || morningSegments[0] || afternoonSegments[0] || null;
}

function buildLunchTip(morning: FamilyDayCandidate, afternoon: FamilyDayCandidate, city: string, profile: FamilyDayProfile): string {
  const clusterArea = deriveClusterArea(morning, afternoon, city);
  if (clusterArea) {
    return `Plan lunch around ${clusterArea} to keep the day walkable between ${morning.title} and ${afternoon.title}${profile.requiresWheelchairAccess ? ", with simpler stroller-friendly routing" : ""}.`;
  }
  return `Keep lunch close to ${morning.title} and ${afternoon.title} so the family avoids a long mid-day transfer${profile.requiresWheelchairAccess ? " and has an easier stroller route" : ""}.`;
}

function totalCost(candidates: Array<FamilyDayCandidate | null>): { total: number | null; currency: string | null } {
  const priced = candidates
    .filter((candidate): candidate is FamilyDayCandidate => Boolean(candidate))
    .map(candidate => ({ price: candidate.priceFrom, currency: candidate.currency }))
    .filter((entry): entry is { price: number; currency: string | null } => entry.price != null);

  if (!priced.length) {
    return { total: null, currency: null };
  }

  const currencies = uniqueStrings(priced.map(entry => entry.currency || ""));
  if (currencies.length > 1) {
    return { total: null, currency: null };
  }

  return {
    total: roundCurrency(priced.reduce((sum, entry) => sum + entry.price, 0)),
    currency: priced[0].currency,
  };
}

function serializeActivity(candidate: FamilyDayCandidate): FamilyDayActivity {
  return {
    slug: candidate.slug,
    title: candidate.title,
    category: candidate.category,
    price_from: candidate.priceFrom,
    currency: candidate.currency,
    duration: candidate.duration,
    tags: uniqueStrings(candidate.tags),
    audience: uniqueStrings(candidate.audience),
    wheelchair_accessible: candidate.wheelchairAccessible === true,
    stroller_friendly: candidate.strollerFriendly === true,
    booking_url: candidate.bookingUrl,
    address: candidate.address,
  };
}

export function buildFamilyDayPayload(input: {
  city: string;
  kidsAges?: readonly number[];
  budget?: number;
  candidates: readonly FamilyDayCandidate[];
}): FamilyDayPayload {
  const profile = deriveFamilyDayProfile(input.kidsAges || []);
  const candidates = filterCandidates(input.candidates, profile);
  const orderedPair = chooseBestPair(candidates, profile, input.budget);
  const evening = chooseEvening(candidates, orderedPair, profile, input.budget);
  const selected = [orderedPair.morning, orderedPair.afternoon, evening];
  const totals = totalCost(selected);

  return {
    city: input.city,
    plan: {
      morning: serializeActivity(orderedPair.morning),
      lunch_tip: buildLunchTip(orderedPair.morning, orderedPair.afternoon, input.city, profile),
      afternoon: serializeActivity(orderedPair.afternoon),
      evening: evening ? serializeActivity(evening) : null,
    },
    total_cost: totals.total,
    currency: totals.currency,
    all_wheelchair_accessible: selected
      .filter((candidate): candidate is FamilyDayCandidate => Boolean(candidate))
      .every(candidate => candidate.wheelchairAccessible === true),
    booking_urls: Object.fromEntries(
      selected
        .filter((candidate): candidate is FamilyDayCandidate => Boolean(candidate))
        .map(candidate => [candidate.slug, candidate.bookingUrl]),
    ),
  };
}

function formatPrice(activity: FamilyDayActivity): string {
  if (activity.price_from == null) return "price on request";
  return `${activity.currency || ""}${activity.currency ? " " : ""}${roundCurrency(activity.price_from)}`;
}

export function formatFamilyDayText(payload: FamilyDayPayload): string {
  return [
    `Morning: ${payload.plan.morning.title} (${formatPrice(payload.plan.morning)})`,
    `Lunch: ${payload.plan.lunch_tip}`,
    `Afternoon: ${payload.plan.afternoon.title} (${formatPrice(payload.plan.afternoon)})`,
    `Evening: ${payload.plan.evening ? `${payload.plan.evening.title} (${formatPrice(payload.plan.evening)})` : "Skip the evening slot and keep it easy."}`,
    `Estimated total: ${payload.total_cost != null ? `${payload.currency || ""}${payload.currency ? " " : ""}${roundCurrency(payload.total_cost)}` : "varies by venue"}`,
    `Wheelchair access: ${payload.all_wheelchair_accessible ? "All selected stops are marked wheelchair accessible." : "Double-check venue access before booking every stop."}`,
  ].join("\n");
}
