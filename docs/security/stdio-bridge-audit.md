# Stdio bridge prompt-injection audit

Status: first-pass guidance review, 2026-09-22
Ticket: Howard #4524 / Linear GRO-434 follow-on (PI-06)
Package: `@tickadoo/mcp-server` 2.1.0
Method: source review of `src/{index,config,bridge}.ts` plus `tests/bridge.test.ts`.
No OS sandbox. No npm publish. No production `report_quality_signal` calls.

Classification used here:

- **confirmed** — control exists and was observed in source
- **needs_validation** — plausible residual risk; needs a sandboxed skill pass
- **product-decision** — advertised design, not a silent failure of a claimed control
- **rejected** — not observed as a current defect of the claimed control

This document is not a claim that the published npm package currently injects tools.

## Trust boundary

```
LLM host (Claude Code / ChatGPT / Copilot / Gemini)
  → stdio @tickadoo/mcp-server (`src/index.ts`)
  → Streamable HTTP client (`src/bridge.ts`)
  → TICKADOO_MCP_URL or https://mcp.tickadoo.com/mcp
  → Howard dispatcher + static MCP_TOOLS
```

This package is a 3-file proxy. It does not define tools, resources, or prompts.
Canonical descriptors live in `tickadoo/howard` `src/mcp-tools-public.ts`.

## Observed controls

- Default remote is `https://mcp.tickadoo.com/mcp` (`DEFAULT_TICKADOO_MCP_URL`).
- Forwarded methods are a closed set: `tools/list`, `tools/call`, `resources/list`, `resources/read`. Anything else is `MethodNotFound`.
- Resource subscribe capability is stripped before the local server advertises it.
- `tests/bridge.test.ts` already asserts remote JSON-RPC errors are forwarded with `code`, `message`, and `data`.
- Muse connector note at `connectors/muse/security.md` already tells Meta the catalogue is credential-free and notes must contain no personal data.

## Findings

| ID | Finding | Class |
|---|---|---|
| SB-01 | Package does not invent tools. `tools/list` is a remote pass-through. | confirmed / rejected as local schema injection |
| SB-02 | `TICKADOO_MCP_URL` is `process.env` or the default. `resolveRemoteUrl` only checks `new URL()`. No `https:` requirement, no host allowlist. `file:`, `http:`, and attacker HTTPS all parse. | needs_validation on a shared host; product-decision on a developer laptop |
| SB-03 | `preserveRemoteError` copies remote `McpError.data` onto the error thrown to the host. A hostile remote can put instruction-like text in `data`. | needs_validation |
| SB-04 | `serverInfoFromRemote` copies remote `name`, `title`, `description`, `icons`, and `instructions` onto the local stdio server. Combined with SB-02 this is schema-position injection if the env URL is hostile. | needs_validation |
| SB-05 | Published default still points at Howard. CI should pin that default so a later edit cannot silently retarget npm users. | cheap guard added |

## What this pass does not change

- No host allowlist on `TICKADOO_MCP_URL`. Local/sandbox pointing is how the package is developed.
- No strip of `error.data`. Faithful forwarding is covered by an existing test.
- No npm publish, version bump, or marketplace submission.

## Follow-up for Claude Code / Cloudflare skill

```
security audit this codebase, scoped to
src/bridge.ts, src/config.ts, src/index.ts.

Confirm TICKADOO_MCP_URL has no host allowlist and that
preserveRemoteError forwards remote error data.
The package must not invent tools.
Do not treat this markdown as proof the remaining code is clean.
```
