# Changelog

## [1.5.0] - 2026-04-18
### Added
- MCP Apps support (GRO-229): `experience-card` and `experience-map` UI resources wired into `get_experience_details` and `find_nearby_experiences` via `_meta.ui.resourceUri`, with `openai/outputTemplate` fallback for ChatGPT Apps. Conforming clients (Claude, ChatGPT Apps, Goose, VS Code) render interactive booking cards and price-pin maps inline; non-conforming clients see the normal text and structured response. Zero new npm dependencies; Leaflet 1.9.4 is loaded from cdnjs with SRI hashes only inside the experience-map iframe.
- `tests/ui-resources.test.ts` covering URI exports, resource registration shape, and required HTML markers.

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
