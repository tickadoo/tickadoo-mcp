# Muse Connector Platform — tickadoo submission pack

Status: **prepared only**. The `/mcp/agents` endpoint is not usable until it is
deployed and verified by the checks in `EVALS.md`. Do not install, connect,
submit, or claim it is available before then.

After that gate passes, submit at https://muse.ai/platform (button: Submit a
connector). The form requires a Meta work-email login. Paste the fields below
only after an authorized tickadoo submitter signs in; do not store their name
or account address in this repository.

Prepared 19 September 2026. Any earlier live checks covered a different MCP
surface and are not evidence that `/mcp/agents` is available.

---

## Account requirements

- Submitter: an authorized tickadoo employee using their own work account
- Company: tickadoo
- Website: https://www.tickadoo.com
- Public support: https://www.tickadoo.com/contact

---

## Connector name

tickadoo

## Short description (what it does)

Discover theatre, attractions, tours and experiences, compare grounded options,
check live dates and prices, then continue to checkout on tickadoo.com.

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
5. User pays on tickadoo. Describe a ticket, QR code, wallet pass or delivery
   method only when actual checkout data returned by tickadoo explicitly states it;
   otherwise make no fulfilment claim.

No tickadoo account is required for Muse to search. No API key. Purchase
continues on tickadoo.com.

## Category

Travel / events / tickets / local experiences

## Technical integration

Two public surfaces, same catalogue:

1. **MCP (primary for this connector)**
   `POST https://mcp.tickadoo.com/mcp/agents`
   Streamable HTTP JSON-RPC. Protocol `2025-06-18` (also `2025-11-25`, `2026-07-28`). No auth. 20 read-only tools including `search_experiences`, `whats_on_tonight`, `recommend_experiences`, `get_availability`, `check_availability`, `compare_experiences`. Confirm the live server version before submission.
   Contract: the endpoint's `tools/list` response is authoritative for its 20 read-only schemas.
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
- The public agent endpoint is read-only.
- Allowed hosts are declared in `connectors/muse/SKILL.md`.
- No write or feedback-submission tool is exposed.
- No scraping contract. Standard fair-use / 429 backoff.
- Full note: `connectors/muse/security.md`

## Legal

- Confirm merchant-of-record and inventory-source wording with the current
  product/legal owner before submission; repository metadata cannot attest to
  those commercial facts.
- Do not describe every item as primary, official or non-resale unless that
  statement has been verified for the submitted catalogue.
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
| MCP | https://mcp.tickadoo.com/mcp/agents |
| OpenAPI | https://mcp.tickadoo.com/openapi.json |
| Product | https://www.tickadoo.com |
| Privacy | https://www.tickadoo.com/privacy |
| Prepared install prompt (usable only after the deployment gate; directory approval is not required after that) | INSTALL.md in this folder |

## After you click submit

Reply in this thread with the confirmation screen / request id. We will keep the brief pinned on `main` so Meta's e2e tester hits a stable URL.
