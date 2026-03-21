import { MCP_BASE_URL, MCP_ENDPOINT_URL, PRODUCT_FEED_URL, SERVER_DESCRIPTION, SERVER_NAME, SERVER_VERSION } from "./config.js";

export const LLMS_URL = `${MCP_BASE_URL}/llms.txt`;
export const LLMS_FULL_URL = `${MCP_BASE_URL}/llms-full.txt`;
export const COMPANY_LLMS_URL = "https://www.tickadoo.com/llms.txt";

type ToolDoc = {
  name: string;
  summary: string;
  inputs: string[];
};

const TOOL_DOCS: ToolDoc[] = [
  {
    name: "search_experiences",
    summary: "Search tickadoo experiences by city, with fuzzy matching, live pricing, ratings, and booking links.",
    inputs: [
      "city (required): city name or slug such as london, new-york, paris, tokyo, or dubai",
      "language (optional): language code, default en",
    ],
  },
  {
    name: "find_nearby_experiences",
    summary: "Discover bookable experiences near a latitude/longitude point within a configurable radius.",
    inputs: [
      "latitude (required): decimal latitude",
      "longitude (required): decimal longitude",
      "radius_km (optional): search radius in km, default 25",
      "language (optional): language code, default en",
    ],
  },
  {
    name: "list_cities",
    summary: "List tickadoo cities with bookable inventory, sorted alphabetically with optional filtering.",
    inputs: [
      "language (optional): language code, default en",
      "query (optional): city name or slug filter",
      "limit (optional): max cities to return, default 50, max 200",
    ],
  },
  {
    name: "get_experience_details",
    summary: "Fetch venue, imagery, and availability details for a specific tickadoo experience by slug or booking path.",
    inputs: [
      "slug (preferred): tickadoo slug or booking path such as london-dungeon-tickets or /london/london-dungeon-tickets",
      "days (optional): availability horizon in days, default 30, max 180",
      "language (optional): reserved for future language-aware support, default en",
    ],
  },
];

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
    "Remote HTTP request target:",
    `- ${MCP_ENDPOINT_URL}`,
    "- Use Streamable HTTP with POST requests for tool calls",
    "- Use Accept: text/event-stream for streaming responses when needed",
    "",
    "## Notes",
    "- Do not expose supplier or provider details in user-facing output",
    "- Prefer tickadoo slugs or booking paths when chaining into get_experience_details",
    "- tickadoo booking URLs resolve to www.tickadoo.com",
  ].join("\n");
}
