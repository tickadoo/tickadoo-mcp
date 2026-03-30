export interface ComparableExperience {
  slug: string;
  title: string;
  priceFrom: number | null;
  currency: string | null;
  duration: string | null;
  rating: number | null;
  reviewCount: number | null;
  tags: string[];
  audience: string[];
  wheelchairAccessible: boolean | null;
  strollerFriendly: boolean | null;
  cancellationPolicy: string | null;
  bookingUrl: string;
}

export interface ComparisonWinnerCallouts {
  best_value: string;
  highest_rated: string;
  most_popular: string;
  best_for_families: string;
}

export interface ComparisonEntry {
  slug: string;
  title: string;
  price_from: number | null;
  currency: string | null;
  duration: string | null;
  rating: number | null;
  review_count: number | null;
  tags: string[];
  audience: string[];
  wheelchair_accessible: boolean;
  cancellation_policy: string | null;
}

export interface ComparisonPayload {
  comparison: ComparisonEntry[];
  winner: ComparisonWinnerCallouts;
  differences: string[];
  _booking_urls: Record<string, string>;
}

interface ComparisonContext {
  sameCurrency: boolean;
  minPrice: number | null;
  maxPrice: number | null;
  maxReviews: number | null;
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function compareNullableDescending(left: number | null, right: number | null): number {
  return (right ?? Number.NEGATIVE_INFINITY) - (left ?? Number.NEGATIVE_INFINITY);
}

function compareNullableAscending(left: number | null, right: number | null): number {
  return (left ?? Number.POSITIVE_INFINITY) - (right ?? Number.POSITIVE_INFINITY);
}

function sortByTitle(left: ComparableExperience, right: ComparableExperience): number {
  return left.title.localeCompare(right.title);
}

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d*[1-9])0$/, "$1");
}

function formatPrice(value: number | null, currency: string | null): string {
  if (value == null) return "-";
  return `${currency || ""}${currency ? " " : ""}${formatNumber(value)}`;
}

function formatReviewCount(value: number | null): string {
  return value == null ? "-" : value.toLocaleString("en-GB");
}

function normalizeScale(value: number | null, min: number | null, max: number | null): number {
  if (value == null || min == null || max == null) return 0;
  if (max === min) return 1;
  return (value - min) / (max - min);
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

function formatDurationMinutes(minutes: number): string {
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  if (minutes > 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes} min`;
}

function joinTitles(titles: readonly string[]): string {
  if (titles.length === 0) return "";
  if (titles.length === 1) return titles[0];
  if (titles.length === 2) return `${titles[0]} and ${titles[1]}`;
  return `${titles.slice(0, -1).join(", ")}, and ${titles[titles.length - 1]}`;
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

function buildContext(entries: readonly ComparableExperience[]): ComparisonContext {
  const currencies = uniqueStrings(entries.map(entry => entry.currency || ""));
  const prices = entries.map(entry => entry.priceFrom).filter((value): value is number => value != null);
  const reviews = entries.map(entry => entry.reviewCount).filter((value): value is number => value != null);

  return {
    sameCurrency: currencies.length <= 1,
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    maxReviews: reviews.length ? Math.max(...reviews) : null,
  };
}

function pickWinner(
  entries: readonly ComparableExperience[],
  scorer: (entry: ComparableExperience, context: ComparisonContext) => number,
): ComparableExperience {
  const context = buildContext(entries);
  return [...entries].sort((left, right) => (
    scorer(right, context) - scorer(left, context)
    || compareNullableDescending(left.rating, right.rating)
    || compareNullableDescending(left.reviewCount, right.reviewCount)
    || compareNullableAscending(left.priceFrom, right.priceFrom)
    || sortByTitle(left, right)
  ))[0];
}

function pickHighestRated(entries: readonly ComparableExperience[]): ComparableExperience {
  return [...entries].sort((left, right) => (
    compareNullableDescending(left.rating, right.rating)
    || compareNullableDescending(left.reviewCount, right.reviewCount)
    || compareNullableAscending(left.priceFrom, right.priceFrom)
    || sortByTitle(left, right)
  ))[0];
}

function pickMostPopular(entries: readonly ComparableExperience[]): ComparableExperience {
  return [...entries].sort((left, right) => (
    compareNullableDescending(left.reviewCount, right.reviewCount)
    || compareNullableDescending(left.rating, right.rating)
    || compareNullableAscending(left.priceFrom, right.priceFrom)
    || sortByTitle(left, right)
  ))[0];
}

function scoreBestValue(entry: ComparableExperience, context: ComparisonContext): number {
  const ratingScore = ((entry.rating ?? 0) / 5) * 45;
  const reviewScore = context.maxReviews
    ? Math.min(20, (Math.log10((entry.reviewCount ?? 0) + 1) / Math.log10(context.maxReviews + 1)) * 20)
    : 0;
  const priceScore = context.sameCurrency && entry.priceFrom != null
    ? (1 - normalizeScale(entry.priceFrom, context.minPrice, context.maxPrice)) * 35
    : 0;
  return ratingScore + reviewScore + priceScore;
}

function scoreFamilyFit(entry: ComparableExperience, context: ComparisonContext): number {
  const tags = entry.tags.map(value => value.toLowerCase());
  const audience = entry.audience.map(value => value.toLowerCase());
  const familyScore = (audience.includes("family") ? 35 : 0)
    + (audience.includes("kids") || audience.includes("children") ? 25 : 0)
    + (tags.some(value => value.includes("family") || value.includes("kids")) ? 10 : 0)
    + (entry.strollerFriendly === true ? 12 : 0)
    + (entry.wheelchairAccessible === true ? 8 : 0)
    - (audience.includes("adultsonly") ? 30 : 0);
  const ratingScore = ((entry.rating ?? 0) / 5) * 15;
  const reviewScore = context.maxReviews
    ? Math.min(8, ((entry.reviewCount ?? 0) / context.maxReviews) * 8)
    : 0;
  const priceScore = context.sameCurrency && entry.priceFrom != null
    ? (1 - normalizeScale(entry.priceFrom, context.minPrice, context.maxPrice)) * 5
    : 0;
  return familyScore + ratingScore + reviewScore + priceScore;
}

function hasFamilyAudience(entry: ComparableExperience): boolean {
  const audience = entry.audience.map(value => value.toLowerCase());
  return audience.includes("family") || audience.includes("kids") || audience.includes("children");
}

function isAdultsOnly(entry: ComparableExperience): boolean {
  return entry.audience.some(value => value.toLowerCase() === "adultsonly");
}

function hasFreeCancellation(entry: ComparableExperience): boolean {
  return /free cancellation|cancel up to/i.test(entry.cancellationPolicy || "");
}

function hasCancellationRestriction(entry: ComparableExperience): boolean {
  return /non[- ]?refundable|no refunds|final sale/i.test(entry.cancellationPolicy || "");
}

function pushIfMissing(target: string[], value: string | null): void {
  if (!value || target.includes(value)) return;
  target.push(value);
}

function buildDifferences(entries: readonly ComparableExperience[], winners: ComparisonWinnerCallouts): string[] {
  const differences: string[] = [];
  const highestRated = entries.find(entry => entry.slug === winners.highest_rated) || entries[0];
  const mostPopular = entries.find(entry => entry.slug === winners.most_popular) || entries[0];
  const bestValue = entries.find(entry => entry.slug === winners.best_value) || entries[0];

  const comparablePrices = entries.filter(entry => entry.priceFrom != null && entry.currency === bestValue.currency);
  const cheapest = [...comparablePrices].sort((left, right) => compareNullableAscending(left.priceFrom, right.priceFrom) || sortByTitle(left, right))[0];
  const priciest = [...comparablePrices].sort((left, right) => compareNullableDescending(left.priceFrom, right.priceFrom) || sortByTitle(left, right))[0];
  if (cheapest && priciest && cheapest.slug !== priciest.slug && cheapest.priceFrom != null && priciest.priceFrom != null) {
    const difference = priciest.priceFrom - cheapest.priceFrom;
    if (difference >= 1) {
      pushIfMissing(differences, `${cheapest.title} is ${formatPrice(difference, cheapest.currency)} cheaper than ${priciest.title}.`);
    }
  }

  const lowestRated = [...entries].sort((left, right) => compareNullableAscending(left.rating, right.rating) || sortByTitle(left, right))[0];
  if (
    highestRated
    && lowestRated
    && highestRated.slug !== lowestRated.slug
    && highestRated.rating != null
    && lowestRated.rating != null
    && highestRated.rating - lowestRated.rating >= 0.1
  ) {
    pushIfMissing(differences, `${highestRated.title} is rated ${formatNumber(highestRated.rating - lowestRated.rating)} points higher than ${lowestRated.title}.`);
  }

  const leastPopular = [...entries].sort((left, right) => compareNullableAscending(left.reviewCount, right.reviewCount) || sortByTitle(left, right))[0];
  if (
    mostPopular
    && leastPopular
    && mostPopular.slug !== leastPopular.slug
    && mostPopular.reviewCount != null
    && leastPopular.reviewCount != null
    && mostPopular.reviewCount - leastPopular.reviewCount >= 100
  ) {
    pushIfMissing(differences, `${mostPopular.title} has ${formatReviewCount(mostPopular.reviewCount - leastPopular.reviewCount)} more reviews than ${leastPopular.title}.`);
  }

  const durations = entries
    .map(entry => ({ entry, minutes: parseDurationMinutes(entry.duration) }))
    .filter((entry): entry is { entry: ComparableExperience; minutes: number } => entry.minutes != null);
  const longest = [...durations].sort((left, right) => right.minutes - left.minutes || sortByTitle(left.entry, right.entry))[0];
  const shortest = [...durations].sort((left, right) => left.minutes - right.minutes || sortByTitle(left.entry, right.entry))[0];
  if (longest && shortest && longest.entry.slug !== shortest.entry.slug && longest.minutes - shortest.minutes >= 15) {
    pushIfMissing(differences, `${longest.entry.title} is ${formatDurationMinutes(longest.minutes - shortest.minutes)} longer than ${shortest.entry.title}.`);
  }

  const freeCancellation = entries.filter(hasFreeCancellation).map(entry => entry.title);
  const restrictedCancellation = entries.filter(hasCancellationRestriction).map(entry => entry.title);
  if (freeCancellation.length > 0 && freeCancellation.length < entries.length) {
    const others = entries.map(entry => entry.title).filter(title => !freeCancellation.includes(title));
    pushIfMissing(differences, `${joinTitles(freeCancellation)} ${freeCancellation.length === 1 ? "offers" : "offer"} free cancellation, while ${joinTitles(others)} ${others.length === 1 ? "does" : "do"} not.`);
  } else if (restrictedCancellation.length > 0 && restrictedCancellation.length < entries.length) {
    const others = entries.map(entry => entry.title).filter(title => !restrictedCancellation.includes(title));
    pushIfMissing(differences, `${joinTitles(restrictedCancellation)} ${restrictedCancellation.length === 1 ? "is" : "are"} more restrictive on refunds than ${joinTitles(others)}.`);
  }

  const familyFriendly = entries.filter(hasFamilyAudience).map(entry => entry.title);
  const adultsOnly = entries.filter(isAdultsOnly).map(entry => entry.title);
  if (familyFriendly.length > 0 && adultsOnly.length > 0) {
    pushIfMissing(
      differences,
      `${joinTitles(familyFriendly)} ${familyFriendly.length === 1 ? "has" : "have"} stronger family audience signals, while ${joinTitles(adultsOnly)} ${adultsOnly.length === 1 ? "is" : "are"} adults-only.`,
    );
  }

  const wheelchairFriendly = entries.filter(entry => entry.wheelchairAccessible === true).map(entry => entry.title);
  if (wheelchairFriendly.length > 0 && wheelchairFriendly.length < entries.length) {
    const others = entries.map(entry => entry.title).filter(title => !wheelchairFriendly.includes(title));
    pushIfMissing(differences, `Only ${joinTitles(wheelchairFriendly)} ${wheelchairFriendly.length === 1 ? "is" : "are"} marked wheelchair accessible, unlike ${joinTitles(others)}.`);
  }

  if (!differences.length) {
    pushIfMissing(differences, `${bestValue.title} stands out on value, while ${highestRated.title} and ${mostPopular.title} lead on quality and demand.`);
  }

  return differences.slice(0, 6);
}

export function buildComparisonPayload(entries: readonly ComparableExperience[]): ComparisonPayload {
  if (entries.length < 2 || entries.length > 5) {
    throw new Error("compare_experiences requires between 2 and 5 experiences");
  }

  const winner = {
    best_value: pickWinner(entries, scoreBestValue).slug,
    highest_rated: pickHighestRated(entries).slug,
    most_popular: pickMostPopular(entries).slug,
    best_for_families: pickWinner(entries, scoreFamilyFit).slug,
  };

  return {
    comparison: entries.map(entry => ({
      slug: entry.slug,
      title: entry.title,
      price_from: entry.priceFrom,
      currency: entry.currency,
      duration: entry.duration,
      rating: entry.rating,
      review_count: entry.reviewCount,
      tags: uniqueStrings(entry.tags),
      audience: uniqueStrings(entry.audience),
      wheelchair_accessible: entry.wheelchairAccessible === true,
      cancellation_policy: entry.cancellationPolicy,
    })),
    winner,
    differences: buildDifferences(entries, winner),
    _booking_urls: Object.fromEntries(entries.map(entry => [entry.slug, entry.bookingUrl])),
  };
}

export function formatComparisonText(payload: ComparisonPayload): string {
  const titleBySlug = new Map(payload.comparison.map(entry => [entry.slug, entry.title]));
  const columns = payload.comparison.map(entry => entry.title);
  const header = `| Metric | ${columns.map(escapeTableCell).join(" | ")} |`;
  const divider = `| --- | ${columns.map(() => "---").join(" | ")} |`;
  const rows: Array<[string, string[]]> = [
    ["Price from", payload.comparison.map(entry => formatPrice(entry.price_from, entry.currency))],
    ["Duration", payload.comparison.map(entry => entry.duration || "-")],
    ["Rating", payload.comparison.map(entry => entry.rating == null ? "-" : `${formatNumber(entry.rating)}★`)],
    ["Reviews", payload.comparison.map(entry => formatReviewCount(entry.review_count))],
    ["Audience", payload.comparison.map(entry => entry.audience.length ? entry.audience.join(", ") : "-")],
    ["Wheelchair accessible", payload.comparison.map(entry => entry.wheelchair_accessible ? "Yes" : "No")],
    ["Cancellation", payload.comparison.map(entry => entry.cancellation_policy || "-")],
  ];

  const table = [
    header,
    divider,
    ...rows.map(([label, values]) => `| ${escapeTableCell(label)} | ${values.map(value => escapeTableCell(value)).join(" | ")} |`),
  ].join("\n");

  const winnerLines = [
    `- best_value: ${titleBySlug.get(payload.winner.best_value) || payload.winner.best_value}`,
    `- highest_rated: ${titleBySlug.get(payload.winner.highest_rated) || payload.winner.highest_rated}`,
    `- most_popular: ${titleBySlug.get(payload.winner.most_popular) || payload.winner.most_popular}`,
    `- best_for_families: ${titleBySlug.get(payload.winner.best_for_families) || payload.winner.best_for_families}`,
  ].join("\n");

  const differenceLines = payload.differences.map(difference => `- ${difference}`).join("\n");
  const bookingLines = Object.entries(payload._booking_urls)
    .map(([slug, url]) => `- ${titleBySlug.get(slug) || slug}: ${url}`)
    .join("\n");

  return [
    "Winner callouts",
    winnerLines,
    "",
    table,
    "",
    "Key differences",
    differenceLines,
    "",
    "Booking URLs",
    bookingLines,
  ].join("\n");
}
