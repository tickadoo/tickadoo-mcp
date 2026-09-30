# tickadoo × Muse — security and data note

Status: **prepared only**. The `/mcp/agents` endpoint is not usable until it is
deployed and verified by the checks in `EVALS.md`. Do not install, connect,
submit, or claim it is available before then.

For Meta functional / security / legal review. 19 September 2026.

## Trust boundary

Muse talks to tickadoo over public HTTPS. tickadoo returns catalogue data and booking URLs. The user pays on tickadoo.com. Muse does not become a payment processor in v1.

```
User → Muse VM → https://mcp.tickadoo.com  → tickadoo catalogue
                 ↘ booking_url              → https://www.tickadoo.com (checkout, tickets)
```

Allowed hosts: `mcp.tickadoo.com`, `www.tickadoo.com`, `tickadoo.com`, `cdn.tickadoo.com`, `widgets.tickadoo.com`.

## Auth

Discovery endpoints require no credential. There is nothing to put in Muse's Secure Credentials Store for search.

If a later revision adds a logged-in "my bookings" surface, credentials must enter only through Muse's secure prompt, never through chat, and must be scoped to read the user's own orders.

## Data tickadoo sees

Typical tool arguments: city slug, search text, product id, date range, party size, language code.

tickadoo does not need, and this connector must not send, Meta account ids, Gmail contents, calendar dumps, or card data to answer a search.

The public agent endpoint exposes no write or feedback-submission tool. The connector must never imply that feedback was filed.

## Payments

v1: user completes checkout on tickadoo.com. Card data stays in tickadoo's existing Stripe-backed checkout.

v2 (optional, Meta + Stripe Link): `/api/connect/book` may return `session.url` / `clientSecret` for a Stripe Checkout session. Still no PAN in Muse chat. Do not enable this path until a CONNECT property is provisioned; unscoped calls return `{"error":"Property not found"}`.

## Availability integrity

Search prices are "from" figures and may be cached pointers. Live claims (tonight, this Saturday, seats left) must come from `get_availability` or `check_availability`. Slot amounts are minor units and must be converted before speech.

## Abuse

Public catalogue, Cloudflare + Howard in front. On 429, back off. Do not bulk-walk the catalogue. Do not use the connector as a scrape feed.

## Contact for security review

https://www.tickadoo.com/contact
