import {
  MCP_BASE_URL,
  MCP_ENDPOINT_URL,
  SERVER_DESCRIPTION,
  SERVER_NAME,
  SERVER_VERSION,
} from "./config.js";

export type ToolDoc = {
  name: string;
  summary: string;
  inputs: string[];
  registryDescription?: string;
};

export const MCP_CAPABILITY_CATEGORIES = [
  "search",
  "booking",
  "recommendations",
  "itinerary-planning",
  "comparison",
  "mood-search",
] as const;

export const TOOL_DOCS: ToolDoc[] = [
  {
    name: "search_experiences",
    summary: "Search 13,090+ experiences across 681 cities with 11 filters and 6 sort options. JSON responses include _available_filters, _conversation_starters, _related_searches, and booking-ready result metadata.",
    registryDescription: "Search for bookable experiences in a specific city with optional category, price, date, audience, accessibility, and duration filtering.",
    inputs: [
      "city (required): city name or slug such as london, new-york, paris, tokyo, or dubai",
      "language (optional): supported language code for localised booking URLs, default en",
      "query (optional): free-text filter matched against experience title and description, such as ghost tour, pizza, or harry potter",
      "category (optional): theatre, musicals, tours, food, family, nightlife, sightseeing, concerts, comedy, shows, outdoor, workshops, cruises, or sports",
      "min_price / max_price (optional): minimum or maximum price in the experience's local currency",
      "dateFrom (optional): ISO start date YYYY-MM-DD; must be provided together with dateTo",
      "dateTo (optional): ISO end date YYYY-MM-DD; must be provided together with dateFrom",
      "tags, audience, setting, wheelchair_accessible, physical_level, min_duration, max_duration, available_language, min_rating, free_cancellation (optional): enrichment and accessibility filters",
      "sort (optional): relevance, popular, price_low, price_high, rating, or best_value",
      "format (optional): response format, text (default) or json",
    ],
  },
  {
    name: "search_by_mood",
    summary: "Search experiences by emotional intent instead of category. Maps moods like romantic, relaxing, foodie, or rainy_day to optimized audience, tag, setting, rating, and price filters before searching.",
    registryDescription: "Search by emotional intent, mapping moods like romantic, relaxing, foodie, or rainy_day to optimized filters before running a city search.",
    inputs: [
      "city (required): city name or slug such as london, new-york, paris, tokyo, or dubai",
      "mood (required): valid enum adventurous, romantic, relaxing, family_fun, cultural, thrill_seeking, foodie, budget_friendly, luxury, rainy_day",
      "language (optional): supported language code for localised booking URLs, default en",
      "format (optional): response format, text (default) or json",
    ],
  },
  {
    name: "get_last_minute",
    summary: "Find experiences starting within the next few hours, sorted by soonest start time. Results include countdown text like starts in 47 minutes plus urgency signals when the start is imminent or inventory is low.",
    registryDescription: "Find experiences starting within the next few hours, sorted by soonest start with countdown text and urgency signals.",
    inputs: [
      "city (required): city name or slug such as london, new-york, paris, tokyo, or dubai",
      "hours (optional): number of hours ahead to search, default 3, max 12",
      "latitude (optional): latitude for blending nearby experiences close to the user's exact location",
      "longitude (optional): longitude for blending nearby experiences close to the user's exact location",
      "language (optional): supported language code for localised booking URLs, default en",
      "format (optional): response format, text (default) or json",
    ],
  },
  {
    name: "find_nearby_experiences",
    summary: "Find experiences near coordinates with configurable radius, optional date filtering, the same enrichment filters as city search, and localised booking URLs.",
    registryDescription: "Find experiences near a geographic location using latitude, longitude, radius, and optional date filtering.",
    inputs: [
      "latitude / longitude (required): decimal coordinates to search around",
      "radius_km (optional): search radius in km, default 25",
      "dateFrom (optional): ISO start date YYYY-MM-DD; must be provided together with dateTo",
      "dateTo (optional): ISO end date YYYY-MM-DD; must be provided together with dateFrom",
      "tags, audience, setting, wheelchair_accessible, physical_level, min_duration, max_duration, available_language, min_rating, free_cancellation (optional): enrichment and accessibility filters",
      "sort (optional): relevance, popular, price_low, price_high, rating, or best_value",
      "language (optional): supported language code for localised booking URLs, default en",
      "format (optional): response format, text (default) or json",
    ],
  },
  {
    name: "list_cities",
    summary: "List tickadoo cities with bookable inventory, sorted alphabetically with optional query filtering, limits, and localised city URLs.",
    registryDescription: "Browse supported cities with optional filtering, limits, and localised booking URLs.",
    inputs: [
      "language (optional): supported language code for localised city URLs, default en",
      "query (optional): city name or slug filter",
      "limit (optional): max cities to return, default 50, max 200",
      "format (optional): response format, text (default) or json",
    ],
  },
  {
    name: "check_availability",
    summary: "Fast date-specific availability check for one experience. Returns available slots, party-size-aware totals, a booking URL, and Ghost Checkout payload metadata.",
    registryDescription: "Quick date-specific availability check for one experience, including party pricing, booking URL, and Ghost Checkout payload metadata.",
    inputs: [
      "slug (required): tickadoo slug or booking path such as london-dungeon-tickets or /london/london-dungeon-tickets",
      "date (required): ISO date YYYY-MM-DD to check, such as 2026-04-05",
      "party_size (optional): integer guest count for total pricing, default 2",
      "language (optional): supported language code for localised booking URLs, default en",
      "format (optional): response format, text (default) or json",
    ],
  },
  {
    name: "get_experience_details",
    summary: "Fetch venue, imagery, availability slots, Google Maps place IDs, booking urgency, accessibility data, and booking-ready links for a specific experience.",
    registryDescription: "Get detailed availability, pricing, venue, and image information for a specific tickadoo experience using a slug or booking path.",
    inputs: [
      "slug (preferred): tickadoo slug or booking path such as london-dungeon-tickets or /london/london-dungeon-tickets",
      "provider / provider_id (legacy fallback): hidden internal identifiers used only when a slug is unavailable",
      "days (optional): availability horizon in days, default 30, max 180",
      "language (optional): supported language code for localised booking URLs, default en",
      "format (optional): response format, text (default) or json",
    ],
  },
  {
    name: "compare_experiences",
    summary: "Compare 2-5 experiences side-by-side. JSON includes comparison rows, winner callouts (best_value, highest_rated, most_popular, best_for_families), key differences, and per-slug booking URLs.",
    registryDescription: "Compare 2-5 experiences side-by-side with clear winner callouts for price, value, popularity, family fit, and accessibility.",
    inputs: [
      "slugs (required): array of 2-5 tickadoo slugs or booking paths to compare",
      "language (optional): supported language code for localised booking URLs, default en",
      "format (optional): response format, text (default) or json",
    ],
  },
  {
    name: "get_related_experiences",
    summary: "Find up to 10 related experiences for a source slug using graph edges such as tag_overlap and spatial proximity. Returns hydrated product cards with edge type and strength metadata for cross-sell flows.",
    registryDescription: "Find related experiences for a source slug using relationship contexts such as pair, after, nearby, and similar.",
    inputs: [
      "product_id (required): source experience slug",
      "context (optional): pair, after, nearby, or similar. Default pair",
      "max_results (optional): maximum related experiences to return, default 6, max 10",
    ],
  },
  {
    name: "whats_on_tonight",
    summary: "Find experiences happening tonight in a city with start-time-aware ranking, venue context, and urgency signals for last-minute discovery.",
    registryDescription: "Find experiences happening tonight in a city, sorted for same-day discovery with timing and urgency context.",
    inputs: [
      "city (required): city name or slug such as london or new-york",
      "category (optional): narrow tonight's results to a category such as theatre, comedy, or cruises",
      "max_results (optional): maximum results to return, default 10, max 20",
      "language (optional): supported language code for localised booking URLs, default en",
      "format (optional): response format, json (default) or text",
    ],
  },
  {
    name: "get_whats_on_this_week",
    summary: "Build a 7-day city planner with a day-by-day breakdown of top experiences grouped into morning, afternoon, and evening, plus weekly highlight callouts.",
    registryDescription: "Return a day-by-day weekly calendar of what is happening in a city with morning, afternoon, and evening groupings.",
    inputs: [
      "city (required): city name or slug such as london, new-york, paris, tokyo, or dubai",
      "language (optional): supported language code for localised day names and booking URLs, default en",
      "format (optional): response format, json (default) or text",
    ],
  },
  {
    name: "get_city_guide",
    summary: "Return a curated city overview for trip planning with top 5 highlights, category counts, price range, best_for suggestions, seasonal advice, insider tips, top tags, and audience breakdown.",
    registryDescription: "Return a curated city guide with highlights, price range, category mix, best-for suggestions, and travel-planning context.",
    inputs: [
      "city (required): city name or slug such as london, prague, rome, or tokyo",
      "language (optional): supported language code for localised text, default en",
      "format (optional): response format, json (default) or text",
    ],
  },
  {
    name: "get_travel_tips",
    summary: "Return local insider advice for 20 launch cities, including transport, money, safety, culture, food, weather, language, connectivity, emergency numbers, and quick local phrases.",
    registryDescription: "Return local insider travel tips for supported cities, including emergency numbers and quick local phrases.",
    inputs: [
      "city (required): city name or slug such as london, paris, new-york, tokyo, rome, or singapore",
      "topic (optional): transport, money, safety, culture, food, weather, language, or connectivity",
      "language (optional): supported language code for consistency with other tools, default en",
      "format (optional): response format, json (default) or text",
    ],
  },
  {
    name: "get_family_day",
    summary: "Build a family day with a morning activity, lunch tip, afternoon attraction, and optional evening stop using age-aware filtering. Under 3 triggers wheelchair-accessible filtering, and the planner clusters picks geographically to reduce travel.",
    registryDescription: "Build a family day with a morning activity, lunch tip, afternoon attraction, and optional evening stop using age-aware filtering and geographic clustering.",
    inputs: [
      "city (required): city slug or name for the family day plan",
      "kids_ages (optional): array of child ages used to tune activity suitability",
      "date (optional): target date in YYYY-MM-DD format",
      "budget (optional): estimated total budget for the day",
      "language (optional): supported language code for localised booking URLs, default en",
      "format (optional): response format, json (default) or text",
    ],
  },
  {
    name: "get_transfer_info",
    summary: "Estimate airport, station, or port transfers from a city's default arrival hub to hotel coordinates. Returns taxi, tube/metro, bus, and train options with duration, estimated cost, currency, and practical directions.",
    registryDescription: "Estimate taxi, tube/metro, bus, and train transfers from a city's default airport, station, or port to hotel coordinates.",
    inputs: [
      "city (required): supported city such as London, Paris, New York, Amsterdam, Barcelona, Rome, or Tokyo",
      "from_type (required): airport, station, or port. Uses the city's default hub for that type",
      "to_latitude (required): hotel latitude",
      "to_longitude (required): hotel longitude",
      "language (optional): supported language code used for localized text and currency formatting, default en",
      "format (optional): response format, text (default) or json",
    ],
  },
];

export const MCP_PUBLIC_TOOLS = TOOL_DOCS.map(tool => ({
  name: tool.name,
  description: tool.registryDescription ?? tool.summary,
}));

export const MCP_PUBLIC_TOOL_COUNT = MCP_PUBLIC_TOOLS.length;

const AGENT_CARD_SKILLS = [
  {
    id: "search",
    name: "Search",
    description: "Search live theatre, attractions, tours, museums, and experiences by city, category, location, or date.",
    tags: ["search", "travel", "inventory"],
    examples: [
      "Find theatre tickets in London tonight",
      "Show me museums near the Eiffel Tower",
      "What can I do in Rome this weekend?",
    ],
  },
  {
    id: "booking",
    name: "Booking",
    description: "Return direct booking URLs with live pricing, availability signals, and checkout-ready context for selected experiences.",
    tags: ["booking", "tickets", "commerce"],
    examples: [
      "Give me the booking link for Moulin Rouge tickets",
      "Check availability for two people tomorrow",
    ],
  },
  {
    id: "recommendations",
    name: "Recommendations",
    description: "Recommend best-fit experiences using natural-language preferences such as audience, budget, weather, and occasion.",
    tags: ["recommendations", "ranking", "personalization"],
    examples: [
      "Plan a rainy-day family outing in Edinburgh",
      "Recommend a romantic evening in Paris under EUR 100",
    ],
  },
  {
    id: "itinerary-planning",
    name: "Itinerary Planning",
    description: "Assemble tonight, family-day, weekly, and multi-day plans with practical sequencing and booking links.",
    tags: ["itinerary", "planning", "trip"],
    examples: [
      "Plan two days in Barcelona for a couple",
      "Build a family day in London for kids aged 6 and 10",
    ],
  },
  {
    id: "comparison",
    name: "Comparison",
    description: "Compare multiple experiences side by side with clear winner callouts for value, popularity, accessibility, and family fit.",
    tags: ["comparison", "decision-support"],
    examples: [
      "Compare these three river cruises in Prague",
      "Which London musical is the best value this week?",
    ],
  },
  {
    id: "mood-search",
    name: "Mood Search",
    description: "Translate moods like romantic, adventurous, relaxing, foodie, or rainy_day into matching experiences.",
    tags: ["mood-search", "discovery"],
    examples: [
      "Find a romantic night out in Venice",
      "Show me rainy-day options in Amsterdam",
    ],
  },
] as const;

export function buildServerManifest(): Record<string, unknown> {
  return {
    $schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
    _meta: {
      "io.modelcontextprotocol.registry/publisher-provided": {
        license: "MIT",
        tools: MCP_PUBLIC_TOOLS,
      },
    },
    name: "io.github.tickadoo/tickadoo-mcp",
    title: "tickadoo - Experiences & Events",
    description: `Discover and book 13,090+ theatre, tour, attraction, and event experiences across 681 cities with ${MCP_PUBLIC_TOOL_COUNT} AI-powered tools. No API key required.`,
    websiteUrl: MCP_BASE_URL,
    repository: {
      url: "https://github.com/tickadoo/tickadoo-mcp",
      source: "github",
    },
    version: SERVER_VERSION,
    remotes: [
      {
        type: "streamable-http",
        url: MCP_ENDPOINT_URL,
      },
    ],
  };
}

export function buildAgentCard(): Record<string, unknown> {
  return {
    name: `${SERVER_NAME} MCP Server`,
    description: SERVER_DESCRIPTION,
    url: MCP_BASE_URL,
    provider: {
      organization: "tickadoo",
      url: "https://www.tickadoo.com",
    },
    version: SERVER_VERSION,
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
      supported: [...MCP_CAPABILITY_CATEGORIES],
    },
    skills: AGENT_CARD_SKILLS,
    protocols: ["mcp"],
    authentication: { schemes: [] },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["application/json"],
  };
}
