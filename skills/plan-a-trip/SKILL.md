---
name: plan-a-trip
description: Build a multi-day itinerary in one city with tickadoo. Use when the user wants activities arranged across two or more days. This is the primary workflow for a multi-day request even when the user also mentions children, romance or a neighbourhood. Retain those constraints. Do not use for one evening, one family day, immediate same-day options or choosing between named experiences.
---

# Plan a trip with tickadoo

Build a real multi-day plan for ONE city with the tickadoo MCP tools (`mcp.tickadoo.com/mcp`), grounded in the catalogue rather than prior knowledge.

## When to use this

The user wants activities arranged across at least two days in one city, such as "three days in Barcelona", "plan our Tokyo weekend" or "a Paris itinerary from Monday to Thursday". If the request covers only one day or one time period, use the relevant discovery, family, date-night or tonight skill.

## The workflow (tool chain)

1. **Orient** — `get_city_guide(city)` for highlights, dominant categories, price band and seasonal notes. If the city is unclear or ambiguous, ask the user to clarify (use `list_cities` only to browse, optionally by country — it has no free-text query).
2. **Build the backbone** — call `plan_itinerary` with `city` and `days`. When known, also pass the user's `interests`, `audience`, `budget` band and `pace` using the callable schema. It independently returns the day slots, geographic clustering, category mix and running cost.
3. **Replace or widen only when needed** — use `search_experiences` for a named category, `recommend_experiences` for a natural-language preference, `search_by_mood` for a supported mood, or `get_hidden_gems` for one or two less-obvious options so the plan is not all bestsellers — only when the user asks to replace a slot or browse alternatives. Do not imply that an earlier candidate pool is consumed by `plan_itinerary`.
4. **Enrich and check selected items** — fetch `get_experience_details` for experiences the user is considering, then follow the live-availability sequence for each selected slot.

## Show results as cards

Only the renderer-supported search calls in this workflow (`search_experiences`, `recommend_experiences`, `search_by_mood`, `get_hidden_gems`) may feed `render_experience_cards`. Do not assume `get_city_guide` or `plan_itinerary` can be rendered. When such a set will be shown, immediately call `render_experience_cards` exactly once for it: only its stable `t_` IDs in `experience_ids`, a required `render_type` allowed by the callable schema, optionally `render_context.intent_summary`. Do not reproduce the same products in surrounding text. Present the itinerary itself as a plan, without duplicating any separately rendered search set.

## Availability discipline (composite plan)

Treat the returned plan as proposed until every selected bookable slot has been checked for the user's date and party size: `get_availability` per slot (product_id, or slug + city_slug; pass the date range and party size; request a fresh check when the schema supports it), then `check_availability(slug, date, party_size)` only when the user wants the date-specific booking link. If the user has not asked to check every slot, label unchecked slots as suggestions rather than confirmed bookable plans.

## Optional metadata

Use fields documented by the selected tool and actually present in its response. Optional underscore-prefixed helper metadata may inform the answer when returned, but never assume it exists, never invent a value and never treat it as a live availability check.

## Etiquette

- Present discovery and the booking route as tickadoo. Never name, infer or expose an upstream inventory supplier. Do not imply tickadoo operates the venue. Preserve material venue, price, accessibility, cancellation and fulfilment facts returned by tickadoo.
- State only the exact time, inventory, availability or cancellation fact returned by the latest relevant tool. Never add time pressure or sales pressure.
- If the user asks to continue, provide the tickadoo link and make clear that any purchase is completed outside ChatGPT.
- If the user reports a surfaced result was stale, unbookable or misleading, offer to send feedback to tickadoo; only after they agree, call `report_quality_signal` with the originating `request_id`, the required `signal_type` and no personal data in notes (it is a write action).
