# tickadoo MCP Server

`@tickadoo/mcp-server` is the local stdio entrypoint for tickadoo MCP. It is a thin bridge to the read-only public agent surface at:

```text
https://mcp.tickadoo.com/mcp/agents
```

This branch prepares that endpoint as the distribution default. Do not publish
the package, Registry metadata, or directory bundles until Howard has deployed
the endpoint and the 20-tool read-only live checks pass.

## Meta Muse connector

Directory submission pack and the brief Muse should fetch live in [`connectors/muse/`](connectors/muse/). Stable brief:

https://raw.githubusercontent.com/tickadoo/tickadoo-mcp/main/connectors/muse/muse.md

After the deployment and live-validation gate above passes, submit at
[muse.ai/platform](https://muse.ai/platform) using
[`connectors/muse/SUBMISSION.md`](connectors/muse/SUBMISSION.md). No API key.
Discovery is this MCP server; checkout stays on tickadoo.com.

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
Compatibility does not create a public listing automatically. The exact
OpenAI upload artifact and the remaining verified-organization, review, and
publish steps are documented in
[`docs/openai-plugin-submission.md`](docs/openai-plugin-submission.md).

OpenAI Agents API sessions that call the public MCP (Book path) are documented in
[`docs/openai-agents-api.md`](docs/openai-agents-api.md). Use
`https://mcp.tickadoo.com/mcp/agents` — the bare host is not an MCP endpoint.

The package no longer defines tools, formats catalogue data, or calls a local tickadoo backend. It connects to the remote Streamable HTTP MCP server and proxies `tools/list`, `tools/call`, `resources/list`, `resources/read`, and `ping`. The live remote owns the tool list, schemas, results, and errors.

No API key is required.

## Install

Use the hosted remote directly when your MCP client supports Streamable HTTP:

```json
{
  "mcpServers": {
    "tickadoo": {
      "url": "https://mcp.tickadoo.com/mcp/agents"
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

That repository marketplace is an install path, not a public Claude listing.
The minimal cross-surface bundle and current connector-plus-plugin submission
runbook live in [`distribution/claude/`](distribution/claude/) and
[`docs/claude-directory-submission.md`](docs/claude-directory-submission.md).

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

- **No account or API key required.** The public agent surface is read-only: it exposes tickadoo's public experiences catalogue and returns booking links. It has no account, checkout, payment, booking, feedback-write, or customer-record tools.
- **What is processed:** tool arguments can include search text, city or area, dates, party size, filters and product identifiers. The public-agent surface excludes precise-coordinate tools. Live availability checks can send the applicable supplier product identifier, date range and currency to that experience supplier. The bridge adds no tracking and asks for no credentials.
- **Operational records:** the remote service retains structured tool-call metadata for reliability and quality and processes normal connection telemetry. The public agent surface does not expose a feedback write tool. Retention differs by record type; do not claim a blanket 30- or 90-day deletion period without verifying the deployed controls.
- **First-party service.** tickadoo is the operator of the catalogue and backend; supplier inventory is presented as tickadoo. Bookings are completed on tickadoo.com.
- **Policy:** [tickadoo.com/privacy](https://tickadoo.com/privacy). Directory submissions must also disclose the MCP-specific categories and current retention controls above. Questions: support@tickadoo.com.
