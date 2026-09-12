# OpenAI Agents API → tickadoo Public MCP

This is the money-first **Book** path: an OpenAI [Agents API](https://developers.openai.com/api/docs/guides/agents-api/overview) session that calls the public tickadoo MCP over HTTP and returns a `www.tickadoo.com` `booking_url`. It is complementary to voice. It is not a payment integration — tickadoo MCP has no payment tool; checkout stays on tickadoo.com.

Use this when you want OpenAI to host the agent and reach tickadoo from OpenAI’s network (`connection_origin: "service"`). Agent Plugins / ChatGPT Plugin Directory remain a separate install surface; this document does not change `plugin.json` or `npm run test:plugin`.

## Canonical MCP URL

Always use:

```text
https://mcp.tickadoo.com/mcp
```

The bare host `https://mcp.tickadoo.com` is not the Streamable HTTP endpoint and **404s**. The `/mcp` path is required (openai-node [PR #2719](https://github.com/openai/openai-node/pull/2719) / [v7.15.0](https://github.com/openai/openai-node/releases/tag/v7.15.0) Agents API MCP transport).

No tickadoo API key is required. Do not attach Cloudflare Access headers, ads keys, or other credentials.

## Create a session

Requires `openai` **≥ 7.15.0**. The Node SDK adds `OpenAI-Beta: agents=v1` on `client.beta.agents` calls; include that header yourself when using cURL.

Attach tickadoo as a required HTTP MCP tool. OpenAI connects from its service network, so no sandbox environment is needed:

```json
{
  "type": "mcp",
  "server_label": "tickadoo",
  "transport": {
    "type": "http",
    "server_url": "https://mcp.tickadoo.com/mcp"
  },
  "connection_origin": "service",
  "required": true
}
```

TypeScript (`openai` ≥ 7.15.0):

```ts
import OpenAI from "openai";

const client = new OpenAI();

const session = await client.beta.agents.sessions.create({
  agent: {
    model: "gpt-6-astra",
    instructions:
      "Use only the tickadoo MCP tools. Search London for The Lion King and return a www.tickadoo.com booking_url. Do not collect payment or invent a checkout tool.",
    tools: [
      {
        type: "mcp",
        server_label: "tickadoo",
        transport: {
          type: "http",
          server_url: "https://mcp.tickadoo.com/mcp",
        },
        connection_origin: "service",
        required: true,
      },
    ],
  },
  environment: { type: "none" },
  input:
    "Find The Lion King in London and return one official tickadoo booking_url on www.tickadoo.com.",
});
```

cURL (same payload; header is required):

```bash
curl --fail-with-body https://api.openai.com/v1/agents/sessions \
  -H "OpenAI-Beta: agents=v1" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent": {
      "model": "gpt-6-astra",
      "instructions": "Use only the tickadoo MCP tools. Search London for The Lion King and return a www.tickadoo.com booking_url. Do not collect payment or invent a checkout tool.",
      "tools": [
        {
          "type": "mcp",
          "server_label": "tickadoo",
          "transport": {
            "type": "http",
            "server_url": "https://mcp.tickadoo.com/mcp"
          },
          "connection_origin": "service",
          "required": true
        }
      ]
    },
    "environment": { "type": "none" },
    "input": "Find The Lion King in London and return one official tickadoo booking_url on www.tickadoo.com."
  }'
```

Steer the agent to:

1. Search London inventory (theatre / musicals).
2. Resolve **The Lion King**.
3. Return a `booking_url` on `www.tickadoo.com`.

Do not add a payment, card, or checkout tool. The public MCP returns booking links; the customer completes purchase on tickadoo.com.

## API key permissions

The OpenAI project key needs Agents API scopes (`api.agents.read`, `api.agents.write`) plus `api.responses.write` for model inference. See the [Agents API quickstart](https://developers.openai.com/api/docs/guides/agents-api/quickstart).

Export it locally as `OPENAI_API_KEY`. Never commit the key. Do not copy Cloudflare ads keys or any other product secret into this repo or this workflow.

## Run the smoke

From the repo root, after `npm install`:

```bash
export OPENAI_API_KEY="your-api-key"
npm run smoke:agents-api
```

Equivalent:

```bash
npx tsx examples/agents-api-tickadoo-smoke.ts
```

The script creates a session with the MCP tool above, prompts for a Lion King / London booking link, streams the first turn, and exits 0 only when the agent output contains a `www.tickadoo.com` URL. If `OPENAI_API_KEY` is unset, it fails immediately with a message that Francis/Mark must add the key to `tickadoo-mcp` repo secrets (or make the org secret visible to this repo).

## CI

`.github/workflows/agents-api-smoke.yml` runs that smoke with `secrets.OPENAI_API_KEY`.

If the secret is missing, the job **fails clearly**. It does not skip, invent a key, or read Cloudflare ads keys. Francis or Mark must add `OPENAI_API_KEY` under **Settings → Secrets and variables → Actions** on `tickadoo/tickadoo-mcp`, or grant this repository access to the org secret of the same name.

Regular `npm test` / `npm run test:plugin` do not call the Agents API.

## Further reading

- [Agents API overview](https://developers.openai.com/api/docs/guides/agents-api/overview)
- [MCP connections](https://developers.openai.com/api/docs/guides/agents-api/tools/mcp)
- [Create session](https://developers.openai.com/api/docs/guides/agents-api/sessions)
