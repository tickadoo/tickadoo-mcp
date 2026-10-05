# tickadoo Muse connector — evals

Status: **prepared only**. The `/mcp/agents` endpoint is not usable until it is
deployed and verified by the checks in `EVALS.md`. Do not install, connect,
submit, or claim it is available before then.

Run these checks only after Howard reports the endpoint deployed, before Meta
e2e, and after any MCP change. All commands are unauthenticated.

## 1. MCP initialize

```bash
curl -sS -X POST https://mcp.tickadoo.com/mcp/agents \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"muse-eval","version":"1.0.0"}}}'
```

Expect: `result.serverInfo.name == "tickadoo"` and `result.serverInfo.version` present.

## 2. Lion King London search

```bash
curl -sS -X POST https://mcp.tickadoo.com/mcp/agents \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_experiences","arguments":{"city":"london","query":"Lion King","limit":3}}}'
```

Expect: a result whose name contains Lion King, venue Lyceum, `booking_url` on `www.tickadoo.com`, and an opaque `product_id` with no supplier-derived prefix.

## 3. Availability

Take `product_id` from step 2.

```bash
curl -sS -X POST https://mcp.tickadoo.com/mcp/agents \
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

Expect: an error without a provisioned property. Verify the exact response during the gated eval. The connector must use `whats_on_tonight` on MCP instead.

## 6. Utterance checklist for Meta testers

| Utterance | Pass if |
|---|---|
| Get two Lion King tickets in London next Saturday | Finds the Lyceum show, checks availability, offers a tickadoo URL, does not charge |
| What is on tonight in New York? | Returns evening options, confirms before claiming bookable |
| Rainy family idea near the London Eye | Uses local/mood search, indoor-leaning, booking URL |
| Compare Wicked and Hamilton in New York | Resolves `wicked` / `hamilton`, compares live rows, availability-checks the date asked, does not invent a missing slot |
| Book me tickets | Does not ask for a card in chat; opens tickadoo |

An earlier general-surface check returned New York Wicked (`wicked`, Gershwin) and Hamilton (`hamilton`, Richard Rodgers). Do not assume the new public-agent endpoint returns them until this eval is rerun after deployment. A given evening can still be empty — pass if the agent says so and offers the next real slot or the other title; fail if it invents a Friday Hamilton time or price.

Do **not** treat NY Lion King, MJ or SIX as guaranteed-on-sale unless search returns a sellable row that night. Treat London Wicked (`wicked-tickets`) and London Hamilton (`hamilton-tickets`) as eval candidates only; do not assume either is live until search and availability checks succeed against the deployed public-agent endpoint.

## Earlier different-surface evidence

The last raw-surface pass found live Wicked and Hamilton results in New York and a live Lion King result in London. Re-run these cases against `/mcp/agents` after deployment and record only public titles, slugs, availability behavior, and booking URLs. Do not record internal or supplier-derived identifiers. `/api/connect/tonight` must still error without a property.
