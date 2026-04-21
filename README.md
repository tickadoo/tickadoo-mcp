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

Current release: `v1.4.2`

- 17 read-only MCP tools with search, comparison, city-guide, family-day, transfer, and local travel-tip workflows
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
| `search_by_mood` | Search by emotional intent (romantic, relaxing, budget_friendly, rainy_day, adventurous, foodie) — maps mood to tags, audience, rating, setting, and price filters |
| `find_nearby_experiences` | Find experiences near lat/lng with the same 11 filters, configurable radius, and date filtering |
| `list_cities` | Browse supported cities with optional filtering and result limits |
| `check_availability` | Fast date-specific availability check for a single experience — returns matching slots, price-per-person, cheapest total for `party_size`, booking URL, and Ghost Checkout payload metadata |
| `get_experience_details` | Detailed availability, pricing, venue, and image information for a specific tickadoo experience by slug or booking path |
| `compare_experiences` | Side-by-side comparison of 2-5 experiences with winner callouts for best value, highest rated, most popular, and family fit |
| `get_whats_on_this_week` | 7-day city planner with morning/afternoon/evening breakdown |
| `whats_on_tonight` | Tonight's experiences with start-time ranking and urgency signals |
| `get_last_minute` | Experiences starting within hours, sorted by soonest |
| `get_city_guide` | Curated city overview: top highlights, category mix, pricing ranges, best-for suggestions, insider tips |
| `get_travel_tips` | Local insider advice for 20 launch cities: transport, money, safety, culture, food, emergency numbers, quick phrases |
| `get_transfer_info` | Taxi, tube/metro, bus, and train transfer estimates from a city's default airport, station, or port to hotel coordinates |
| `get_family_day` | Family day planner with age-aware filtering and geographic clustering |
| `get_related_experiences` | Blended semantic + heuristic "you might also like" results for a given experience |

All tools expose MCP tool annotations for `readOnlyHint`, `destructiveHint`, and `openWorldHint`.


### Agent Intelligence Layer

Every search response includes metadata keys designed for AI agents:

| Key | Description |
|-----|-------------|
| `_available_filters` | 12 fields: tags, audience, setting, price_range, duration_range, etc. |
| `_best_picks` | Auto-curated top 3: best_value, highest_rated, most_popular |
| `_price_tiers` | Budget/mid-range/premium grouping from result prices |
| `_group_summary` | Tag-based category breakdown (e.g. "8 Cruise, 6 GuidedTour, 5 Dining") |
| `_conversation_starters` | Context-aware prompts referencing actual products |
| `_related_searches` | Tag-based suggestions for narrowing results |
| `_next_step` | Recommended follow-up action |

`get_experience_details` adds: `_booking_urgency`, `_cross_sell`, `_intent_token`, `_accessibility`


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

### Claude Code

Remote HTTP MCP (recommended — no API key, no local install):

```bash
claude mcp add --transport http tickadoo https://mcp.tickadoo.com/mcp
```

Or add as local stdio from npm:

```bash
claude mcp add tickadoo -- npx -y @tickadoo/mcp-server
```

See https://code.claude.com/docs/en/mcp for full Claude Code MCP docs.

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
| `npm run build` | Bundle the stdio server (`dist/index.js`) via esbuild |
| `npm test` | Run the unit test suite (vitest) |
| `npm run e2e:stdio` | Run the MCP smoke suite against the local stdio server |
| `npm run e2e:http` | Run the MCP smoke suite against an HTTP endpoint |
| `npm run dev:worker` | Run the production Worker locally via `wrangler dev` |
| `npm run dev:http` | Run a plain Node HTTP dev server (uses the legacy `api/*.ts` handlers) |
| `npm run deploy` | Deploy the main MCP Worker (`wrangler deploy`) |
| `npm run deploy:widgets` | Deploy the widgets Worker under `widgets-worker/` |

## Architecture

Shared server logic lives in `src/shared/*` — API client, formatting, tool definitions, resource registration. Transport wrappers:

- `src/index.ts` — local stdio transport (published on npm as `@tickadoo/mcp-server`)
- `src/worker.ts` — Cloudflare Worker (Hono + `WebStandardStreamableHTTPServerTransport`) serving `https://mcp.tickadoo.com`
- `widgets-worker/` — separate Cloudflare Worker serving embeddable widgets at `https://widgets.tickadoo.com`

## Deployment

Both workers deploy via Cloudflare Workers:

- Main MCP worker: `wrangler.jsonc` → `mcp.tickadoo.com`
- Widgets worker: `widgets-worker/wrangler.jsonc` → `widgets.tickadoo.com`

CI: `.github/workflows/deploy-cf.yml` runs on every push to `main` and deploys both workers.

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
