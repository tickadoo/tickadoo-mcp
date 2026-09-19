# Muse form — Step 1 Overview (paste exactly)

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
Compare Wicked and Hamilton in New York and book the better-value option for Friday.
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
Francis Hellyer
```

## Work email
```
francis@tickadoo.com
```

## Support email or URL
```
support@tickadoo.com
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

MCP (primary, no auth): POST https://mcp.tickadoo.com/mcp
Protocol 2025-06-18, server tickadoo v1.6.0, 23 tools.
Contract: https://mcp.tickadoo.com/llms-full.txt
OpenAPI: https://mcp.tickadoo.com/openapi.json
Source: https://github.com/tickadoo/tickadoo-mcp/tree/main/connectors/muse

How it works: Muse searches live official-primary inventory, confirms a date and party size with get_availability, then opens the tickadoo.com booking URL in its secure browser. No API key. No OAuth for discovery. Card data stays on tickadoo checkout (Stripe). Mobile tickets are fulfilled by tickadoo.

Do not use /api/connect/* for the consumer listing — those routes need a hotel CONNECT property context.

Verified 19 Sep 2026: London “Lion King” search returns the Lyceum production and a live tickadoo booking URL.
```
