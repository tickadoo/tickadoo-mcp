# AGENTS.md — Shared instructions for AI coding agents

This file is automatically read by Codex CLI (and some other AI coding tools) at task start. It's the shared ruleset for every AI agent that does work on this repo: Claude chats, Claude Code sessions, and Codex tasks.

This repo is **`@tickadoo/mcp-server`** — the public MCP server package (14 tools, 13,090 products, 681 cities as of v1.4.2). Not to be confused with Howard (the separate internal backend at `github.com/tickadoo/howard`), which this server queries for product data.

## Before you do anything

1. **Pull first**: run `git pull --rebase origin main` at task start. Codex worktrees (see `.claude/worktrees/`) may be stale clones; without a pull you may be reading an old version of this file, CLAUDE.md, or `.claude/active-chats.md` that predates recent changes.
2. **Read `.claude/active-chats.md`**. See what other AI agents are currently touching and which files they're likely to change. Race conditions on `main` are the norm across multiple concurrent agents.
3. **Read `CLAUDE.md`** (if present — a minimal one lives at repo root). Also read `github.com/tickadoo/howard` → `CLAUDE.md` for the broader tickadoo project context (supplier pipeline, booking flows, content rules, team). Anything in Howard's CLAUDE.md that applies to the MCP server applies here too.
4. **Before each push**: `git pull --rebase origin main` again. Multiple agents push to `main` concurrently — racing is the default, not the exception.

## Slack channel for all AI agents: `#ai-activity` (`C0ATET93PQV`)

Every AI agent posts status updates here so Francis and the other agents can see what's happening in one place.

Post format by agent type:

**Codex**:
```
🤖 Codex [{task-slug}]: {message}
```
Use for task-start, progress, and task-complete. Keep messages short and concrete. If a task produces multiple commits, reference all of them (or the range `<first-sha>..<last-sha>`) in the done post.

**Claude chats** (session-based):
```
👋 [howardmcp] session active — working on: <scope>
✅ [howardmcp] pushed <sha> — <what>
👋 [howardmcp] session paused — next: <handoff>
```

**Claude Code** (session-based, local):
```
👋 [claudecode-tickadoo-mcp] session started in /path/to/repo
✅ [claudecode-tickadoo-mcp] committed <sha> — <what>
```

Post via the Slack MCP. If you don't have it available, include your status in your final message and ask the user to relay.

## Commit trailer convention

Every commit carries a trailer on the last line of the commit message (after a blank line):

```
Claude-Chat: <agent-name>
```

Examples currently in use on this repo:
- `Claude-Chat: howardmcp` (already on the v1.4.2 commits)
- `Claude-Chat: howardops` (Francis's coordination chat; cross-repo presence)
- `Claude-Chat: codex-<task-slug>` (e.g. `codex-mcp-perf-check`)

Despite the "Claude-" prefix, the label is shared across all AI agents. The name stuck for historical reasons and will stay.

Query commits by agent:
```bash
git log --grep='Claude-Chat: howardmcp' --oneline
git log --all --pretty='%h %s %(trailers:key=Claude-Chat,valueonly)'
```

## Current agent registry

- **howardmcp** — Francis's Claude chat. Primary driver of this repo. v1.4.2 release, agent intelligence layer, distribution work.
- **howardops** — Francis's Claude chat. Primarily coordinates in the Howard repo but occasionally touches this one for convention / cross-repo work.
- **codex-<task-slug>** — Codex tasks. Task-based, stateless. Parallel-safe when files don't overlap.

Naming convention: Francis's chats (`howardmcp`, `howardops`, `howardcms`) use historical no-prefix names. Other team members prefix with their first name (`mark-`, etc.). Codex tasks use `codex-<slug>`. Claude Code sessions use `claudecode-<repo-name>`.

See `.claude/active-chats.md` for current status of each.

## Scope discipline

- If your task would touch a file another agent is actively editing, stop. Post to `#ai-activity` asking Francis or the other agent to confirm before proceeding.
- Codex tasks that run in parallel must not touch the same file.
- Prefer surgical commits. Smaller changes rebase cleaner against racing agents.

## Auto mode, Routines, and /ultrareview (Claude Code features, 17 April 2026)

Anthropic shipped several new Claude Code capabilities on 17 April. Short version:

- **Opus 4.7** is the current CC default. Default effort is xhigh. Switch to `/effort high` for cost/intelligence balance on simpler tasks.
- **Auto mode** (Shift+Tab in CC, research preview) — classifier-based permission handling for long autonomous tasks. Use it when the plan is pre-written.
- **Routines** (research preview) — prompts in `.claude/routines/`, run on CC web infrastructure (no laptop needed), triggered by schedule / API / GitHub webhook. Each routine is an AI agent under this convention: it must post to `#ai-activity` on start / progress / done, and every routine commit carries `Claude-Chat: routine-{routine-name}`. See GRO-196 (setup) and GRO-216 (Slack wiring). Note: most routines live in the Howard repo, but this repo may gain its own over time.
- **`/ultrareview`** — careful-review pass, 3 free runs per account. For this repo, save one for the pre-deploy review of the full 14-tool port in GRO-214 Phase 3.
- **Dispatch** (Pro/Max, research preview) — kick off tasks from phone, runs locally via desktop app.

Routine message format mirrors Codex:
```
🤖 Routine [{routine-name}]: starting — triggered by {schedule|webhook|api|manual}
🤖 Routine [{routine-name}]: {progress update}
🤖 Routine [{routine-name}]: done — pushed {sha(s)} — {what shipped}
```

Dashboard: `claude.ai/code/routines`. Docs: `code.claude.com/docs/en/routines`.

## Repo specifics

- **Package name**: `@tickadoo/mcp-server`
- **Deploys via**: Cloudflare Workers — `wrangler.jsonc` (main MCP worker at `mcp.tickadoo.com`) + `widgets-worker/wrangler.jsonc` (widgets at `widgets.tickadoo.com`). CI in `.github/workflows/deploy-cf.yml`.
- **Tests**: vitest (`npm test` or `npm run test`)
- **Build**: `npm run build` (esbuild → `dist/index.js` for npm stdio); Worker bundling runs inside `wrangler deploy`.
- **Key dirs**: `src/` (shared MCP server + worker entrypoint), `widgets-worker/` (separate embeds Worker), `api/` (legacy Node HTTP handlers, still used by `scripts/dev-http.ts` and one test), `tests/` (vitest), `scripts/` (dev/e2e utilities).
- **Product data source**: Howard backend (`howard-api.mark-e43.workers.dev`) — this server queries Howard for product/city data and exposes MCP tools on top.
- **MCP registries**: published to npm, MCP Marketplace (`io-github-tickadoo-tickadoo-mcp` canonical, `io-github-francistickadoo-tickadoo-mcp` duplicate pending removal).

## Related repos

- **`tickadoo/howard`** — internal backend, customer-facing platform, agent fleet. Shared conventions live in its `CLAUDE.md` and `AGENTS.md`. Any cross-repo work coordinates via `#ai-activity`.
