import { DEFAULT_LANGUAGE } from "./config.js";

export const TRANSFER_FROM_TYPES = ["airport", "station", "port"] as const;
export type TransferFromType = (typeof TRANSFER_FROM_TYPES)[number];

export const TRANSFER_MODES = ["taxi", "tube", "bus", "train"] as const;
export type TransferMode = (typeof TRANSFER_MODES)[number];

type Coordinates = {
  latitude: number;
  longitude: number;
};

type TransferModeProfile = {
  speedKmh: number;
  baseMinutes: number;
  distanceMultiplier: number;
  baseCost: number;
  perKmCost: number;
  minCost?: number;
};

type TransferHub = Coordinates & {
  name: string;
  departureBufferMinutes: number;
};

type TransferCityProfile = {
  name: string;
  slug: string;
  aliases: string[];
  currency: string;
  metroLabel: string;
  hubs: Partial<Record<TransferFromType, TransferHub>>;
  modeProfiles: Record<TransferMode, TransferModeProfile>;
};

export type TransferOption = {
  mode: TransferMode;
  duration: string;
  estimated_cost: number;
  currency: string;
  directions_summary: string;
};

export type TransferPayload = {
  city: string;
  from_type: TransferFromType;
  origin_name: string;
  origin_coordinates: Coordinates;
  hotel_coordinates: Coordinates;
  distance_km: number;
  assumption: string;
  options: TransferOption[];
};

const TRANSFER_FROM_TYPE_SET = new Set<string>(TRANSFER_FROM_TYPES);

const TRANSFER_CITY_PROFILES: TransferCityProfile[] = [
  {
    name: "London",
    slug: "london",
    aliases: ["london", "london-uk"],
    currency: "GBP",
    metroLabel: "Tube",
    hubs: {
      airport: { name: "Heathrow Airport", latitude: 51.47, longitude: -0.4543, departureBufferMinutes: 10 },
      station: { name: "St Pancras International", latitude: 51.5319, longitude: -0.1261, departureBufferMinutes: 4 },
      port: { name: "Port of Tilbury", latitude: 51.4641, longitude: 0.2756, departureBufferMinutes: 8 },
    },
    modeProfiles: {
      taxi: { speedKmh: 34, baseMinutes: 8, distanceMultiplier: 1.22, baseCost: 8, perKmCost: 2.8, minCost: 12 },
      tube: { speedKmh: 31, baseMinutes: 12, distanceMultiplier: 1.08, baseCost: 3.2, perKmCost: 0.12, minCost: 3 },
      bus: { speedKmh: 18, baseMinutes: 14, distanceMultiplier: 1.18, baseCost: 2.2, perKmCost: 0.18, minCost: 1.75 },
      train: { speedKmh: 48, baseMinutes: 13, distanceMultiplier: 1.05, baseCost: 5.5, perKmCost: 0.45, minCost: 4 },
    },
  },
  {
    name: "Paris",
    slug: "paris",
    aliases: ["paris", "paris-france"],
    currency: "EUR",
    metroLabel: "Metro",
    hubs: {
      airport: { name: "Charles de Gaulle Airport", latitude: 49.0097, longitude: 2.5479, departureBufferMinutes: 10 },
      station: { name: "Gare du Nord", latitude: 48.8809, longitude: 2.3553, departureBufferMinutes: 4 },
      port: { name: "Port de Grenelle", latitude: 48.8515, longitude: 2.2863, departureBufferMinutes: 6 },
    },
    modeProfiles: {
      taxi: { speedKmh: 33, baseMinutes: 8, distanceMultiplier: 1.22, baseCost: 8, perKmCost: 2.3, minCost: 11 },
      tube: { speedKmh: 30, baseMinutes: 12, distanceMultiplier: 1.08, baseCost: 2.5, perKmCost: 0.35, minCost: 2.5 },
      bus: { speedKmh: 17, baseMinutes: 15, distanceMultiplier: 1.18, baseCost: 2.5, perKmCost: 0.22, minCost: 2.5 },
      train: { speedKmh: 45, baseMinutes: 13, distanceMultiplier: 1.05, baseCost: 4.5, perKmCost: 0.32, minCost: 3 },
    },
  },
  {
    name: "New York",
    slug: "new-york",
    aliases: ["new-york", "new york", "nyc", "newyork", "manhattan"],
    currency: "USD",
    metroLabel: "Subway",
    hubs: {
      airport: { name: "JFK Airport", latitude: 40.6413, longitude: -73.7781, departureBufferMinutes: 10 },
      station: { name: "Penn Station", latitude: 40.7506, longitude: -73.9935, departureBufferMinutes: 4 },
      port: { name: "Manhattan Cruise Terminal", latitude: 40.7678, longitude: -73.995, departureBufferMinutes: 7 },
    },
    modeProfiles: {
      taxi: { speedKmh: 29, baseMinutes: 10, distanceMultiplier: 1.2, baseCost: 9, perKmCost: 2.4, minCost: 12 },
      tube: { speedKmh: 28, baseMinutes: 15, distanceMultiplier: 1.08, baseCost: 2.9, perKmCost: 0.28, minCost: 2.9 },
      bus: { speedKmh: 16, baseMinutes: 16, distanceMultiplier: 1.18, baseCost: 2.9, perKmCost: 0.18, minCost: 2.9 },
      train: { speedKmh: 40, baseMinutes: 14, distanceMultiplier: 1.05, baseCost: 8, perKmCost: 0.22, minCost: 5 },
    },
  },
  {
    name: "Amsterdam",
    slug: "amsterdam",
    aliases: ["amsterdam"],
    currency: "EUR",
    metroLabel: "Metro",
    hubs: {
      airport: { name: "Schiphol Airport", latitude: 52.3105, longitude: 4.7683, departureBufferMinutes: 9 },
      station: { name: "Amsterdam Centraal", latitude: 52.3791, longitude: 4.9003, departureBufferMinutes: 4 },
      port: { name: "Passenger Terminal Amsterdam", latitude: 52.3786, longitude: 4.9229, departureBufferMinutes: 6 },
    },
    modeProfiles: {
      taxi: { speedKmh: 32, baseMinutes: 7, distanceMultiplier: 1.18, baseCost: 7.5, perKmCost: 2.6, minCost: 10 },
      tube: { speedKmh: 30, baseMinutes: 11, distanceMultiplier: 1.06, baseCost: 3.2, perKmCost: 0.15, minCost: 3 },
      bus: { speedKmh: 18, baseMinutes: 13, distanceMultiplier: 1.15, baseCost: 3.4, perKmCost: 0.16, minCost: 3 },
      train: { speedKmh: 46, baseMinutes: 11, distanceMultiplier: 1.04, baseCost: 4.2, perKmCost: 0.18, minCost: 3.5 },
    },
  },
  {
    name: "Barcelona",
    slug: "barcelona",
    aliases: ["barcelona"],
    currency: "EUR",
    metroLabel: "Metro",
    hubs: {
      airport: { name: "Barcelona El Prat Airport", latitude: 41.2974, longitude: 2.0833, departureBufferMinutes: 9 },
      station: { name: "Barcelona Sants", latitude: 41.3791, longitude: 2.1409, departureBufferMinutes: 4 },
      port: { name: "Port de Barcelona", latitude: 41.3633, longitude: 2.1721, departureBufferMinutes: 6 },
    },
    modeProfiles: {
      taxi: { speedKmh: 31, baseMinutes: 7, distanceMultiplier: 1.18, baseCost: 7.5, perKmCost: 2.2, minCost: 10 },
      tube: { speedKmh: 29, baseMinutes: 12, distanceMultiplier: 1.07, baseCost: 2.5, perKmCost: 0.12, minCost: 2.5 },
      bus: { speedKmh: 17, baseMinutes: 14, distanceMultiplier: 1.16, baseCost: 2.6, perKmCost: 0.14, minCost: 2.6 },
      train: { speedKmh: 43, baseMinutes: 11, distanceMultiplier: 1.04, baseCost: 3.2, perKmCost: 0.16, minCost: 3 },
    },
  },
  {
    name: "Rome",
    slug: "rome",
    aliases: ["rome", "roma"],
    currency: "EUR",
    metroLabel: "Metro",
    hubs: {
      airport: { name: "Fiumicino Airport", latitude: 41.8003, longitude: 12.2389, departureBufferMinutes: 10 },
      station: { name: "Roma Termini", latitude: 41.901, longitude: 12.5018, departureBufferMinutes: 4 },
      port: { name: "Port of Civitavecchia", latitude: 42.0924, longitude: 11.7954, departureBufferMinutes: 8 },
    },
    modeProfiles: {
      taxi: { speedKmh: 30, baseMinutes: 8, distanceMultiplier: 1.2, baseCost: 8.5, perKmCost: 1.9, minCost: 12 },
      tube: { speedKmh: 27, baseMinutes: 14, distanceMultiplier: 1.08, baseCost: 3, perKmCost: 0.18, minCost: 1.5 },
      bus: { speedKmh: 16, baseMinutes: 15, distanceMultiplier: 1.18, baseCost: 2, perKmCost: 0.15, minCost: 1.5 },
      train: { speedKmh: 42, baseMinutes: 13, distanceMultiplier: 1.05, baseCost: 5, perKmCost: 0.26, minCost: 2.5 },
    },
  },
  {
    name: "Tokyo",
    slug: "tokyo",
    aliases: ["tokyo", "tokio"],
    currency: "JPY",
    metroLabel: "Metro",
    hubs: {
      airport: { name: "Haneda Airport", latitude: 35.5494, longitude: 139.7798, departureBufferMinutes: 10 },
      station: { name: "Tokyo Station", latitude: 35.6812, longitude: 139.7671, departureBufferMinutes: 4 },
      port: { name: "Tokyo International Cruise Terminal", latitude: 35.6246, longitude: 139.7756, departureBufferMinutes: 7 },
    },
    modeProfiles: {
      taxi: { speedKmh: 32, baseMinutes: 8, distanceMultiplier: 1.18, baseCost: 800, perKmCost: 380, minCost: 1500 },
      tube: { speedKmh: 31, baseMinutes: 13, distanceMultiplier: 1.07, baseCost: 180, perKmCost: 15, minCost: 180 },
      bus: { speedKmh: 18, baseMinutes: 15, distanceMultiplier: 1.16, baseCost: 210, perKmCost: 18, minCost: 210 },
      train: { speedKmh: 50, baseMinutes: 12, distanceMultiplier: 1.04, baseCost: 240, perKmCost: 24, minCost: 200 },
    },
  },
];

function normalizeCityKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundDurationMinutes(value: number): number {
  return Math.max(5, Math.round(value / 5) * 5);
}

function roundCost(currency: string, value: number): number {
  if (currency === "JPY") {
    return Math.round(value / 100) * 100;
  }

  return Math.round(value * 2) / 2;
}

function haversineDistanceKm(origin: Coordinates, destination: Coordinates): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(destination.latitude);

  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(originLatitude) * Math.cos(destinationLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDuration(durationMinutes: number): string {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  if (hours <= 0) {
    return `${durationMinutes} min`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

function formatCurrency(amount: number, currency: string, language = DEFAULT_LANGUAGE): string {
  try {
    return new Intl.NumberFormat(language, {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "JPY" ? 0 : 2,
    }).format(amount);
  } catch {
    return currency === "JPY"
      ? `${currency} ${Math.round(amount)}`
      : `${currency} ${amount.toFixed(2)}`;
  }
}

function buildDirectionsSummary(
  profile: TransferCityProfile,
  hub: TransferHub,
  mode: TransferMode,
): string {
  switch (mode) {
    case "taxi":
      return `Door-to-door from ${hub.name}. Best if you have luggage or want the simplest transfer into ${profile.name}.`;
    case "tube":
      return `Take the ${profile.metroLabel.toLowerCase()} from ${hub.name} toward central ${profile.name}, then walk or switch for the hotel area.`;
    case "bus":
      return `Budget-friendly public transport from ${hub.name}. Expect more stops and a longer journey, but usually the cheapest shared option.`;
    case "train":
      return `Use the main rail link from ${hub.name} toward central ${profile.name}, then change or walk for the final stretch to the hotel.`;
    default:
      return `Travel from ${hub.name} to the hotel in ${profile.name}.`;
  }
}

export function getSupportedTransferCities(): string[] {
  return TRANSFER_CITY_PROFILES.map(profile => profile.name);
}

export function resolveTransferCity(city: string): TransferCityProfile | undefined {
  const normalizedCity = normalizeCityKey(city);
  if (!normalizedCity) {
    return undefined;
  }

  return TRANSFER_CITY_PROFILES.find(profile => {
    const aliases = [profile.slug, profile.name, ...profile.aliases].map(normalizeCityKey);
    return aliases.includes(normalizedCity);
  });
}

export function isTransferFromType(value: unknown): value is TransferFromType {
  return typeof value === "string" && TRANSFER_FROM_TYPE_SET.has(value);
}

export function buildTransferPayload(input: {
  city: string;
  fromType: TransferFromType;
  toLatitude: number;
  toLongitude: number;
}): TransferPayload {
  const profile = resolveTransferCity(input.city);
  if (!profile) {
    throw new Error(`Transfer guidance is currently available for ${getSupportedTransferCities().join(", ")}.`);
  }

  const hub = profile.hubs[input.fromType];
  if (!hub) {
    const supportedTypes = Object.keys(profile.hubs).join(", ");
    throw new Error(`No ${input.fromType} hub is configured for ${profile.name}. Supported types for this city: ${supportedTypes}.`);
  }

  const hotelCoordinates = {
    latitude: input.toLatitude,
    longitude: input.toLongitude,
  };
  const directDistanceKm = haversineDistanceKm(hub, hotelCoordinates);

  const options = TRANSFER_MODES.map((mode): TransferOption => {
    const modeProfile = profile.modeProfiles[mode];
    const routeDistanceKm = directDistanceKm * modeProfile.distanceMultiplier;
    const estimatedMinutes = roundDurationMinutes(
      hub.departureBufferMinutes + modeProfile.baseMinutes + ((routeDistanceKm / modeProfile.speedKmh) * 60),
    );
    const estimatedCost = roundCost(
      profile.currency,
      Math.max(
        modeProfile.minCost ?? 0,
        modeProfile.baseCost + (routeDistanceKm * modeProfile.perKmCost),
      ),
    );

    return {
      mode,
      duration: formatDuration(estimatedMinutes),
      estimated_cost: estimatedCost,
      currency: profile.currency,
      directions_summary: buildDirectionsSummary(profile, hub, mode),
    };
  });

  return {
    city: profile.name,
    from_type: input.fromType,
    origin_name: hub.name,
    origin_coordinates: {
      latitude: hub.latitude,
      longitude: hub.longitude,
    },
    hotel_coordinates: hotelCoordinates,
    distance_km: roundToOneDecimal(directDistanceKm),
    assumption: `Using ${hub.name} as the default ${input.fromType} hub for ${profile.name}.`,
    options,
  };
}

export function formatTransferInfo(payload: TransferPayload, language = DEFAULT_LANGUAGE): string {
  const lines = [
    `Transfer options from ${payload.origin_name} to your hotel in ${payload.city}`,
    `Approximate straight-line distance: ${payload.distance_km} km`,
    payload.assumption,
    "",
    ...payload.options.flatMap(option => [
      `${option.mode.toUpperCase()} — ${option.duration} — ${formatCurrency(option.estimated_cost, option.currency, language)}`,
      `  ${option.directions_summary}`,
      "",
    ]),
  ];

  return lines.join("\n").trim();
}
