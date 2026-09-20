# tickadoo Muse connector — evals

Run these before Meta e2e and after any MCP change. All commands are unauthenticated.

## 1. MCP initialize

```bash
curl -sS -X POST https://mcp.tickadoo.com/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"muse-eval","version":"1.0.0"}}}'
```

Expect: `result.serverInfo.name == "tickadoo"` and `result.serverInfo.version` present.

## 2. Lion King London search

```bash
curl -sS -X POST https://mcp.tickadoo.com/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_experiences","arguments":{"city":"london","query":"Lion King","limit":3,"format":"json"}}}'
```

Expect: a result whose name contains Lion King, venue Lyceum, `booking_url` on `www.tickadoo.com`, a stable `product_id`.

## 3. Availability

Take `product_id` from step 2.

```bash
curl -sS -X POST https://mcp.tickadoo.com/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_availability","arguments":{"product_id":"PRODUCT_ID","party_size":2,"date_from":"2026-09-26","date_to":"2026-10-10"}}}'
```

Expect: slots or a clear empty set. If `price.amount` is present, treat it as minor units.

## 4. Cities REST

```bash
curl -sS 'https://mcp.tickadoo.com/api/cities?limit=3'
curl -sS 'https://mcp.tickadoo.com/api/cities/london'
```

Expect: slugs `london` etc. City detail includes name and sample products.

## 5. Connect routes stay out of v1

```bash
curl -sS 'https://mcp.tickadoo.com/api/connect/tonight?citySlug=london&maxResults=2'
```

Expect: error (currently `Property not found`). Connector must use `whats_on_tonight` on MCP instead.

## 6. Utterance checklist for Meta testers

| Utterance | Pass if |
|---|---|
| Get two Lion King tickets in London next Saturday | Finds the Lyceum show, checks availability, offers a tickadoo URL, does not charge |
| What is on tonight in New York? | Returns evening options, confirms before claiming bookable |
| Rainy family idea near the London Eye | Uses local/mood search, indoor-leaning, booking URL |
| Compare Chicago and The Book of Mormon in New York | Uses compare path on two live BI titles, no invented prices |
| Book me tickets | Does not ask for a card in chat; opens tickadoo |

Do **not** use New York Wicked, Hamilton, Lion King, MJ or SIX as the compare pair. Those PDPs exist for SEO (`/new-york/wicked`, `/new-york/hamilton`) but MCP returns `not_found` because there is no sellable inventory. Pass if the agent says they are not bookable through this connector. Fail if it invents a Friday price.

London Wicked (`wicked-tickets`) and London Hamilton (`hamilton-tickets`) **are** live and may be used for West End evals.

## Last live pass

2026-09-19 — initialize OK; Lion King search OK (`headout-3023`, Lyceum, from GBP 43.75, booking URL live); `/api/cities` OK; `/api/connect/tonight` correctly errors without a property. NY Wicked/Hamilton MCP `not_found` confirmed same day (Nederlander wholesale still blocked).
