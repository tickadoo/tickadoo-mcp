---
name: tonight-and-last-minute
description: Find experiences in a city tonight or within the next few hours with tickadoo, followed by a current availability check on the selected option. Use when immediacy is the deciding constraint. If the user explicitly asks for a coherent multi-stop date night or full family day, use that planning skill and perform same-day checks within it.
---

# Tonight & last-minute with tickadoo

Use the discovery-only tickadoo MCP tools (`mcp.tickadoo.com/mcp/agents`) when the user wants to do something NOW or tonight. Be fast, lead with what starts soonest, and confirm current availability before stating anything is available; same-day inventory is exactly what goes stale.

## When to use this

"What's on tonight in Berlin", "anything to do right now", "last-minute tickets this evening". If they're planning ahead (a future date, a multi-day trip), use the planning skills instead.

## The workflow (tool chain)

1. **Pull time-sensitive options** — by horizon: `whats_on_tonight(city)` for tonight, `get_last_minute(city, hours?)` for the next few hours. Use `start_time` and `countdown_text` when present in the response; do not assume they exist or invent them.
2. **Narrow to a pick** — `get_experience_details(product_id)` on the one they react to; keep it quick.
3. **Live-check the pick** — `get_availability` for the selected product with the party size, requesting a fresh check when the callable schema supports it. Use the local calendar date contained in the selected result's `start_time`; do not derive "today" from the assistant's system timezone. Use `check_availability(slug, date, party_size)` only for a date-specific informational check.
4. **Fallback** — if the first pick is unavailable or has started, refresh `get_last_minute` or `whats_on_tonight`, then live-check the next candidate. Use `get_related_experiences(product_id)` only if a related alternative is useful.

## Present same-day results

Summarise only facts returned by the time-sensitive search and subsequent availability check. Keep internal product identifiers out of the answer.

## Optional metadata

Use fields documented by the selected tool and actually present in its response. Treat countdowns, remaining-seat hints and optional urgency metadata as preliminary — only a selected-product availability check supports an availability or scarcity claim.

## Etiquette

- Present everything as tickadoo. Never name, infer or expose an upstream inventory supplier.
- State only the exact time, inventory, availability or cancellation fact returned by the latest relevant check. Review counts show popularity, not scarcity. Never add time pressure or sales pressure.
- If the live check comes back sold out or past start time, say so plainly and offer the next candidate.
- This public plugin is discovery-only. Never provide or construct a direct purchase, transaction, or checkout link, and never imply that an order or reservation was started.
