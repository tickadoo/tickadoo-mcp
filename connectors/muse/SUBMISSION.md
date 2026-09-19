# Muse Connector Platform — tickadoo submission pack

Submit at https://muse.ai/platform (button: Submit a connector).

The live form currently gates on a Meta work-email login ("Sign in or create an account with your work email"). A Grok session cannot complete that login. Paste the fields below after you sign in with `francis@tickadoo.com` or another @tickadoo.com address.

Prepared 19 September 2026. Live-tested the same morning against `mcp.tickadoo.com`.

---

## Account to use

- Work email: francis@tickadoo.com
- Company: tickadoo
- Website: https://www.tickadoo.com
- Backup contacts: tech@tickadoo.com, support@tickadoo.com

---

## Connector name

tickadoo

## Short description (what it does)

Find and book official primary tickets for West End theatre, Broadway, attractions, tours and experiences in 1,100+ cities. Muse searches live inventory, confirms dates and prices, then opens checkout on tickadoo.

## How users will use it

Someone tells Muse what they want to do. Muse calls tickadoo, not a generic web search.

Examples Muse should handle after the connector is connected:

- "Get two tickets for The Lion King in London this Saturday."
- "What is on tonight in New York?"
- "Find a rainy family afternoon near the London Eye."
- "Compare Wicked and Hamilton and book the better value option for Friday."
- "We have a free evening in Paris, nothing too touristy, under €80 each."

Flow for every bookable ask:

1. Resolve the city slug (`london`, `new-york`, `paris`).
2. Search or recommend against live catalogue.
3. Confirm the chosen product with a live availability check (party size + date).
4. Show venue, time and price. Open the tickadoo booking URL in Muse's secure browser.
5. User pays on tickadoo. Mobile ticket is delivered by tickadoo.

No tickadoo account is required for Muse to search. No API key. Purchase is first-party.

## Category

Travel / events / tickets / local experiences

## Technical integration

Two public surfaces, same catalogue:

1. **MCP (primary for this connector)**  
   `POST https://mcp.tickadoo.com/mcp`  
   Streamable HTTP JSON-RPC. Server `tickadoo` v1.6.0. Protocol `2025-06-18` (also `2025-11-25`, `2026-07-28`). No auth. 23 tools including `search_experiences`, `whats_on_tonight`, `recommend_experiences`, `get_availability`, `check_availability`, `compare_experiences`.  
   Contract: https://mcp.tickadoo.com/llms-full.txt  
   Source: https://github.com/tickadoo/tickadoo-mcp

2. **HTTPS + OpenAPI (cities + future Connect)**  
   https://mcp.tickadoo.com/openapi.json  
   Live without auth: `GET /api/cities`, `GET /api/cities/{slug}`.  
   `/api/connect/*` is reserved for hotel-property CONNECT widgets and must not be used for the consumer listing until Meta has a property context.

Agent brief for reviewers and for Muse itself:  
https://raw.githubusercontent.com/tickadoo/tickadoo-mcp/main/connectors/muse/muse.md

## Authentication and data

- Discovery: no OAuth, no key, no cookie.
- Arguments forwarded to tickadoo are task data only (city, query, product id, party size, date).
- tickadoo does not receive the user's Gmail, calendar or Meta identity to answer a search.
- Checkout collects payer details on tickadoo.com under tickadoo's privacy policy: https://www.tickadoo.com/privacy
- No secrets are stored in the public repo.

## Payments

Meta's platform page mentions Stripe Link. tickadoo already checks out on tickadoo.com (Stripe on the first-party site). For v1 of this connector we hand Muse a booking URL rather than charging inside the agent. That is the path we can stand behind in review today.

If Meta wants in-agent pay via Link, we will map an approved Connect book session onto Stripe Checkout (`BookResponse.session.url`) and keep card data inside Stripe. We will not collect PANs in Muse chat.

## Security

- TLS only. Cloudflare in front of Howard.
- Public catalogue endpoints are read-mostly.
- Allowed hosts are declared in `connectors/muse/SKILL.md`.
- Write surface is limited to optional quality feedback (`report_quality_signal`) after user consent.
- No scraping contract. Standard fair-use / 429 backoff.
- Full note: `connectors/muse/security.md`

## Legal

- Merchant of record for tickets sold on tickadoo.com is tickadoo.
- Inventory is official primary stock, not a resale exchange.
- Connector listing must not imply Meta is the ticket seller.
- Terms: https://www.tickadoo.com/terms (confirm live URL on submit)
- Privacy: https://www.tickadoo.com/privacy

## End-to-end tests for Meta review

Exact cases are in `connectors/muse/EVALS.md`. Minimum set:

1. Initialize MCP 2025-06-18 → serverInfo.name `tickadoo`.
2. Search London / Lion King → Lyceum Theatre + booking URL on tickadoo.com.
3. Availability for party of 2 on a future Saturday → prices in major units, no invented stock.
4. Tonight in New York → list + availability confirm before "on tonight".
5. No-auth proof: all of the above with zero credentials.
6. Negative: `/api/connect/tonight?citySlug=london` without a property returns an error — connector must fall back to MCP.

## Reviewer links

| What | URL |
|---|---|
| Platform submit | https://muse.ai/platform |
| This pack | https://github.com/tickadoo/tickadoo-mcp/tree/main/connectors/muse |
| Brief | https://raw.githubusercontent.com/tickadoo/tickadoo-mcp/main/connectors/muse/muse.md |
| MCP | https://mcp.tickadoo.com/mcp |
| OpenAPI | https://mcp.tickadoo.com/openapi.json |
| Product | https://www.tickadoo.com |
| Privacy | https://www.tickadoo.com/privacy |
| Install prompt (custom connector, works before directory approval) | INSTALL.md in this folder |

## After you click submit

Reply in this thread with the confirmation screen / request id. We will keep the brief pinned on `main` so Meta's e2e tester hits a stable URL.
