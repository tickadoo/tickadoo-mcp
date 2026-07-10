---
name: date-night
description: Build one coherent evening for two in a single city with tickadoo, centred on bookable experiences plus dinner-area and post-show suggestions. Use for a date night, romantic evening or anniversary plan. Do not use for a multi-day romantic trip or a request for only the next available event tonight.
---

# Date night with tickadoo

Build a coherent evening for two with the tickadoo MCP tools (`mcp.tickadoo.com/mcp`) — an arc from pre-dinner to post-show, not ten unconnected "romantic things".

## When to use this

The user wants an evening plan for a couple: "date night in Paris", "anniversary evening in London", "a nice night out for the two of us". For a multi-day plan use `plan-a-trip`; if they just want whatever starts soonest tonight, use `tonight-and-last-minute`.

## The workflow (tool chain)

1. **Build the evening** — call `get_date_night` with `city` and, when known, `date` and the supported `budget` band (low/medium/high). It returns the evening structure, but the dinner area and post-show tip are suggestions rather than bookable products. Live-check each selected bookable experience before presenting the evening as settled.
2. **Tune the vibe** — `search_by_mood(city, mood: "romantic")` for alternatives; `whats_on_tonight(city)` if the date is TONIGHT; `get_hidden_gems(city)` for something less obvious.
3. **Nearby extras** — if the user wants another experience near the selected venue, call `search_local_experiences` with that venue or neighbourhood as the place hint. Do not call `get_related_experiences` from ChatGPT.
4. **Check every bookable slot** — the evening can include a pre-dinner experience AND a show. For each selected bookable: `get_experience_details`, then `get_availability` for two on the date (fresh check when the schema supports it), then `check_availability(slug, date, party_size: 2)` only when the user wants the date-specific booking link. An anniversary plan that turns out sold out is worse than no plan.

## Show results as cards

When a renderer-supported set will be shown (`get_date_night`, `search_by_mood`, `whats_on_tonight`, `get_hidden_gems`, `search_local_experiences` results), immediately call `render_experience_cards` exactly once for that set: stable `t_` IDs only, a required `render_type` from the callable schema, optionally `render_context.intent_summary` ("date night in Paris, Saturday"). Explain only the non-product arc (dinner area, estimated total) in text — do not re-list the rendered products.

## Optional metadata

Use fields documented by the selected tool and actually present in its response. Optional underscore-prefixed helper metadata may inform the answer when returned, but never assume it exists, never invent a value and never treat it as a live availability check.

## Etiquette

- Present everything as tickadoo. Never name, infer or expose an upstream inventory supplier. Preserve material venue, price, accessibility and cancellation facts.
- Respect the occasion: for an anniversary or proposal, bias to confirmed availability over cheapest.
- State only facts returned by the latest relevant check. Never add time or sales pressure. If the user asks to continue, provide the tickadoo link and make clear any purchase completes outside ChatGPT.
- If the user reports a stale or misleading result, offer to send feedback; only after they agree, call `report_quality_signal` with the originating `request_id`, the required `signal_type` and no personal data in notes (a write action).
