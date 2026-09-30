# tickadoo: Muse connector brief

Status: **prepared only**. The `/mcp/agents` endpoint is not usable until it is
deployed and verified by the checks in `EVALS.md`. Do not install, connect,
submit, or claim it is available before then.

Read this file first. It is the prepared contract for the official tickadoo
connector after the deployment gate passes.

Brand: write **tickadoo** in lowercase. First mention may be tickadoo®. Never invent an upstream supplier name. Checkout happens on tickadoo.com. No API key is required for discovery.

## What this service is

tickadoo is a global experience and event booking platform for West End theatre, Broadway, attractions, tours and other experiences. Users ask Muse to find something to do, check tonight, compare options, confirm a date and price, then open a booking link.

The connector does **not** take card details. Muse discovers the live tickadoo catalogue over HTTPS, confirms a slot, and hands the user the returned tickadoo booking URL. Payment and any post-purchase delivery happen outside Muse. Do not claim a ticket type or fulfilment method unless the returned payload or destination page states it.

## Connection details

Target transport for Muse is plain HTTPS against the public Connect API and the hosted MCP server. Do not claim Meta-cloud reachability until the post-deployment checks pass. No laptop process or secret is planned.

| Item | Value |
|---|---|
| Product | tickadoo |
| Company | tickadoo Inc. |
| Website | https://www.tickadoo.com |
| Privacy | https://www.tickadoo.com/privacy |
| Support | https://www.tickadoo.com/contact |
| OpenAPI | https://mcp.tickadoo.com/openapi.json |
| Agent brief (this file, raw) | https://raw.githubusercontent.com/tickadoo/tickadoo-mcp/main/connectors/muse/muse.md |
| Tool contract | The `tools/list` response from the exact MCP endpoint is authoritative |
| Short contract | https://www.tickadoo.com/llms.txt |
| MCP endpoint | https://mcp.tickadoo.com/mcp/agents |
| MCP transport | Streamable HTTP JSON-RPC |
| MCP version | Confirm from `initialize` after `/mcp/agents` deployment (protocol 2025-06-18; also 2025-11-25, 2026-07-28) |
| Auth | None. Do not invent a key. Do not ask the user for credentials to search. |
| Content-Type | application/json |
| CORS | `Access-Control-Allow-Origin: *` |
| Rate limits | Fair-use public catalogue. Retry 429 with backoff. Do not scrape. |
| Allowed hosts | `mcp.tickadoo.com`, `www.tickadoo.com`, `tickadoo.com`, `cdn.tickadoo.com`, `widgets.tickadoo.com` |

### Hatch / Muse VM rules (read this if MCP init times out)

Do not use latency or reachability observations from another MCP surface to diagnose `/mcp/agents`. After deployment, establish a clean external baseline before attributing a timeout to Muse or tickadoo. Do not write a long-lived SSE client. Do not POST to GET-only routes.

1. Call MCP with `curl` (or urllib) **HTTP/1.1**, `Connection: close`, timeout 20s.
2. Headers must be exactly:
   - `Content-Type: application/json`
   - `Accept: application/json`  (do **not** send `text/event-stream`)
   - `MCP-Protocol-Version: 2025-06-18`
3. Expect a single JSON object. Parse it and close the socket. Do not wait for SSE comments.
4. `GET https://mcp.tickadoo.com/mcp/agents` correctly returns **405** after deployment. That means the endpoint is up.
5. REST cities is **GET only**:
   - `GET https://mcp.tickadoo.com/api/cities?limit=5`
   - `GET https://mcp.tickadoo.com/api/cities/london`
   Never POST `/api/cities`.
6. If MCP POST still times out after one retry, stop the custom client and use Muse's built-in browser / `web_fetch` / curl GET against `https://www.tickadoo.com/london/the-lion-king-tickets` and quote venue + price-from from that page. Say you could not complete the live availability tool because Hatch blocked the MCP POST.
7. Never use `/api/connect/*` without a CONNECT property. Those 404 with `Property not found`.

Post-deployment verification command. Its presence here is not evidence that the endpoint is currently reachable:

```bash
curl -sS --http1.1 -m 20 -X POST 'https://mcp.tickadoo.com/mcp/agents' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -H 'MCP-Protocol-Version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"muse","version":"1.0.0"}}}'
```

Then call tools:

```bash
curl -sS --http1.1 -m 20 -X POST 'https://mcp.tickadoo.com/mcp/agents' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -H 'MCP-Protocol-Version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_experiences","arguments":{"city":"london","query":"Lion King","limit":3}}}'
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
- Typical input: `city` (slug or name). Optional: `query` (matches name/venue — good for "Lion King"), `category`, `tags`, `min_rating`, `max_price`, `limit` (1–50), `language`
- If `query` misses, the server may return city top-picks with `match_type: "fallback_city_ranked"`. Treat those as suggestions, not the thing asked for.

The pre-migration smoke test returned Disney's The Lion King at the Lyceum Theatre with a tickadoo booking URL. Re-run after `/mcp/agents` deployment and pass the returned opaque `product_id` between tools without displaying or recording it.

### 3. Recommend from natural language

Use when the user describes a feeling, audience or occasion rather than a title.

- MCP: `recommend_experiences` (`query`, optional `city`, `language`, `limit`)
- Or `search_by_mood` when the vibe is explicit (`romantic`, `family_fun`, `rainy_day`, `adventurous`, `foodie`, `luxury`, `relaxing`, `budget_friendly`)
- Keep the requested date and party size as planning constraints. Retrieve candidates first, then pass those constraints to `get_availability`; they are not inputs to `recommend_experiences`.

### 4. Tonight / last minute / this week

- Tonight: `whats_on_tonight` (`city` required)
- Next few hours: `get_last_minute` (`city`, optional `hours` 1–12)
- Coming week: `get_whats_on_this_week` (`city`)

Discovery rows are preliminary. Confirm the pick with `get_availability` before saying it is bookable tonight.

### 5. Near a place

- Named landmark / neighbourhood, no coordinates: `search_local_experiences` (`place_hint`, optional `city`, `radius_hint`)
- The public connector does not expose precise-coordinate tools. Never ask the user to type coordinates.

### 6. Product details

- MCP: `get_experience_details` with `product_id` or `slug`
- Keep venue, price-from, rating, cancellation and accessibility facts exactly as returned.

### 7. Live availability

This is the live supplier check.

- MCP: `get_availability` — prefer `product_id`; else `slug` + `city_slug`. Optional `date_from`, `date_to`, `party_size`, `fresh`
- Single date booking link: `check_availability` (`slug` as `city_slug/product_slug`, `date`, `party_size`)
- Slot `price.amount` is in **minor units**. `13125` + `GBP` means £131.25. Times are venue-local. When `timezone` is present it is an IANA name.

### 8. Hand off to book

No card data through this connector.

1. Take `booking_url` from search/details, or the date-specific URL from `check_availability`.
2. Show title, venue, date, party size and the live price you just confirmed.
3. Open the tickadoo URL in Muse's secure browser so the user can complete checkout, or offer the link.
4. After purchase, describe a ticket, QR code, wallet pass or delivery method only
   when actual checkout data returned by tickadoo explicitly states it. Otherwise
   make no fulfilment claim, and never invent an e-ticket PDF.

The public-agent contract has no payment or booking-mutation tool. Only continue to a URL returned by the read-only tools.

## Recipes

### A. "Get me Lion King tickets in London this Saturday for two"

1. `search_experiences` city=`london` query=`Lion King` limit=`5`
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
2. `compare_experiences` with each contender as `city_slug/product_slug`; every `product_slug` component must be distinct.
3. Availability-check the winner before booking.

## Rules of the road

- The public agent connection is read-only and has no feedback-submission tool. Never imply that feedback was filed or mint an internal identifier.
- Never collect card numbers, CVVs or passwords. Never store guest PII in connector memory beyond the current task.
- Guest email/name are only sent if a documented book endpoint is live for this connector and the user has approved the send. Today that path is the tickadoo website.
- State only times, prices and stock returned by the latest availability call. Do not add false scarcity.
- Do not name inventory suppliers. Present the merchant as tickadoo.
- Pass `language` only when the schema exposes it. Do not promise a localised checkout URL unless the payload includes one.
- Coverage is whatever the live catalogue returns. Do not quote stale city or product counts from memory.
- If a tool errors, say so and offer the tickadoo.com search URL for the city. Do not hallucinate inventory.

## Optional extras

MCP tools the connector may also call when they match the ask:

- `get_city_guide` (`city`, optional `language`)
- `get_travel_tips` (`city`, optional `language`); keep any requested topic as agent-side context
- `get_hidden_gems` (`city`, optional `language`, `max_results`)
- `get_family_day` (`city`, optional `date`, `language`); keep ages and budget as agent-side selection constraints
- `get_date_night` (`city`, optional `date`, `language`); keep budget as an agent-side selection constraint
- `plan_itinerary` (`city`, `days`, optional `audience`, `language`); arrange interests, budget and pace in agent reasoning over the returned flat candidates
- `get_related_experiences` (`product_id`, optional `context`, `language`, `max_results`)
- `render_experience_cards` (`experience_ids`, `render_type`) when Muse has a card renderer

Together with the calls above, these are the exact 20 tools exposed by the prepared public-agent contract. It does not expose precise-coordinate search, transfer lookup, feedback submission, payment, or booking mutation.

## Also available as MCP

Any MCP client can attach the same server:

```json
{
  "mcpServers": {
    "tickadoo": {
      "url": "https://mcp.tickadoo.com/mcp/agents"
    }
  }
}
```

Local stdio bridge: `npx -y @tickadoo/mcp-server`. Source: https://github.com/tickadoo/tickadoo-mcp
