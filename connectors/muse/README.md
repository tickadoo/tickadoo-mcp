# tickadoo connector for Meta Muse

Status: **prepared only**. The `/mcp/agents` endpoint is not usable until it is
deployed and verified by the checks in `EVALS.md`. Do not install, connect,
submit, or claim it is available before then.

Official listing pack for [Muse Connector Platform](https://muse.ai/platform).

Muse is Meta's personal agent. This folder is the tickadoo connector: what it does, which hosts it may call, how to test it, and the text to paste into Meta's submit form.

The catalogue runtime lives in Howard and requires no API key, but the new public-agent route still needs deployment and verification before this pack can be used.

## Files

| File | Who it is for |
|---|---|
| [muse.md](./muse.md) | Muse itself. Fetch this URL and build the connector from it. |
| [SKILL.md](./SKILL.md) | Allowed hosts and hard rules. |
| [INSTALL.md](./INSTALL.md) | Prepared paste-into-Muse prompt. Use only after the deployment gate passes. |
| [SUBMISSION.md](./SUBMISSION.md) | Paste-into-Meta form. Reviewers and Francis. |
| [security.md](./security.md) | Functional / security / legal review. |
| [EVALS.md](./EVALS.md) | Commands Meta (and we) can run. |

Stable brief URL:

https://raw.githubusercontent.com/tickadoo/tickadoo-mcp/main/connectors/muse/muse.md

## Why this shape

Meta opened the directory on 18 September 2026 with a three-step page and a work-email login. There is no published SDK. The pattern that already works in the wild is: publish a brief, point Muse at a public HTTPS API or MCP server, declare hosts, keep secrets out of the repo.

tickadoo's prepared public-agent endpoint is `https://mcp.tickadoo.com/mcp/agents` (no auth). Submit only after that endpoint has been deployed and the checks in `EVALS.md` pass from a clean client. Hotel CONNECT routes under `/api/connect/*` need a property context and are out of scope for the consumer listing.

## Submit after deployment and verification

Only after the gate above passes:

1. Open https://muse.ai/platform
2. Sign in with a @tickadoo.com work email
3. Paste [SUBMISSION.md](./SUBMISSION.md)
4. Point reviewers at this folder

After the endpoint is deployed and verified, [INSTALL.md](./INSTALL.md) can also be tested as a custom connector before directory approval.
