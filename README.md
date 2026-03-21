# tickadoo® MCP Server

tickadoo® MCP Server brings live experience discovery to AI assistants through the Model Context Protocol (MCP). It gives compatible clients access to bookable theatre, shows, tours, attractions, and events across 700+ cities worldwide.

🌐 Languages: Landing page available in: EN · JA · 中文 · 한국어 · DE · FR · ES · IT · PT · tlhIngan Hol 🖖

### 日本語

tickadoo® MCPサーバーは、AIアシスタント（Claude、ChatGPT、Gemini等）から700以上の都市で7,700以上の体験（劇場、ツアー、アトラクション）を検索できます。APIキー不要、認証不要、即座に接続可能です。

[mcp.tickadoo.com](https://mcp.tickadoo.com)

### 中文

tickadoo® MCP服务器让AI助手（Claude、ChatGPT、Gemini等）可以搜索700+城市中7,700+体验活动（剧院、旅游、景点）。无需API密钥，无需认证，即时连接。

[mcp.tickadoo.com](https://mcp.tickadoo.com)

### 한국어

tickadoo® MCP 서버는 AI 어시스턴트(Claude, ChatGPT, Gemini 등)에서 700+ 도시의 7,700+ 체험(극장, 투어, 관광명소)을 검색할 수 있습니다.

[mcp.tickadoo.com](https://mcp.tickadoo.com)

Current release: `v1.1.0`

- 4 read-only MCP tools
- 1 machine-readable product feed resource
- Remote HTTP endpoint for hosted MCP clients
- Local stdio entrypoint for desktop and development workflows

## Tools

| Tool | Description |
|------|-------------|
| `search_experiences` | Search for bookable experiences in a specific city with city fallback matching |
| `find_nearby_experiences` | Find experiences near a geographic location using latitude, longitude, and radius |
| `list_cities` | Browse supported cities with optional filtering and result limits |
| `get_experience_details` | Get detailed availability, pricing, venue, and image information for a specific tickadoo experience using a slug or booking path |

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
