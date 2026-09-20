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
| Compare Chicago and The Book of Mormon in New York | Resolves both live BI titles, compare or availability-check, no invented prices |
| Compare Wicked and Hamilton in London | Resolves `wicked-tickets` and `hamilton-tickets` (West End), live prices |
| Book me tickets | Does not ask for a card in chat; opens tickadoo |

Do **not** use “Compare Wicked and Hamilton in New York” as a pass eval. Those Broadway titles have SEO pages on tickadoo.com but no sellable MCP inventory (Nederlander wholesale). A correct agent says not bookable through this connector, not “not in the catalogue.”

## Known catalogue gaps (2026-09-19)

MCP only returns sellable inventory. Website PDPs can exist without a bookable row.

Not bookable via MCP / BI (Nederlander NYC venues): Wicked (Gershwin), Hamilton (Richard Rodgers), The Lion King (Minskoff), MJ the Musical (Neil Simon), SIX (Lena Horne).

Live substitutes for NY theatre compares: Chicago (`BI-CHICAGO`), The Book of Mormon (`BI-BKMORMONTM`), Maybe Happy Ending (`BI-MAYBEHAPPY`), The Great Gatsby (`BI-GATSBY`).

Live West End substitutes: Wicked `wicked-tickets` / `Headout-3037`, Hamilton `hamilton-tickets` / `headout-16818`, Lion King `the-lion-king-tickets` / `headout-3023`.

If `search_experiences` city=`new-york` query=`Wicked` returns observation decks or an aquarium with `fuzzy_name` / `fallback_city_ranked`, treat as a miss, not the Gershwin show.

## Last live pass

2026-09-19 — initialize OK; Lion King London search OK (`headout-3023`, Lyceum, from GBP 43.75, booking URL live); `/api/cities` OK; `/api/connect/tonight` correctly errors without a property. Muse custom-skill e2e: Lion King London pass; NY tonight pass; Wicked/Hamilton NY correctly `not_found` on slug lookup.
