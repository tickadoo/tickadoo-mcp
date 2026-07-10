---
name: near-a-landmark
description: Find experiences near a named landmark, neighbourhood, hotel or venue with tickadoo, without asking for coordinates. Use when proximity is the main constraint and no higher-priority comparison, multi-day, coherent family-day, coherent date-night or immediate-time workflow applies. If the place is unnamed, ask for it.
---

# Near a landmark with tickadoo

Use the tickadoo MCP tools (`mcp.tickadoo.com/mcp`) when the ask is anchored to a PLACE inside a city. "Things to do near the Louvre" is a different question from "things to do in Paris".

## When to use this

The user names a landmark, neighbourhood, square, venue or area: "near the Louvre", "in Trastevere", "around Times Square". If the place is unnamed ("walking distance from my hotel"), ask which hotel or area they mean — never guess. If they mean the whole city, use city-wide discovery instead.

## The workflow (tool chain)

1. **Place-anchored search** — `search_local_experiences(place_hint, city?)` is the primary tool. It takes the coarse place phrase directly (no coordinates) and matches first by exact venue/neighbourhood, then falls back to the city centre. Do not use `find_nearby_experiences` from ChatGPT (it needs real coordinates), and never guess coordinates.
2. **Say what "near" meant** — prefer exact venue or neighbourhood matches over city-centre fallback results, and say which you got ("I couldn't anchor to that exact spot, so these are central-Paris options"). Do not claim or rank by walking time unless returned location data supports it.
3. **Enrich the picks** — `get_experience_details(product_id or slug)` for the actual location before making any proximity claim.
4. **Check the pick** — `get_availability` for the selected product (date range, party size, fresh when supported), then `check_availability(slug, date, party_size)` only when the user wants the date-specific booking link.
5. **"While you are there" pair** — run a new `search_local_experiences` call anchored to the selected venue or area. `get_travel_tips(city, topic: "transport")` if they ask how to get there.

## Show results as cards

When a `search_local_experiences` set will be shown, immediately call `render_experience_cards` exactly once for it: stable `t_` IDs only, a required `render_type` from the callable schema, optionally `render_context.intent_summary` ("near the Louvre this afternoon"). Do not re-list the same experiences in text.

## Optional metadata

Use fields documented by the selected tool and actually present in its response. Optional underscore-prefixed helper metadata may inform the answer when returned, but never assume it exists, never invent a value and never treat it as a live availability check.

## Etiquette

- Present everything as tickadoo. Never name, infer or expose an upstream inventory supplier.
- Never oversell proximity: check the details' location before claiming distances.
- State only facts returned by the latest relevant check. Never add time or sales pressure. If the user asks to continue, provide the tickadoo link and make clear any purchase completes outside ChatGPT.
- If the user reports a stale, mis-located or misleading result, offer to send feedback; only after they agree, call `report_quality_signal` with the originating `request_id`, the required `signal_type` and no personal data in notes (a write action).
