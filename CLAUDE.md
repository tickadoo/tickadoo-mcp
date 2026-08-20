# CLAUDE.md — tickadoo-mcp

This file is read automatically by Claude Code at session start. Lightweight project doc; defers to [`AGENTS.md`](AGENTS.md) for the shared AI-agent coordination conventions and to the HowardOS repo (`github.com/tickadoo/howard` → `CLAUDE.md`) for the broader tickadoo project context (architecture, deploy workflows, environment variables, supplier integrations, team, Slack IDs, etc.).

## What is this repo?

`@tickadoo/mcp-server` — the npm distribution of the public tickadoo MCP (Model Context Protocol) server. It surfaces 23 tools over 13,090 products in 681 cities to AI agents (ChatGPT, Claude, Perplexity, etc.) so they can search, browse, recommend, and book tickadoo experiences on behalf of end users. Installed by clients from the MCP Marketplace / npm, or used directly over Streamable HTTP at `https://mcp.tickadoo.com/mcp`.

Since **v2.0.0** this package is a **thin remote bridge** (GRO-573): the npm command is a stdio transport that proxies to the canonical remote server. It no longer defines tools, formats catalogue data, or calls a backend directly. The remote owns the tool list, schemas, results, and errors. The remote MCP server (and the embeddable widget bundle) now live in the **HowardOS repo** (`github.com/tickadoo/howard`), which is canonical (GRO-574).

Agent-intelligence layer (served by the remote): search tools carry `_best_picks`, `_price_tiers`, `_group_summary`, `_conversation_starters`, `_available_filters`, `_related_searches`, `_next_step`; details tools carry `_booking_urgency`, `_cross_sell`, `_intent_token`, `_accessibility`.

## Architecture at a glance

- **Runtime**: TypeScript stdio bridge
  - `src/index.ts` → `src/bridge.ts` — local stdio transport (shipped on npm as `@tickadoo/mcp-server`) that proxies `tools/list`, `tools/call`, `resources/list`, `resources/read`, and `ping` to the remote.
  - `src/config.ts` — bridge config (remote URL via `TICKADOO_MCP_URL`, log level via `TICKADOO_LOG_LEVEL`).
- **Canonical remote**: `https://mcp.tickadoo.com/mcp` — served and deployed from the **howard** repo, not this one. This repo does not deploy a Cloudflare Worker.
- **Build**: `npm run build` → `dist/index.js` (esbuild bundle for stdio/npm).
- **Registry metadata**: `server.json` is refreshed from the live remote via `npm run sync:server-json`.
- **Skills** (`skills/*/SKILL.md`, PR #96): 7 skills for Agent Plugins clients and the OpenAI **Plugin Directory** (a plugin = our MCP server + optional Skills for complex workflows) — the `tickadoo-experiences` discovery skill (mirrored to `.claude/skills/`; keep the two copies in sync) plus 6 workflow skills (`plan-a-trip`, `family-day-out`, `tonight-and-last-minute`, `date-night`, `compare-before-you-book`, `near-a-landmark`). Ground every tool reference in `server.json`; frontmatter `name` must match the folder. BAC-779 adds them to the npm published file set and verifies the exact tarball; OpenAI still snapshots uploaded or MCP-imported skills during its Platform submission flow.
- **Testing**: vitest (`npm test`); `LIVE=1 npm test` runs the optional live integration test against the remote.
- **No API key required.** Customer never sees supplier names; everything is presented as tickadoo.

> Note: the embeddable widget bundle is owned by howard (`src/mcp/cards-widget-html.ts`, canonical per GRO-574). The old `widgets-worker/` directory was removed from this repo. Do not make widget changes here.

## Multi-chat coordination

Multiple AI coding agents (Claude chats, Claude Code, Codex tasks) may push to `main` concurrently. Full conventions are in [`AGENTS.md`](AGENTS.md). Short version:

- **Pull first, push last, pull before push again**: `git pull --rebase origin main` at session start AND before every push.
- **Commit trailer**: every commit ends with `Claude-Chat: <agent-name>` (e.g. `howardmcp`, `codex-<task-slug>`). Filter with `git log --grep='Claude-Chat: <name>' --oneline`.
- **Hive coordination**: use the `claude_platform` tools for presence, recent activity, inboxes, reservations, handoffs, and blockers. Reserve paths before editing and release them afterward.
- **Unavailable-Hive fallback**: treat presence as unknown, inspect open pull requests, use a narrow isolated branch, and ask the human dispatcher when material overlap remains possible.
- **Slack visibility**: post deterministic lifecycle mirrors to `#activity` (`C0ATET93PQV`). Agents never read Slack to coordinate with each other.
- **Bounded review**: GitHub holds artifact-anchored cross-vendor review using the verdict and round limits in `AGENTS.md` and the canonical claude-platform policy.

### Reusable snippet for Codex task prompts in this repo

Paste near the top of every Codex task prompt fired outside a Codex CLI working directory:

```
COORDINATION:
- FIRST: git pull --rebase origin main (Codex worktrees may be stale)
- Read AGENTS.md at task start and check Hive presence/reservations
- Reserve the paths you will edit; release them after handoff or completion
- Post deterministic lifecycle mirrors to Slack #activity (C0ATET93PQV):
  🤖 Monaco [<linear-id> <task-slug>]: STARTED — <scope and risk lane>
  🤖 Monaco [<linear-id> <task-slug>]: REVIEW READY — <exact SHA and validation>
- Every commit carries trailer: Claude-Chat: codex-monaco-<task-slug>
- Before each push: git pull --rebase origin main again
- If Hive is unavailable, treat presence as unknown and use the documented fallback
```

### New Claude Code capabilities (announced 17 April 2026)

**Opus 4.7** is the current CC default. Better long-session context retention and cross-session memory. Default effort is xhigh.

**Auto mode** (research preview, Shift+Tab in Claude Code) handles permission decisions via classifiers instead of prompting per file-write or bash. Use it for long autonomous tasks with upfront context.

**Routines** (research preview) run on Claude Code's web infrastructure — no laptop dependency. Trigger via schedule, API, or GitHub webhook. Most live in the HowardOS repo (`howard`) today; if this repo gains any, prompts go in `.claude/routines/` and the same coordination rules apply (post deterministic lifecycle mirrors to `#activity`, commit trailer `Claude-Chat: routine-{name}`).

**`/ultrareview`** spins up a careful-review pass in the terminal. Three free runs per account.

**Dispatch** (research preview, Pro/Max) kicks off tasks from your phone, running locally via the desktop app.

Dashboard: `claude.ai/code/routines`. Docs: `code.claude.com/docs/en/routines`. Sibling pre-cutover issues, now read-only in the archive: GRO-196 (routine setup) and GRO-216 (Slack wiring).

## Cross-repo links

- HowardOS backend: `github.com/tickadoo/howard`
- Shared conventions: `github.com/tickadoo/howard/blob/main/CLAUDE.md` (section "Multi-chat coordination") and `github.com/tickadoo/howard/blob/main/AGENTS.md`
- Canonical engineering policy: `github.com/tickadoo/claude-platform/blob/main/docs/engineering-operating-policy.md`
- Slack `#activity` (`C0ATET93PQV`) for deterministic human-visible lifecycle mirrors

## This is a living document

When significant state changes happen (v1.5.x+ features, new tools added, distribution updates, cross-repo coordination patterns that prove useful), update this file and commit. Keep it lightweight; detailed context lives in the HowardOS repo's `CLAUDE.md`.
