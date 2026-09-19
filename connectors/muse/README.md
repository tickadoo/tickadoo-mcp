# tickadoo connector for Meta Muse

Official listing pack for [Muse Connector Platform](https://muse.ai/platform).

Muse is Meta's personal agent. This folder is the tickadoo connector: what it does, which hosts it may call, how to test it, and the text to paste into Meta's submit form.

Live catalogue sits on the existing public MCP server. There is no new backend to deploy and no API key to issue.

## Files

| File | Who it is for |
|---|---|
| [muse.md](./muse.md) | Muse itself. Fetch this URL and build the connector from it. |
| [SKILL.md](./SKILL.md) | Allowed hosts and hard rules. |
| [INSTALL.md](./INSTALL.md) | Paste-into-Muse prompt. Works today as a custom connector, before directory approval. |
| [SUBMISSION.md](./SUBMISSION.md) | Paste-into-Meta form. Reviewers and Francis. |
| [security.md](./security.md) | Functional / security / legal review. |
| [EVALS.md](./EVALS.md) | Commands Meta (and we) can run. |

Stable brief URL:

https://raw.githubusercontent.com/tickadoo/tickadoo-mcp/main/connectors/muse/muse.md

## Why this shape

Meta opened the directory on 18 September 2026 with a three-step page and a work-email login. There is no published SDK. The pattern that already works in the wild is: publish a brief, point Muse at a public HTTPS API or MCP server, declare hosts, keep secrets out of the repo.

tickadoo already has that server: `https://mcp.tickadoo.com/mcp` (v1.6.0, no auth). Hotel CONNECT routes under `/api/connect/*` need a property context and are out of scope for the consumer listing.

## Submit today

1. Open https://muse.ai/platform
2. Sign in with a @tickadoo.com work email
3. Paste [SUBMISSION.md](./SUBMISSION.md)
4. Point reviewers at this folder

Until the directory lists us, anyone can still connect tickadoo by pasting [INSTALL.md](./INSTALL.md) into Muse.
