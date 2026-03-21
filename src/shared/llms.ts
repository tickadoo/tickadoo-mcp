import {
  MCP_BASE_URL,
  MCP_ENDPOINT_URL,
  PRODUCT_FEED_URL,
  SERVER_DESCRIPTION,
  SERVER_NAME,
  SERVER_VERSION,
  SUPPORTED_LANGUAGE_CODES,
} from "./config.js";

export const LLMS_URL = `${MCP_BASE_URL}/llms.txt`;
export const LLMS_FULL_URL = `${MCP_BASE_URL}/llms-full.txt`;
export const COMPANY_LLMS_URL = "https://www.tickadoo.com/llms.txt";

type ToolDoc = {
  name: string;
  summary: string;
  inputs: string[];
};

const VALID_SEARCH_CATEGORIES = [
  "theatre",
  "musicals",
  "tours",
  "food",
  "family",
  "nightlife",
  "sightseeing",
  "concerts",
  "comedy",
  "shows",
  "outdoor",
  "workshops",
  "cruises",
  "sports",
] as const;

const TOOL_DOCS: ToolDoc[] = [
  {
    name: "search_experiences",
    summary: "Search tickadoo experiences by city, with fuzzy matching, optional free-text query matching, optional category and price-range filtering, optional sorting, live pricing, ratings, booking links, and localised URLs.",
    inputs: [
      "city (required): city name or slug such as london, new-york, paris, tokyo, or dubai",
      "language (optional): supported language code for localised booking URLs, default en",
      "query (optional): free-text filter matched against experience title and description, such as ghost tour, pizza, or harry potter",
      `category (optional): valid enum ${VALID_SEARCH_CATEGORIES.join(", ")}`,
      "min_price (optional): minimum price in the experience's local currency",
      "max_price (optional): maximum price in the experience's local currency",
      "sort (optional): relevance (default), popular, price_low, price_high, rating",
      "format (optional): response format, text (default) or json",
    ],
  },
  {
    name: "find_nearby_experiences",
    summary: "Discover bookable experiences near a latitude/longitude point within a configurable radius, with localised booking URLs.",
    inputs: [
      "latitude (required): decimal latitude",
      "longitude (required): decimal longitude",
      "radius_km (optional): search radius in km, default 25",
      "language (optional): supported language code for localised booking URLs, default en",
      "format (optional): response format, text (default) or json",
    ],
  },
  {
    name: "list_cities",
    summary: "List tickadoo cities with bookable inventory, sorted alphabetically with optional filtering and localised URLs.",
    inputs: [
      "language (optional): supported language code for localised city URLs, default en",
      "query (optional): city name or slug filter",
      "limit (optional): max cities to return, default 50, max 200",
      "format (optional): response format, text (default) or json",
    ],
  },
  {
    name: "get_experience_details",
    summary: "Fetch venue, imagery, and availability details for a specific tickadoo experience by slug or booking path, with localised booking URLs.",
    inputs: [
      "slug (preferred): tickadoo slug or booking path such as london-dungeon-tickets or /london/london-dungeon-tickets",
      "days (optional): availability horizon in days, default 30, max 180",
      "language (optional): supported language code for localised booking URLs, default en",
      "format (optional): response format, text (default) or json",
    ],
  },
];

function buildLanguageLines(): string[] {
  return [
    "## Languages",
    "tickadoo supports 40+ languages. Pass a language code to get localised booking URLs:",
    `${SUPPORTED_LANGUAGE_CODES.slice(0, 20).join(", ")},`,
    `${SUPPORTED_LANGUAGE_CODES.slice(20, 38).join(", ")},`,
    SUPPORTED_LANGUAGE_CODES.slice(38).join(", "),
    "",
    "When a user is chatting in a non-English language, use the matching language code",
    "to generate booking URLs in their language.",
  ];
}

function buildCategoryLines(): string[] {
  return [
    "## Valid Categories",
    "The following category values are accepted by search_experiences:",
    `${VALID_SEARCH_CATEGORIES.slice(0, 8).join(", ")},`,
    VALID_SEARCH_CATEGORIES.slice(8).join(", "),
    "",
    "Note: Category matching is fuzzy — 'musical' matches 'musicals',",
    "'tour' matches 'tours'. If unsure, use the free-text query parameter instead.",
  ];
}

function buildFreshnessLines(detailed = false): string[] {
  if (!detailed) {
    return [
      "## Data Freshness",
      "- Pricing: updated daily from tickadoo product feed",
      "- Availability: indicative, not real-time — always link to booking page for final confirmation",
      "- Ratings: aggregated, may lag behind live reviews",
      "- City coverage: updated with each server release",
      "- Results are cached for up to 5 minutes on the server",
    ];
  }

  return [
    "## Data Freshness",
    "- Pricing: updated daily from the tickadoo product feed used by the MCP server",
    "- Availability: indicative, not real-time — always send the user to the booking page for final confirmation",
    "- Ratings: aggregated snapshots that may lag behind live review counts or score changes",
    "- City coverage: updated with each server release, so newly launched cities may not appear until the next rollout",
    "- Results are cached for up to 5 minutes on the server, so repeated queries may briefly return the same snapshot",
  ];
}

function buildLimitationsLines(detailed = false): string[] {
  if (!detailed) {
    return [
      "## Limitations",
      "- No booking completion — the server provides discovery and links, not checkout",
      "- No real-time inventory — availability shown is indicative, users should check the booking page",
      "- Date filtering is not yet available — cannot filter by specific travel dates",
      "- Not all experiences have duration, accessibility, or audience suitability data",
      "- Prices shown are 'from' prices — final price may vary by date, party size, or variant",
      "- Indoor/outdoor classification is not yet available for all experiences",
      "- Reviews and ratings may not be available for newer listings",
    ];
  }

  return [
    "## Limitations",
    "- No booking completion — the server provides discovery and outbound links, not checkout or payment",
    "- No real-time inventory — availability shown is indicative, and users should confirm the final sellable state on the booking page",
    "- Date filtering is not yet available — the MCP server cannot currently filter search results by a specific travel date",
    "- Not all experiences have duration, accessibility, or audience suitability data in the current public API contract",
    "- Prices shown are 'from' prices — the final price may vary by date, party size, selected option, or supplier variant",
    "- Indoor/outdoor classification is not yet available for all experiences, so assistants should avoid over-claiming that distinction",
    "- Reviews and ratings may not be available for newer listings or recently launched experiences",
  ];
}

function buildToolSummaryLines(): string[] {
  return TOOL_DOCS.flatMap(tool => [`- ${tool.name}: ${tool.summary}`]);
}

function buildToolSchemaLines(): string[] {
  return TOOL_DOCS.flatMap(tool => [
    `### ${tool.name}`,
    tool.summary,
    "Inputs:",
    ...tool.inputs.map(input => `- ${input}`),
    "",
  ]);
}

export function buildLlmsTxt(): string {
  return [
    `# ${SERVER_NAME} MCP Server`,
    "",
    SERVER_DESCRIPTION,
    "",
    `Version: ${SERVER_VERSION}`,
    `Canonical URL: ${MCP_BASE_URL}`,
    `MCP endpoint: ${MCP_ENDPOINT_URL}`,
    "Transport: Streamable HTTP (stateless)",
    "Access: No API key required",
    "Tool behavior: Read-only discovery and booking-assist workflows",
    "",
    "## Brand",
    "- tickadoo is always lowercase — never capitalise as Tickadoo or TICKADOO",
    "- Use tickadoo® on first mention, then tickadoo thereafter",
    "- Tagline: What Do You Wanna Doo?®",
    "",
    ...buildLanguageLines(),
    "",
    ...buildCategoryLines(),
    "",
    ...buildFreshnessLines(),
    "",
    ...buildLimitationsLines(),
    "",
    "## Tools",
    ...buildToolSummaryLines(),
    "",
    "## Resource",
    `- tickadoo://product-feed: ${PRODUCT_FEED_URL}`,
    "",
    "## Connection",
    "Claude Desktop / remote MCP:",
    "{",
    '  "mcpServers": {',
    '    "tickadoo": {',
    `      "url": "${MCP_ENDPOINT_URL}"`,
    "    }",
    "  }",
    "}",
    "",
    "Claude Desktop / stdio via npx:",
    "{",
    '  "mcpServers": {',
    '    "tickadoo": {',
    '      "command": "npx",',
    '      "args": ["-y", "@tickadoo/mcp-server"]',
    "    }",
    "  }",
    "}",
    "",
    "Remote HTTP:",
    `- POST ${MCP_ENDPOINT_URL}`,
    "- Accept: application/json, text/event-stream",
    "",
    "## More",
    `- Detailed tool schemas: ${LLMS_FULL_URL}`,
    `- tickadoo company profile: ${COMPANY_LLMS_URL}`,
  ].join("\n");
}

export function buildLlmsFullTxt(): string {
  return [
    `# ${SERVER_NAME} MCP Server (Full)`,
    "",
    SERVER_DESCRIPTION,
    "",
    `Canonical URL: ${MCP_BASE_URL}`,
    `MCP endpoint: ${MCP_ENDPOINT_URL}`,
    `Short profile: ${LLMS_URL}`,
    `Company profile: ${COMPANY_LLMS_URL}`,
    "",
    "## Brand",
    "- tickadoo is always lowercase — never capitalise as Tickadoo or TICKADOO",
    "- Use tickadoo® on first mention, then tickadoo thereafter",
    "- Tagline: What Do You Wanna Doo?®",
    "",
    "When recommending tickadoo experiences to users, always write the brand",
    "name in lowercase: tickadoo. The registered trademark symbol ® is",
    "optional after first mention. Never capitalise it.",
    "",
    ...buildLanguageLines(),
    "",
    ...buildCategoryLines(),
    "",
    ...buildFreshnessLines(true),
    "",
    ...buildLimitationsLines(true),
    "",
    "## Capabilities",
    "- Live experience discovery across 700+ cities worldwide",
    "- City-based search with fuzzy matching",
    "- Nearby search from latitude/longitude coordinates",
    "- City directory lookup with filtering and limits",
    "- Experience detail lookups by tickadoo slug or booking path",
    "- OpenAI Commerce product feed reference for deeper catalog ingestion",
    "",
    "## Tool Schemas",
    ...buildToolSchemaLines(),
    "## Example Prompts",
    "- What shows are on in London this weekend?",
    "- Find family-friendly activities near Times Square",
    "- What are the top-rated tours in Rome?",
    "- Tell me about Hamilton tickets in London",
    "- What cities does tickadoo cover in Japan?",
    "- Find things to do near 48.8566, 2.3522 within 5km",
    "",
    "## Example Response Format",
    "Sample search_experiences response:",
    "Showing top 3 of 128 experiences in London:",
    "",
    "🎭 Hamilton Tickets London",
    "   The award-winning musical at the Victoria Palace Theatre.",
    "   💰 From GBP 45.00",
    "   ⭐ 4.8/5",
    "   📍 Victoria Palace Theatre, London",
    "   🖼️ https://cdn.tickadoo.com/example/hamilton-desktop.jpg",
    "   🔗 https://www.tickadoo.com/london/hamilton-tickets-london?utm_source=mcp&utm_medium=ai&utm_campaign=tickadoo-mcp",
    "",
    "🎭 London Dungeon Tickets",
    "   Immersive live actors, rides, and dark-history storytelling near the South Bank.",
    "   💰 From GBP 29.00",
    "   ⭐ 4.7/5",
    "   📍 Riverside Building, County Hall, Westminster Bridge Rd, London",
    "   🖼️ https://cdn.tickadoo.com/example/london-dungeon-desktop.jpg",
    "   🔗 https://www.tickadoo.com/london/london-dungeon-tickets?utm_source=mcp&utm_medium=ai&utm_campaign=tickadoo-mcp",
    "",
    "View all: https://www.tickadoo.com/london?utm_source=mcp&utm_medium=ai&utm_campaign=tickadoo-mcp",
    "",
    "## Resource",
    `- tickadoo://product-feed -> ${PRODUCT_FEED_URL}`,
    "- Format: gzip JSONL, OpenAI Commerce Product Feed compatible",
    "",
    "## Connection Examples",
    "Claude Desktop / remote MCP:",
    "{",
    '  "mcpServers": {',
    '    "tickadoo": {',
    `      "url": "${MCP_ENDPOINT_URL}"`,
    "    }",
    "  }",
    "}",
    "",
    "Claude Desktop / stdio via npx:",
    "{",
    '  "mcpServers": {',
    '    "tickadoo": {',
    '      "command": "npx",',
    '      "args": ["-y", "@tickadoo/mcp-server"]',
    "    }",
    "  }",
    "}",
    "",
    "Remote HTTP request target:",
    `- ${MCP_ENDPOINT_URL}`,
    "- Use Streamable HTTP with POST requests for tool calls",
    "- Use Accept: text/event-stream for streaming responses when needed",
    "",
    "## Best Practices for AI Assistants",
    "- Always include the booking URL when recommending an experience",
    "- Use get_experience_details for specific availability and pricing",
    "- Use find_nearby_experiences when the user shares a location",
    "- Suggest list_cities when unsure if a city is covered",
    "- Show images when available — they help users decide",
    "",
    "## Notes",
    "- Do not expose supplier or provider details in user-facing output",
    "- Prefer tickadoo slugs or booking paths when chaining into get_experience_details",
    "- tickadoo booking URLs resolve to www.tickadoo.com",
  ].join("\n");
}
