# tickadoo: Muse connector brief

Read this file first. It is the contract for building and running the official tickadoo connector.

Brand: write **tickadoo** in lowercase. First mention may be tickadoo®. Never invent an upstream supplier name. Tickets are official primary inventory. Checkout happens on tickadoo.com. No API key is required for discovery.

## What this service is

tickadoo is a global experience and event booking platform. It sells official primary tickets for West End theatre, Broadway, attractions, tours and experiences. Users ask Muse to find something to do, check tonight, compare options, confirm a date and price, then open a booking link.

The connector does **not** take card details. Muse discovers live inventory over HTTPS, confirms a slot, and hands the user a first-party booking URL (or a Stripe Checkout session when one is returned). Purchase and ticket fulfilment stay on tickadoo.

## Connection details

Preferred transport for Muse: plain HTTPS against the public Connect API and the hosted MCP server. Both are reachable from Meta's cloud. No laptop process. No secrets.

| Item | Value |
|---|---|
| Product | tickadoo |
| Company | tickadoo Inc. |
| Website | https://www.tickadoo.com |
| Privacy | https://www.tickadoo.com/privacy |
| Support | support@tickadoo.com |
| Partner contact | francis@tickadoo.com |
| OpenAPI | https://mcp.tickadoo.com/openapi.json |
| Agent brief (this file, raw) | https://raw.githubusercontent.com/tickadoo/tickadoo-mcp/main/connectors/muse/muse.md |
| Full tool contract | https://mcp.tickadoo.com/llms-full.txt |
| Short contract | https://www.tickadoo.com/llms.txt |
| MCP endpoint | https://mcp.tickadoo.com/mcp |
| MCP transport | Streamable HTTP JSON-RPC |
| MCP version | 1.6.0 (protocol 2025-06-18; also 2025-11-25, 2026-07-28) |
| Auth | None. Do not invent a key. Do not ask the user for credentials to search. |
| Content-Type | application/json |
| CORS | `Access-Control-Allow-Origin: *` |
| Idempotency | Optional `Idempotency-Key` on availability/book calls when the schema exposes it |
| Rate limits | Fair-use public catalogue. Retry 429 with backoff. Do not scrape. |
| Allowed hosts | `mcp.tickadoo.com`, `www.tickadoo.com`, `tickadoo.com`, `cdn.tickadoo.com`, `widgets.tickadoo.com` |

MCP initialize smoke test (verified 2026-09-19):

```http
POST https://mcp.tickadoo.com/mcp
Content-Type: application/json
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2025-06-18

{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"muse","version":"1.0.0"}}}
```

Successful `serverInfo.name` is `tickadoo`. Then `tools/list` and `tools/call`.

REST smoke test (verified 2026-09-19):

```http
GET https://mcp.tickadoo.com/api/cities?limit=5
GET https://mcp.tickadoo.com/api/cities/london
```

Hotel-property Connect routes (`/api/connect/tonight`, `/recommend`, `/discover`, `/book`) require a tickadoo CONNECT property context and return `{"error":"Property not found"}` without one. **Do not use those four routes for the consumer Muse connector.** Use MCP tools plus `booking_url` instead.

## The eight calls a connector needs

### 1. List cities

Use when the destination is unclear.

- MCP: `list_cities` with optional `country`, `limit`
- REST: `GET /api/cities?limit=50&country_code=GB`
- Always reuse the returned `slug` (`london`, `new-york`). Never invent slugs.

### 2. Search a city

Use when the user names a city plus a title, category or filter.

- MCP: `search_experiences`
- Required-enough: `city` (slug or name). Optional: `query` (matches name/venue — good for "Lion King"), `category`, `tags`, `min_rating`, `max_price`, `limit` (1–50), `language`, `format=json`
- If `query` misses, the server may return city top-picks with `match_type: "fallback_city_ranked"`. Treat those as suggestions, not the thing asked for.

Verified 2026-09-19: `search_experiences` city=`london` query=`Lion King` returns Disney's The Lion King at the Lyceum Theatre, `product_id` `headout-3023`, `booking_url` `https://www.tickadoo.com/london/the-lion-king-tickets`.

### 3. Recommend from natural language

Use when the user describes a feeling, audience or occasion rather than a title.

- MCP: `recommend_experiences` (`query`, optional `city`, `date`, `pax`)
- Or `search_by_mood` when the vibe is explicit (`romantic`, `family_fun`, `rainy_day`, `adventurous`, `foodie`, `luxury`, `relaxing`, `budget_friendly`)

### 4. Tonight / last minute / this week

- Tonight: `whats_on_tonight` (`city` required)
- Next few hours: `get_last_minute` (`city`, optional `hours` 1–12)
- Coming week: `get_whats_on_this_week` (`city`)

Discovery rows are preliminary. Confirm the pick with `get_availability` before saying it is bookable tonight.

### 5. Near a place

- Named landmark / neighbourhood, no coordinates: `search_local_experiences` (`place_hint`, optional `city`, `radius_hint`)
- Only when Muse already holds exact lat/lng from an approved location channel: `find_nearby_experiences`
- Never ask the user to type coordinates.

### 6. Product details

- MCP: `get_experience_details` with `product_id` or `slug`
- Keep venue, price-from, rating, cancellation and accessibility facts exactly as returned.

### 7. Live availability

This is the live supplier check.

- MCP: `get_availability` — prefer `product_id`; else `slug` + `city_slug`. Optional `date_from`, `date_to`, `party_size`, `fresh`
- Single date booking link: `check_availability` (`slug`, `date`, `party_size`)
- Slot `price.amount` is in **minor units**. `13125` + `GBP` means £131.25. Times are venue-local. When `timezone` is present it is an IANA name.

### 8. Hand off to book

No card data through this connector.

1. Take `booking_url` from search/details, or the date-specific URL from `check_availability`.
2. Show title, venue, date, party size and the live price you just confirmed.
3. Open the tickadoo URL in Muse's secure browser so the user can complete checkout, or offer the link.
4. After purchase, tickadoo delivers the mobile ticket on the existing first-party path (QR / wallet). Do not invent an e-ticket PDF.

If a future Connect property session is provisioned for Meta and `/api/connect/book` starts returning a Stripe Checkout `session.url`, you may open that URL instead. Until then, first-party `booking_url` is the only supported pay path.

## Recipes

### A. "Get me Lion King tickets in London this Saturday for two"

1. `search_experiences` city=`london` query=`Lion King` limit=`5` format=`json`
2. Pick the row whose name is the show, not a lookalike.
3. `get_availability` product_id from that row, party_size=`2`, date range covering the Saturday.
4. Quote the live slot price in major units. Open `booking_url` or the date-specific link.

### B. "What can we do tonight in New York?"

1. `whats_on_tonight` city=`new-york`
2. Offer 3–5 options with venue and price-from.
3. On a chosen row, `get_availability` before claiming it is on tonight.
4. Hand the booking URL.

### C. "Plan a rainy family afternoon near the London Eye"

1. `search_local_experiences` place_hint=`London Eye` city=`london` plus indoor / family bias via `search_by_mood` mood=`family_fun` or `rainy_day` if needed.
2. Confirm one pick with `get_availability`.
3. Hand the booking URL. Do not invent opening hours that were not returned.

### D. "Compare Wicked and Hamilton in New York"

1. Resolve slugs via `search_experiences`.
2. `compare_experiences` with those slugs.
3. Availability-check the winner before booking.

## Rules of the road

- Discovery is read-only. The only write tool is `report_quality_signal`, and only after the user agrees and only with a real `request_id` from a prior result (`rq_…`). Never mint an id.
- Never collect card numbers, CVVs or passwords. Never store guest PII in connector memory beyond the current task.
- Guest email/name are only sent if a documented book endpoint is live for this connector and the user has approved the send. Today that path is the tickadoo website.
- State only times, prices and stock returned by the latest availability call. Do not add false scarcity.
- Do not name inventory suppliers. Present the merchant as tickadoo.
- Prefer `format=json` when the tool exposes `format`.
- Pass `language` only when the schema exposes it. Do not promise a localised checkout URL unless the payload includes one.
- Coverage is whatever the live catalogue returns. Do not quote stale city or product counts from memory.
- If a tool errors, say so and offer the tickadoo.com search URL for the city. Do not hallucinate inventory.

## Optional extras

MCP tools the connector may also call when they match the ask: `get_city_guide`, `get_hidden_gems`, `get_family_day`, `get_date_night`, `plan_itinerary`, `get_related_experiences`, `get_travel_tips`, `get_transfer_info` (supported cities only, and only with real destination coordinates), `render_experience_cards` (if Muse has a card renderer).

## Also available as MCP

Any MCP client can attach the same server:

```json
{
  "mcpServers": {
    "tickadoo": {
      "url": "https://mcp.tickadoo.com/mcp"
    }
  }
}
```

Local stdio bridge: `npx -y @tickadoo/mcp-server`. Source: https://github.com/tickadoo/tickadoo-mcp
