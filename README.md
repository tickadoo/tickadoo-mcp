# tickadoo MCP: live experiences for AI assistants

tickadoo's MCP server lets AI assistants discover and compare theatre, tours,
attractions, hidden gems, and other live experiences worldwide. The full MCP
surface can return live availability and tickadoo booking links. No account or
API key is required.

## Try it

- "What's on in London tonight?"
- "Plan a 3-day food itinerary in Paris."
- "Compare walking tours in Rome."

## Connect

Remote (Streamable HTTP), no install:

```json
{ "mcpServers": { "tickadoo": { "url": "https://mcp.tickadoo.com/mcp" } } }
```

Or the npm bridge for stdio clients:

```bash
npx -y @tickadoo/mcp-server
```

---

# tickadoo MCP Server

[![Listed on mcpservers.org](https://mcpservers.org/badge.svg)](https://mcpservers.org/servers/tickadoo/tickadoo-mcp)

`@tickadoo/mcp-server` is the local stdio entrypoint for tickadoo MCP. Since v2.0.0 it is a thin bridge to the canonical remote server at:

```text
https://mcp.tickadoo.com/mcp
```

## Meta Muse connector

Directory submission pack and the brief Muse should fetch live in [`connectors/muse/`](connectors/muse/). Stable brief:

https://raw.githubusercontent.com/tickadoo/tickadoo-mcp/main/connectors/muse/muse.md

Submit at [muse.ai/platform](https://muse.ai/platform) using [`connectors/muse/SUBMISSION.md`](connectors/muse/SUBMISSION.md). No API key. Discovery is this MCP server; checkout stays on tickadoo.com.

## Agent Plugins 1.0

This repository is also a portable Agent Plugins 1.0.0 package. Compatible
clients discover the root [`plugin.json`](plugin.json), the seven workflows in
[`skills/`](skills/), and the credential-free Streamable HTTP configuration in
[`mcp.json`](mcp.json). The portable OpenAI/Codex package uses the separate
discovery-only endpoint `https://mcp.tickadoo.com/mcp/agents`; it does not
return direct purchase, transaction, or checkout links. OpenAI's plugin
directory reads `extensions.com.openai` from the root manifest.

The npm stdio bridge, MCP Registry, Claude, the copy-ready Copilot cloud MCP
adapter, Gemini, Smithery, Muse, and direct integrations retain the established
full endpoint `https://mcp.tickadoo.com/mcp`. The Copilot portable-plugin
marketplace entry installs the root public-agent package instead. The two
surfaces are intentionally distinct. `.codex-plugin/plugin.json` remains the
compatibility form of the portable public-agent package.

Run `npm run test:plugin` to validate the package against the vendored official
schemas and its containment, discovery, transport, and secret-safety checks.
The same command verifies the exact npm tarball contents and the provider-neutral
acceptance corpus in [`evals/agent-plugin-scenarios.json`](evals/agent-plugin-scenarios.json).
See [`docs/agent-plugins.md`](docs/agent-plugins.md) for the architecture
decision, validation, release, and rollback process. The portal-only OpenAI
handoff is in
[`docs/openai-plugin-submission.md`](docs/openai-plugin-submission.md).

Direct OpenAI Agents API integrations that intentionally use the established
full MCP surface are documented in
[`docs/openai-agents-api.md`](docs/openai-agents-api.md). That integration is
separate from the public Plugin Directory package. Use
`https://mcp.tickadoo.com/mcp` — the bare host is a human-readable service
landing page, not a Streamable HTTP endpoint.

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

Use Claude Code's supported marketplace flow:

```bash
claude plugin marketplace add tickadoo/tickadoo-mcp
claude plugin install tickadoo@tickadoo-agent-plugins
```

Claude's native adapter explicitly uses HTTP transport and the full MCP URL:

```json
{ "mcpServers": { "tickadoo": { "type": "http", "url": "https://mcp.tickadoo.com/mcp" } } }
```

Or add that full remote server to Claude Code directly. Claude Code skips a
remote entry that has a `url` but no explicit `type`:

```bash
claude mcp add --transport http tickadoo https://mcp.tickadoo.com/mcp
```

## Configuration

Set `TICKADOO_MCP_URL` to point the bridge at another compatible Streamable HTTP MCP endpoint:

```bash
TICKADOO_MCP_URL=http://127.0.0.1:8787/mcp npx -y @tickadoo/mcp-server
```

> Only point `TICKADOO_MCP_URL` at endpoints you trust: the bridge forwards your tool arguments (city names, queries, experience IDs) to whichever endpoint is configured.

Set `TICKADOO_LOG_LEVEL=none` to silence bridge status logs on stderr.

Set `TICKADOO_ELICITATION=1` (`true`, `yes`, and `on` also work) to let the bridge ask a client that advertises form elicitation for a missing date, party size, or seat preference on the booking search, hold, and checkout-handoff tools, and to confirm a held price before checkout handoff. The flag is off by default. Clients that do not advertise elicitation are proxied unchanged. Dismissing a missing-detail form keeps the original arguments, so the remote still returns its existing error or default. Dismissing the price confirmation does not start checkout. The bridge only asks for properties the tool schema accepts, and it does not invent a date, party size, seat, or price.

## Local Development

Use Node.js 22+ and install Python 3 with a `python3` executable on `PATH`
before running the checks. The registry read-back tests execute the workflow's
Python verifier against local fixtures; the stdio bridge itself only needs Node.js.

```bash
python3 --version
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

- **No account or API key required.** The full server is read-mostly: it exposes tickadoo's public experiences catalogue (search, recommendations, availability, comparison, itineraries) and may return tickadoo booking links. The portable public-agent endpoint is read-only and omits direct purchase, transaction, and checkout links. Neither surface requires personal data to perform discovery.
- **What is sent:** tool arguments (e.g. a city name, query text, or chosen experience id) are forwarded to the tickadoo backend to fulfil the request. The bridge adds no tracking and asks for no credentials.
- **First-party service.** tickadoo is the operator of the catalogue and backend; supplier inventory is presented as tickadoo. Bookings are completed on tickadoo.com.
- **Full policy:** [tickadoo.com/privacy](https://tickadoo.com/privacy). Questions: support@tickadoo.com.
