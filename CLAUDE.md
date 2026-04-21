# CLAUDE.md — tickadoo-mcp

This file is read automatically by Claude Code at session start. Lightweight project doc; defers to [`AGENTS.md`](AGENTS.md) for the shared AI-agent coordination conventions and to `github.com/tickadoo/howard` → `CLAUDE.md` for the broader tickadoo project context (architecture, deploy workflows, environment variables, supplier integrations, team, Slack IDs, etc.).

## What is this repo?

`@tickadoo/mcp-server` — the public MCP (Model Context Protocol) server for tickadoo. Exposes 15 tools over 13,090 products in 681 cities to AI agents (ChatGPT, Claude, Perplexity, etc.) so they can search, browse, and recommend tickadoo experiences on behalf of end users. Installed by clients from the MCP Marketplace / npm.

As of v1.4.2 (16 April 2026): agent intelligence layer on both search tools — `_best_picks`, `_price_tiers`, `_group_summary`, smart `_conversation_starters`, `_available_filters`, `_related_searches`, `_next_step`. Details tools carry `_booking_urgency`, `_cross_sell`, `_intent_token`, `_accessibility`.

## Architecture at a glance

- **Runtime**: TypeScript MCP server
  - `src/worker.ts` — Cloudflare Worker (Hono + `WebStandardStreamableHTTPServerTransport`) serves `mcp.tickadoo.com`
  - `src/index.ts` — local stdio transport (shipped on npm as `@tickadoo/mcp-server`)
  - `widgets-worker/` — separate Worker serving embeddable widgets at `widgets.tickadoo.com`
- **Deploys via**: Cloudflare Workers (`wrangler.jsonc` + `.github/workflows/deploy-cf.yml`). GRO-214 migration complete.
- **Data source**: Howard backend (`https://howard-api.mark-e43.workers.dev`) for products, cities, availability, pricing. Telemetry to Neon via `NEON_URL` Worker secret.
- **Testing**: vitest (`npm test`) + smoke suites (`npm run e2e:stdio`, `npm run e2e:http`)
- **Build**: `npm run build` → `dist/index.js` (esbuild bundle for stdio/npm); Workers build happens in-flight via `wrangler deploy`.
- **Local dev**: `npm run dev:worker` (wrangler dev).

Customer never sees supplier names; everything is presented as tickadoo.

## Multi-chat coordination

Multiple AI coding agents (Claude chats, Claude Code, Codex tasks) may push to `main` concurrently. Full conventions are in [`AGENTS.md`](AGENTS.md). Short version:

- **Pull first, push last, pull before push again**: `git pull --rebase origin main` at session start AND before every push.
- **Commit trailer**: every commit ends with `Claude-Chat: <agent-name>` (e.g. `howardmcp`, `codex-<task-slug>`). Filter with `git log --grep='Claude-Chat: <name>' --oneline`.
- **Slack feed**: all agents post session-start / commit / session-paused updates to Slack `#ai-activity` (`C0ATET93PQV`). Live source of truth, more timely than `.claude/active-chats.md` which only updates at session boundaries.
- **Active chats file**: `.claude/active-chats.md` lists who's working on what. Read it at session start.

### Reusable snippet for Codex task prompts in this repo

Paste near the top of every Codex task prompt fired outside a Codex CLI working directory:

```
COORDINATION:
- FIRST: git pull --rebase origin main (Codex worktrees may be stale)
- Read AGENTS.md and .claude/active-chats.md at task start
- Post to Slack #ai-activity (C0ATET93PQV) via Slack MCP:
  🤖 Codex [<task-slug>]: starting — <one-line scope>
  🤖 Codex [<task-slug>]: <progress update> (as needed)
  🤖 Codex [<task-slug>]: done — pushed <sha> — <what shipped>
- Every commit carries trailer: Claude-Chat: codex-<task-slug>
- Before each push: git pull --rebase origin main again
- If you make multiple commits for one task, reference all of them (or the range `<first-sha>..<last-sha>`) in the done post
```

### New Claude Code capabilities (announced 17 April 2026)

**Opus 4.7** is the current CC default. Better long-session context retention and cross-session memory. Default effort is xhigh.

**Auto mode** (research preview, Shift+Tab in Claude Code) handles permission decisions via classifiers instead of prompting per file-write or bash. Use it for long autonomous tasks with upfront context.

**Routines** (research preview) run on Claude Code's web infrastructure — no laptop dependency. Trigger via schedule, API, or GitHub webhook. Most live in the Howard repo today; if this repo gains any, prompts go in `.claude/routines/` and the same coordination rules apply (post to `#ai-activity` on start/progress/done, commit trailer `Claude-Chat: routine-{name}`).

**`/ultrareview`** spins up a careful-review pass in the terminal. Three free runs per account.

**Dispatch** (research preview, Pro/Max) kicks off tasks from your phone, running locally via the desktop app.

Dashboard: `claude.ai/code/routines`. Docs: `code.claude.com/docs/en/routines`. Sibling Linear issues: GRO-196 (routine setup) and GRO-216 (Slack wiring).

## Cross-repo links

- Howard backend: `github.com/tickadoo/howard`
- Shared conventions: `github.com/tickadoo/howard/blob/main/CLAUDE.md` (section "Multi-chat coordination") and `github.com/tickadoo/howard/blob/main/AGENTS.md`
- Slack `#ai-activity` (`C0ATET93PQV`) for all AI agent activity across all repos

## This is a living document

When significant state changes happen (v1.4.3+ features, new tools added, distribution updates, cross-repo coordination patterns that prove useful), update this file and commit. Keep it lightweight; detailed context lives in Howard's CLAUDE.md.
