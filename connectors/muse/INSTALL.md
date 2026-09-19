# Install tickadoo on Muse (custom connector, works today)

Paste the block below into a Muse chat. Approve the fetch when Sentinel asks. There is no API key.

```
Build a custom connector for tickadoo so you can find and book official theatre, attraction and experience tickets.

Read the connector brief first:
https://raw.githubusercontent.com/tickadoo/tickadoo-mcp/main/connectors/muse/muse.md

Also useful:
- MCP server: https://mcp.tickadoo.com/mcp (Streamable HTTP, no auth, protocol 2025-06-18)
- Tool contract: https://mcp.tickadoo.com/llms-full.txt
- OpenAPI: https://mcp.tickadoo.com/openapi.json
- Privacy: https://www.tickadoo.com/privacy

Rules:
- No API key. Do not ask me for credentials to search.
- Allowed hosts only: mcp.tickadoo.com, www.tickadoo.com, tickadoo.com, cdn.tickadoo.com, widgets.tickadoo.com
- Discover with MCP tools. Confirm a pick with get_availability. Then open the booking_url on tickadoo.com in your secure browser.
- Do not use /api/connect/tonight, /recommend, /discover or /book unless you have a CONNECT property context. They return "Property not found" without one.
- Write tickadoo in lowercase. Do not name inventory suppliers.
- Never take card details in chat.

When the connector works, search London for "Lion King", confirm a live Saturday slot for 2 people, and show me the booking URL. Do not complete a paid checkout unless I say so.
```

## After Meta approves the directory listing

Users will connect from Muse Settings → Connectors → tickadoo. The same brief applies. Still no OAuth for search.
