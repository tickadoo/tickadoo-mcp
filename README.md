# tickadoo® MCP Server

tickadoo® MCP Server brings live experience discovery to AI assistants through the Model Context Protocol (MCP). It gives compatible clients access to bookable theatre, shows, tours, attractions, and events across 680+ cities worldwide.

🌐 Languages: Landing page available in: EN · JA · 中文 · 한국어 · DE · FR · ES · IT · PT · tlhIngan Hol 🖖

### 日本語

tickadoo® MCPサーバーは、AIアシスタント（Claude、ChatGPT、Gemini等）から680以上の都市で13,000以上の体験（劇場、ツアー、アトラクション）を検索できます。APIキー不要、認証不要、即座に接続可能です。

[mcp.tickadoo.com](https://mcp.tickadoo.com)

### 中文

tickadoo® MCP服务器让AI助手（Claude、ChatGPT、Gemini等）可以搜索680+城市中13,000+体验活动（剧院、旅游、景点）。无需API密钥，无需认证，即时连接。

[mcp.tickadoo.com](https://mcp.tickadoo.com)

### 한국어

tickadoo® MCP 서버는 AI 어시스턴트(Claude, ChatGPT, Gemini 등)에서 680+ 도시의 13,000+ 체험(극장, 투어, 관광명소)을 검색할 수 있습니다.

[mcp.tickadoo.com](https://mcp.tickadoo.com)

Current release: `v1.4.0`

- 8 read-only MCP tools with 11 search filters + 6 sort options
- 13,090 products across 681 cities in 40+ languages
- Rule-based audience + tag enrichment (100% coverage)
- Availability slots with real dates and prices
- Booking contract with checkout deep links + Ghost Checkout
- Accessibility data for 30 London theatre venues
- Full Agent Intelligence Layer on both search tools:
  - `_available_filters` (10 fields: tag_counts, price_range, duration_range, audience, setting, physical, languages, tags, wheelchair, free_cancellation)
  - `_conversation_starters` (contextual prompts based on result data)
  - `_related_searches` (tag-based follow-up suggestions)
  - `_booking_urgency` (conversion signals: TODAY availability, free cancellation, rating, wheelchair)
  - `_cross_sell`, `_intent_token`, `_accessibility`
  - 📊 Result summary line + 🔍 filter hints in text responses
  - 🔥 Urgency signals in text detail responses
- Smart Filter Recovery (guides agents when filters are too restrictive)
- 1 machine-readable product feed resource
- Remote HTTP endpoint for hosted MCP clients
- Local stdio entrypoint for desktop and development workflows

## Tools

| Tool | Description |
|------|-------------|
| `search_experiences` | Search 13,090+ experiences across 681 cities with 11 filters (audience, setting, wheelchair, physical level, duration, language, rating, cancellation, price, tags, category) + 6 sort options (incl. best_value) |
| `search_by_mood` | Search by emotional intent instead of category. Maps moods like `romantic`, `relaxing`, `budget_friendly`, and `rainy_day` to optimized tags, audience, rating, setting, and price filters before returning booking-ready results |
| `find_nearby_experiences` | Find experiences near lat/lng with same 11 filters, configurable radius, and date filtering |
| `list_cities` | Browse supported cities with optional filtering and result limits |
| `check_availability` | Fast date-specific availability check for a single experience. Returns matching slots, price-per-person, cheapest total for `party_size`, booking URL, and Ghost Checkout payload metadata |
| `get_experience_details` | Get detailed availability, pricing, venue, and image information for a specific tickadoo experience using a slug or booking path |
| `compare_experiences` | Compare 2-5 experiences side-by-side with winner callouts for best value, highest rated, most popular, and family fit |
| `get_transfer_info` | Estimate taxi, tube/metro, bus, and train transfers from a city's default airport, station, or port to hotel coordinates |

All tools expose MCP tool annotations for `readOnlyHint`, `destructiveHint`, and `openWorldHint`.

## Resource

| Resource | Description |
|----------|-------------|
| `tickadoo://product-feed` | Machine-readable product feed in OpenAI Commerce Product Feed format |

## Connect

Hosted MCP endpoint:

`https://mcp.tickadoo.com/mcp`

### Claude / Cursor

Example remote MCP config:

```json
{
  "mcpServers": {
    "tickadoo": {
      "url": "https://mcp.tickadoo.com/mcp"
    }
  }
}
```

### Claude Dispatch

Claude Dispatch uses the same remote MCP URL config:

```json
{
  "mcpServers": {
    "tickadoo": {
      "url": "https://mcp.tickadoo.com/mcp"
    }
  }
}
```

### Gemini CLI

Add this to `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "tickadoo": {
      "httpUrl": "https://mcp.tickadoo.com/mcp"
    }
  }
}
```

### Perplexity

Use Perplexity's custom remote connector:

- Settings → Connectors → Custom connector → Remote
- Name: `tickadoo`
- MCP Server URL: `https://mcp.tickadoo.com/mcp`
- Transport: `Streamable HTTP`
- Auth: `None`
- Available to Perplexity paid subscribers

### ChatGPT

Available to ChatGPT Pro, Business, Enterprise, and Edu plans:

1. Open **Settings → Apps & Connectors → Advanced → Developer Mode ON**
2. Back in Apps & Connectors → **Create**
3. Name: `tickadoo`
4. URL: `https://mcp.tickadoo.com/mcp`
5. Auth: `None`
6. In a new chat: **+ → More → Developer Mode → Add sources → tickadoo**

### Android Studio / Firebase Studio

The same `httpUrl` config works in:

- Android Studio (`mcp.json`)
- Firebase Studio (`.idx/mcp.json` or `.gemini/settings.json`)

## Local Development And Stdio

Run from npm after publish:

```bash
npx -y @tickadoo/mcp-server
```

Example stdio config via `npx`:

```json
{
  "mcpServers": {
    "tickadoo": {
      "command": "npx",
      "args": ["-y", "@tickadoo/mcp-server"]
    }
  }
}
```

Install and build:

```bash
npm install
npm run build
```

Run the stdio server directly:

```bash
node dist/index.js
```

Example stdio config:

```json
{
  "mcpServers": {
    "tickadoo": {
      "command": "node",
      "args": ["/path/to/tickadoo-mcp/dist/index.js"]
    }
  }
}
```

## Published Links

- Landing page: [https://mcp.tickadoo.com](https://mcp.tickadoo.com)
- Remote MCP endpoint: [https://mcp.tickadoo.com/mcp](https://mcp.tickadoo.com/mcp)
- Smithery: [https://smithery.ai/server/tickadoo/tickadoo-mcp](https://smithery.ai/server/tickadoo/tickadoo-mcp)
- Glama: [https://glama.ai/mcp/servers/tickadoo/tickadoo-mcp](https://glama.ai/mcp/servers/tickadoo/tickadoo-mcp)
- mcp.so: [https://mcp.so/server/tickadoo-mcp](https://mcp.so/server/tickadoo-mcp)
- PulseMCP: [https://www.pulsemcp.com/servers/tickadoo](https://www.pulsemcp.com/servers/tickadoo)
- tickadoo: [https://www.tickadoo.com](https://www.tickadoo.com)

## Development Commands

| Command | Purpose |
|---------|---------|
| `npm run build` | Compile the TypeScript server |
| `npm run e2e:stdio` | Run the MCP smoke suite against the local stdio server |
| `npm run e2e:http` | Run the MCP smoke suite against an HTTP endpoint |
| `npm run dev:http` | Start the local HTTP development server |
| `npm run sync:html` | Sync `public/index.html` into the Vercel landing page handler |

## Architecture

Shared server logic lives in `src/shared/*`, including the API client, formatting, tool definitions, and resource registration. The two entrypoints are intentionally thin transport wrappers:

- `src/index.ts` for local stdio usage
- `api/mcp.ts` for hosted HTTP usage

This keeps stdio and HTTP behavior aligned while supporting both local and remote MCP clients.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TICKADOO_API_BASE` | `https://api.tickadoo.com` | tickadoo API base URL |
| `TICKADOO_LOG_LEVEL` | `info` | Logging verbosity: `none`, `info`, or `debug` |
| `TICKADOO_SITE_BASE` | `https://www.tickadoo.com` | tickadoo website base URL |

## Brand

tickadoo® is always lowercase. The tagline is *What Do You Wanna Doo?®*
Please preserve lowercase in all integrations and documentation.

## License

MIT — tickadoo Inc.
