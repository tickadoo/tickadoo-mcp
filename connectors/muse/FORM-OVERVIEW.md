# Muse form — Step 1 Overview (paste exactly)

Status: **prepared only**. The `/mcp/agents` endpoint is not usable until it is
deployed and verified by the checks in `EVALS.md`. Do not install, connect,
submit, or claim it is available before then.

Use these values. Do not improvise brand spelling.

## Connector name
```
tickadoo
```

## Company or developer
```
tickadoo Inc.
```

## Product website
```
https://www.tickadoo.com
```

## Example prompts
```
Get two tickets for The Lion King in London this Saturday.
What is on tonight in New York?
Find a rainy family afternoon near the London Eye.
Compare Chicago and The Book of Mormon in New York and book the better-value option for Friday.
We have a free evening in Paris, nothing too touristy, under €80 each.
```

## Connector icon
SVG (form accepts PNG or SVG):
https://raw.githubusercontent.com/tickadoo/tickadoo-mcp/main/connectors/muse/tickadoo-muse-icon.svg

Official mark: near-black field, gold ticket stub, lowercase t with a booked check.

## Payments
Select: **My connector accepts payments**

Tickets are sold. Checkout is on tickadoo.com (existing Stripe). The connector does not collect cards in Muse chat. If step 2 demands a Muse-specific Stripe Link account you do not have, switch this to “does not accept payments” and keep the Anything else paragraph.

## Your name
```
Enter the authorized submitter in the portal; do not store it in this file.
```

## Work email
```
Use the authorized submitter's work account; do not store it in this file.
```

## Support email or URL
```
https://www.tickadoo.com/contact
```

## Your privacy policy
```
https://www.tickadoo.com/privacy
```

## Your terms of service
```
https://www.tickadoo.com/terms
```

## Anything else? (optional)
```
Public connector brief (fetch this first):
https://raw.githubusercontent.com/tickadoo/tickadoo-mcp/main/connectors/muse/muse.md

MCP (primary, no auth): POST https://mcp.tickadoo.com/mcp/agents
Protocol 2025-06-18, 20 read-only tools. Confirm the live server version during pre-submission validation.
Contract: discover the 20 read-only schemas with `tools/list` on the MCP endpoint above.
OpenAPI: https://mcp.tickadoo.com/openapi.json
Source: https://github.com/tickadoo/tickadoo-mcp/tree/main/connectors/muse

How it works: Muse searches the live tickadoo catalogue, confirms a date and party size with get_availability, then opens the returned tickadoo.com booking URL in its secure browser. No API key. No OAuth for discovery. Card data and any post-purchase delivery stay outside Muse; do not claim a ticket type or fulfilment method unless the returned payload or destination page states it.

Do not use /api/connect/* for the consumer listing — those routes need a hotel CONNECT property context.

An earlier general-surface check returned the London Lion King production with a tickadoo booking URL. Re-run the public-agent endpoint after deployment before using any title in the submission evidence.
```
