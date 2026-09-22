# tickadoo-mcp stdio-bridge audit

Status: first-pass source review, 2026-09-22
Tracks: Howard #4524 / Linear GRO-434 PI-06
Repo: public MIT `tickadoo/tickadoo-mcp` (`@tickadoo/mcp-server` 2.1.0)
Method: source review of `src/{index,config,bridge}.ts`. No OS sandbox. No npm publish.

This package does **not** define tools. Howard `src/mcp-tools-public.ts` is the source of truth.

## What the package is

A 3-file stdio → Streamable HTTP proxy:

```
host (Claude Code / ChatGPT / Gemini)
  → src/index.ts
  → createTickadooBridge()
  → StreamableHTTPClientTransport(TICKADOO_MCP_URL)
  → https://mcp.tickadoo.com/mcp  (default)
```

`BRIDGEABLE_METHODS` is a closed set: `tools/list`, `tools/call`, `resources/list`, `resources/read`. Everything else is `MethodNotFound`.

## Findings

| ID | Finding | Class |
|---|---|---|
| BR-01 | Package does not invent tool descriptors. `tools/list` is forwarded from Howard. | rejected as a schema-injection vuln in this repo |
| BR-02 | `TICKADOO_MCP_URL` accepts any `new URL()` value. No `https:` requirement. No host allowlist. Default is `https://mcp.tickadoo.com/mcp`. | product-decision on a developer laptop; **needs_validation** on a shared host / poisoned env |
| BR-03 | `preserveRemoteError` copies remote `McpError.message` and `error.data` to the host. Covered as intended by `tests/bridge.test.ts`. | needs_validation (hostile remote can put instruction text in `data`) |
| BR-04 | Local server copies remote `instructions`, `name`, `title`, `description`, `icons`, and tool/resource capabilities. A hostile `TICKADOO_MCP_URL` can rewrite what the host thinks the server is. | same as BR-02 |
| BR-05 | `index.ts` writes a Claude Code plugin hint when `CLAUDECODE` is set. First-party string. | rejected |

## Already tight

- Method allowlist is small and explicit.
- Default remote is first-party HTTPS.
- Resource subscribe capability is stripped (`subscribe` dropped from remote capabilities).
- Existing `connectors/muse/security.md` covers the Meta review surface separately.

## Follow-up for Claude Code / Cloudflare skill

```
security audit this codebase, scoped to
src/bridge.ts, src/config.ts, src/index.ts.
Confirm TICKADOO_MCP_URL has no host allowlist and that
preserveRemoteError forwards remote error data.
The package must not invent tools.
```

Do not treat this markdown as proof the remaining code is clean.
Do not publish or bump 2.1.0 from this docs PR.
