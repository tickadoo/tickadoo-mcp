# Active AI agents — tickadoo-mcp

Track what each AI agent (Claude chat, Claude Code session, Codex task) is working on in this repo. Prevents collisions when multiple agents push to `main` concurrently.

**At session start**: read this file. Search Slack `#ai-activity` (`C0ATET93PQV`) for recent activity. Update your own entry here.
**At session end**: mark your entry as paused or update `last_commit` and `last_active`.

**Live feed**: Slack `#ai-activity` (`C0ATET93PQV`) — all agents post session-start / commit / session-paused updates. More timely than this file since this only updates at session boundaries.

**Every commit** carries a trailer `Claude-Chat: <agent-name>` (see `AGENTS.md` for full conventions).

---

## howardmcp
- **Status**: active (primary driver of this repo)
- **Scope**: development of `@tickadoo/mcp-server` — MCP tool design, agent intelligence layer, distribution (Marketplace, npm, Anthropic Connectors Directory). Recent: v1.4.2 release shipped 16 Apr with `_best_picks`, `_price_tiers`, `_group_summary`, smart `_conversation_starters`.
- **Files typically changed**: `src/**`, `api/**`, `package.json`, `server.json`, `README.md`, `.well-known/mcp.json`, deploy configs
- **Last commit**: `a53b5c5` (docs: README v1.4.2 with Agent Intelligence Layer)
- **Last active**: 2026-04-17
- **Notes**: Already uses `Claude-Chat: howardmcp` trailer (has since before the convention was formalised). Already posts to `#ai-activity`. This file and `AGENTS.md` newly added 17 Apr to formalise the convention at repo level.

## howardops
- **Status**: intermittent — primarily works on the Howard repo, occasionally touches this one for cross-repo work (convention replication, coordination doc updates)
- **Scope**: multi-agent coordination, PR reviews, convention docs, small surgical fixes
- **Files typically changed**: `CLAUDE.md`, `AGENTS.md`, `.claude/**`, occasional cross-repo alignment work
- **Last commit**: (cross-repo — this file and surrounding convention docs)
- **Last active**: 2026-04-17
- **Notes**: If howardops is active here, it's doing coordination / doc alignment, not MCP feature work. Won't race with howardmcp.

## Codex (task-based, stateless)
- **Status**: task-based — does not maintain a persistent entry here
- **Scope**: contributed ~10 tools to the MCP server in earlier sessions. Currently fires ad-hoc on performance / quality checks / doc cleanups.
- **Files typically changed**: varies by task (see task slug / `#ai-activity` for current scope)
- **Notes**: Codex reads `AGENTS.md` at task start. Uses per-task worktrees under `.claude/worktrees/` (e.g. `brave-bassi`, `festive-austin`). Each task posts to `#ai-activity` with format `🤖 Codex [{task-slug}]: {message}`. Commit trailer: `Claude-Chat: codex-<task-slug>`.

## claudecode-tickadoo-mcp
- **Status**: present on Francis's Mac but only active when explicitly used in this repo
- **Scope**: local heavy lifting — multi-file edits, running tests, branch work
- **Files typically changed**: varies
- **Notes**: reads `CLAUDE.md` at session start. Should post session-start to `#ai-activity` and adopt `Claude-Chat: claudecode-tickadoo-mcp` trailer.

---

## Other team members

Mark and other engineers (Marek, Radoš, Dominik) mostly work on the Howard repo via Cursor / VS Code / embedded AI tooling rather than dedicated Claude chats on this repo. If any of them start doing tickadoo-mcp work through a Claude chat, they should follow the `firstname-<scope>` naming pattern (e.g. `mark-mcp`).

---

## Archive (completed/paused chats)

_None yet._
