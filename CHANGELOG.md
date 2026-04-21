# Changelog

## [Unreleased]
### Security
- Admin telemetry routes (`/admin/telemetry`, `/admin/telemetry.json`) now require `Authorization: Bearer $ADMIN_TOKEN` with a constant-time compare. Missing secret returns 503 to fail closed.
- Scrub telemetry `input_args` against a whitelist of tool-parameter keys before persisting to Neon; freetext dropped, strings capped at 120 chars, arrays at 10, nested objects dropped.
- Rewrite `src/shared/neon.ts` to use the official `@neondatabase/serverless` client with `.query(text, params)`. The previous custom wrapper sent the full connection string as a request header on every query.
- Remove the module-level `cachedConnectionString` global; the Worker now builds a per-request Neon client from `c.env.NEON_URL` and plumbs it through `createTickadooServer({ neonClient })`.
- Content-Security-Policy header added to `/agentx` and `/admin/telemetry`.
- Fix XSS in telemetry dashboard error branch (replace `insertAdjacentHTML` with `textContent`).
- `widgets-worker`: validate `context` against an exact allowlist and enforce `/^[a-z0-9-]{1,200}$/` on `slug`/`city` before forwarding to MCP.
- Generic `"Database configuration error."` on malformed `NEON_URL` (no internal URL in error response).

### Changed
- `wrangler.toml` → `wrangler.jsonc` (main + widgets-worker), aligned with the frontend repo patterns: `$schema`, `account_id`, `observability`, `workers_dev`, `preview_urls`, `routes` with `custom_domain`. Compat date bumped to `2026-03-10`.
- `SERVER_VERSION` synced to `1.5.0` (was `1.4.2`); `server.json` version synced; `.claude-plugin/plugin.json` version synced.
- Tool-count drift fixed across docs, package.json, skill, plugin: `14` → `15`. `discovery.ts` description now interpolates `MCP_PUBLIC_TOOL_COUNT`.
- `server.json` tools list trimmed to the 15 actually-registered tools (dropped phantom `recommend_experiences`, `get_categories`, `plan_itinerary`).

### Removed
- Legacy Vercel surface: `vercel.json`, `tsconfig.vercel.json`, `scripts/sync-html.mjs`, `public/index.html`, `Dockerfile`.
- Legacy Node HTTP handlers in `api/` and `scripts/dev-http.ts`; discovery tests rewritten against the Worker via `app.request()`.
- `admin/telemetry.html` orphan (the live dashboard is served by the Worker from `src/shared/telemetry-dashboard.ts`).
- `dev:http` npm script.

### Added
- Worker route tests (`tests/worker-routes.test.ts`): /health, /robots.txt, /sitemap.xml, /agentx CSP, /.well-known/mcp.json, /mcp OPTIONS + GET fallback, 404 for unknown paths, full /admin auth matrix.
- Telemetry scrub tests (`tests/telemetry-scrub.test.ts`).
- Widgets input-validation tests (`widgets-worker/tests/validation.test.ts`).
- `npm run deploy` and `npm run deploy:widgets` scripts.

## [1.5.0] - 2026-04-18
### Added
- MCP Apps support (GRO-229): `experience-card` and `experience-map` UI resources wired into `get_experience_details` and `find_nearby_experiences` via `_meta.ui.resourceUri`, with `openai/outputTemplate` fallback for ChatGPT Apps. Conforming clients (Claude, ChatGPT Apps, Goose, VS Code) render interactive booking cards and price-pin maps inline; non-conforming clients see the normal text and structured response. Zero new npm dependencies; Leaflet 1.9.4 is loaded from cdnjs with SRI hashes only inside the experience-map iframe.
- Resources served with the MCP Apps standard MIME type `text/html;profile=mcp-app` (exported as `MCP_APP_MIME_TYPE`). Hosts only enable the sandbox bridge for this exact MIME, so plain `text/html` would not render inline.
- Per-resource `_meta.ui` metadata: `prefersBorder: false` on the card (it styles its own border), `prefersBorder: true` plus a CSP `resourceDomains` allowlist on the map for `https://cdnjs.cloudflare.com` and the four CARTO basemap subdomains.
- Optional ChatGPT `openai/toolInvocation/invoking` and `openai/toolInvocation/invoked` hints on both tool descriptors (ignored safely by conforming MCP Apps clients).
- UTM attribution on every booking URL emitted by the widgets (`utm_source=mcp`, `utm_medium=mcp-app`, `utm_campaign=experience-card|experience-map`) so bookings originating in Claude / ChatGPT / Goose are attributable in web analytics.
- `tests/ui-resources.test.ts` covering URI exports, standard MIME type, registration shape, dual-key `uiMeta` payload, optional invocation hints, CSP allowlist, UTM markers, and required HTML markers.

## [1.4.1] - 2026-03-30
### Added
- `get_travel_tips` MCP tool for local insider advice across 20 launch cities
- Hardcoded emergency numbers and quick local phrases for supported destinations
- Unit tests for the travel tips payload, formatting, discovery metadata, and MCP tool handler

## [1.4.0] - 2026-03-30
### Added
- `check_availability` MCP tool for fast date-specific availability checks by slug + date + party size
- `get_transfer_info` MCP tool for airport/station/port-to-hotel transport estimates using default city arrival hubs
- Date-specific booking payload with slot pricing, cheapest party total, prefilled booking URL, and Ghost Checkout intent-token metadata
- Unit tests for availability payload generation, party-total calculation, transfer estimation, and llms documentation updates

## [1.2.0] - 2026-03-27
### Added
- Optional `dateFrom` / `dateTo` filtering for `search_experiences`
- Optional `dateFrom` / `dateTo` filtering for `find_nearby_experiences`
- Date-filtered MCP routing through the private `/integrations-api/v1.0/mcp/products` endpoint
- E2E and API regression coverage for dated searches and cached no-date behavior

### Changed
- `llms-full.txt` tool docs and capabilities now describe date filtering support

## [1.1.0] - 2026-03-21
### Added
- Rotating hero words on landing page
- Perplexity + Gemini CLI setup instructions in README
- Tabbed Connect section with multi-client config blocks
- llms.txt and llms-full.txt endpoints
- Tool annotations (`readOnlyHint`, `destructiveHint`, `openWorldHint`)
- Search result ranking (priced first, then by rating)
- `server.json` for official MCP registry
- `Content-Security-Policy` header

### Changed
- Custom domain: `mcp.tickadoo.com`
- Shared module architecture (`src/shared/*`)
- Smooth word rotation animation on landing page

## [1.0.0] - 2026-03-20
### Added
- Initial release with 4 MCP tools
- `search_experiences`, `find_nearby_experiences`, `list_cities`, `get_experience_details`
- Stdio and HTTP transport support
- Fuzzy city matching
- Image URLs in results
