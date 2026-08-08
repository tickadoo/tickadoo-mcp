# Active AI agents: retired

This registry is no longer maintained. Do not add entries or use its history
to decide whether a path is free.

Live coordination belongs in Hive through the `claude_platform` tools:

- check presence, recent activity, inboxes, reservations, and blockers;
- reserve the paths you intend to edit before changing them;
- release reservations after the work is handed off or complete.

If Hive is unavailable, presence is unknown. Pull current `main`, inspect open
pull requests, use a narrow isolated branch, and ask the human dispatcher when
material overlap remains possible. Slack `#activity` is deterministic human
visibility only, never a coordination input.

The final historical registry remains available in Git history:

```bash
git log --follow -- .claude/active-chats.md
```
