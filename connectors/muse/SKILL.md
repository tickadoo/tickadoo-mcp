---
name: tickadoo
description: tickadoo connector for Meta Muse. Discover theatre, attractions, tours and experiences. No API key. Search, check live availability, then open a tickadoo.com booking URL.
allowed-hosts:
  - mcp.tickadoo.com
  - www.tickadoo.com
  - tickadoo.com
  - cdn.tickadoo.com
  - widgets.tickadoo.com
homepage: https://www.tickadoo.com
privacy: https://www.tickadoo.com/privacy
brief: https://raw.githubusercontent.com/tickadoo/tickadoo-mcp/main/connectors/muse/muse.md
mcp: https://mcp.tickadoo.com/mcp/agents
openapi: https://mcp.tickadoo.com/openapi.json
auth: none
---

# tickadoo

Status: **prepared only**. The `/mcp/agents` endpoint is not usable until it is
deployed and verified by the checks in `EVALS.md`. Do not install, connect,
submit, or claim it is available before then.

After that gate passes, install by reading `muse.md` in this folder (or the raw
GitHub URL in the frontmatter). Follow that brief exactly.

## What Muse gains

- Search experiences by city, title, mood, landmark or "tonight"
- Confirm live dates, times and prices
- Open a first-party booking page so the user can pay on tickadoo
- No account linking for discovery. No secrets in this skill.

## Hard rules

- Allowed hosts only. Never send user credentials anywhere.
- Do not call `/api/connect/*` unless Meta has provisioned a CONNECT property for this connector. Those routes 404 without one.
- Use the 20 read-only MCP tools on `https://mcp.tickadoo.com/mcp/agents` for consumer discovery.
- This connection has no write or feedback-submission tool. Never imply that feedback was filed.
- Purchase stays on tickadoo.com. Do not take cards in chat.
- Brand is lowercase tickadoo.

## Files this skill may fetch

- `connectors/muse/muse.md` (contract)
- `tools/list` on the declared MCP endpoint (the authoritative 20 read-only schemas)
- `https://mcp.tickadoo.com/openapi.json` (REST, cities + future Connect)
- Product images only from `cdn.tickadoo.com`
