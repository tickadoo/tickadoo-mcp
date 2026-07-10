---
name: tonight-and-last-minute
description: Find experiences in a city tonight or within the next few hours with tickadoo, followed by a current availability check on the selected option. Use when immediacy is the deciding constraint. If the user explicitly asks for a coherent multi-stop date night or full family day, use that planning skill and perform same-day checks within it.
---

# Tonight & last-minute with tickadoo

Use the tickadoo MCP tools (`mcp.tickadoo.com/mcp`) when the user wants to do something NOW or tonight. Be fast, lead with what starts soonest, and confirm current availability before stating anything is bookable — same-day inventory is exactly what goes stale.

## When to use this

"What's on tonight in Berlin", "anything to do right now", "last-minute tickets this evening". If they're planning ahead (a future date, a multi-day trip), use the planning skills instead.

## The workflow (tool chain)

1. **Pull time-sensitive options** — by horizon: `whats_on_tonight(city)` for tonight, `get_last_minute(city, hours?)` for the next few hours. Use `start_time` and `countdown_text` when present in the response; do not assume they exist or invent them.
2. **Narrow to a pick** — `get_experience_details(product_id or slug)` on the one they react to; keep it quick.
3. **Live-check the pick** — `get_availability` for the selected product with the party size, requesting a fresh check when the callable schema supports it (this is the live supplier check; a countdown hint is not). Use the local calendar date contained in the selected result's `start_time` — do not derive "today" from the assistant's system timezone. Then `check_availability(slug, date, party_size)` only when the user wants the date-specific booking link.
4. **Fallback** — if the first pick is unavailable or has started, refresh `get_last_minute` or `whats_on_tonight`, then live-check the next candidate. Do not call `get_related_experiences` from ChatGPT.

## Show results as cards

When a `whats_on_tonight` / `get_last_minute` set will be shown, immediately call `render_experience_cards` exactly once for it: stable `t_` IDs only, a required `render_type` from the callable schema, optionally `render_context.intent_summary` ("tonight in <city>"). Do not re-list the same experiences in text. Do not assume a particular field appears on the cards unless the renderer response confirms it.

## Optional metadata

Use fields documented by the selected tool and actually present in its response. Treat countdowns, remaining-seat hints and optional urgency metadata as preliminary — only a selected-product availability check supports an availability or scarcity claim.

## Etiquette

- Present everything as tickadoo. Never name, infer or expose an upstream inventory supplier.
- State only the exact time, inventory, availability or cancellation fact returned by the latest relevant check. Review counts show popularity, not scarcity. Never add time pressure or sales pressure.
- If the live check comes back sold out or past start time, say so plainly and offer the next candidate. If the user asks to continue, provide the tickadoo link and make clear any purchase completes outside ChatGPT.
- If the user reports a stale or misleading result, offer to send feedback; only after they agree, call `report_quality_signal` with the originating `request_id`, the required `signal_type` and no personal data in notes (a write action).
