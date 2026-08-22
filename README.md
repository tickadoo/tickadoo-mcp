# tickadoo MCP Server

`@tickadoo/mcp-server` is the local stdio entrypoint for tickadoo MCP. Since v2.0.0 it is a thin bridge to the canonical remote server at:

```text
https://mcp.tickadoo.com/mcp
```

## Agent Plugins 1.0

This repository is also a portable Agent Plugins 1.0.0 package. Compatible
clients discover the root [`plugin.json`](plugin.json), the seven workflows in
[`skills/`](skills/), and the credential-free Streamable HTTP configuration in
[`mcp.json`](mcp.json). Current Codex marketplace ingestion uses the parallel
`.codex-plugin/plugin.json` adapter; the portable root manifest remains the
vendor-neutral source of truth.

Run `npm run test:plugin` to validate the package against the vendored official
schemas and its containment, discovery, transport, and secret-safety checks.
The same command verifies the exact npm tarball contents and the provider-neutral
acceptance corpus in [`evals/agent-plugin-scenarios.json`](evals/agent-plugin-scenarios.json).
See [`docs/agent-plugins.md`](docs/agent-plugins.md) for the architecture
decision, compatibility evidence, update/rollback process, and follow-ups.

The package no longer defines tools, formats catalogue data, or calls a local tickadoo backend. It connects to the remote Streamable HTTP MCP server and proxies `tools/list`, `tools/call`, `resources/list`, `resources/read`, and `ping`. The live remote owns the tool list, schemas, results, and errors.

No API key is required.

## Install

Use the hosted remote directly when your MCP client supports Streamable HTTP:

```json
{
  "mcpServers": {
    "tickadoo": {
      "url": "https://mcp.tickadoo.com/mcp"
    }
  }
}
```

Use the npm package when your MCP client needs a local stdio command:

```json
{
  "mcpServers": {
    "tickadoo": {
      "command": "npx",
      "args": ["-y", "@tickadoo/mcp-server"]
    }
  }
}
```

Use Gemini CLI:

```bash
gemini extensions install https://github.com/tickadoo/tickadoo-mcp
```

## Configuration

Set `TICKADOO_MCP_URL` to point the bridge at another compatible Streamable HTTP MCP endpoint:

```bash
TICKADOO_MCP_URL=http://127.0.0.1:8787/mcp npx -y @tickadoo/mcp-server
```

Set `TICKADOO_LOG_LEVEL=none` to silence bridge status logs on stderr.

## Local Development

```bash
npm install
npm run build
npm test
```

Run the built stdio bridge:

```bash
node dist/index.js
```

Refresh the MCP registry metadata from the live remote:

```bash
npm run sync:server-json
```

Run the optional live integration test:

```bash
LIVE=1 npm test
```

## Live Tools

The current tool list is served by the remote MCP server. Visit [mcp.tickadoo.com](https://mcp.tickadoo.com) or run `npm run sync:server-json` to refresh the registry metadata in this repo.

## Privacy & Data Handling

- **No account or API key required.** The server is read-mostly: it exposes tickadoo's public experiences catalogue (search, recommendations, availability, comparison, itineraries) and returns booking links — it does not collect, store, or require personal data to function.
- **What is sent:** tool arguments (e.g. a city name, query text, or chosen experience id) are forwarded to the tickadoo backend to fulfil the request. The bridge adds no tracking and asks for no credentials.
- **First-party service.** tickadoo is the operator of the catalogue and backend; supplier inventory is presented as tickadoo. Bookings are completed on tickadoo.com.
- **Full policy:** [tickadoo.com/privacy](https://tickadoo.com/privacy). Questions: support@tickadoo.com.
