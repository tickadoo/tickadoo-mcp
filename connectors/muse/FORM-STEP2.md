# Muse form — Step 2 Technical specs

Use **Existing MCP**. Do not submit as Raw API unless Meta rejects MCP.

## Existing MCP (submit this)

### Connection type
Hosted MCP endpoint

### Hosted MCP endpoint
```
https://mcp.tickadoo.com/mcp
```

### API or MCP documentation
```
https://raw.githubusercontent.com/tickadoo/tickadoo-mcp/main/connectors/muse/muse.md
https://mcp.tickadoo.com/llms-full.txt
https://mcp.tickadoo.com/
https://github.com/tickadoo/tickadoo-mcp
```

### Access requirements
```
Public. No account, API key, or OAuth required to search, recommend, check availability, or retrieve a tickadoo.com booking URL.
Any Muse user can use the connector. Coverage is the live tickadoo catalogue (theatre, attractions, tours, experiences).
The connector does not collect card data. Payment and ticket fulfilment happen on tickadoo.com after Muse opens the booking URL.
Hotel-property CONNECT routes under /api/connect/* are out of scope for this consumer listing.
```

### Authentication methods
Leave **API keys**, **OAuth with PKCE**, and **Other** unchecked.
There is no auth for discovery.

---

## Raw API (fallback only)

### Connection type
API URL

### API URL
```
https://mcp.tickadoo.com
```

### OpenAPI specification (optional)
```
https://mcp.tickadoo.com/openapi.json
```

### API or MCP documentation
Same four URLs as above.

### Access requirements
Same text as above.

### Authentication methods
Leave all unchecked.
