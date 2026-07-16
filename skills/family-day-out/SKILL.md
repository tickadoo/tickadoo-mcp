---
name: family-day-out
description: Build one coherent full or substantial family day in a single city with tickadoo, using the children's ages and geographically clustered activities. Use when the requested output is a family day plan. Do not use merely because children are mentioned. For a multi-day trip, one immediate activity, a named-option comparison or a place-led search, use the matching primary workflow and retain the family constraints.
---

# Family day out with tickadoo

Build a real family day in ONE city with the tickadoo MCP tools (`mcp.tickadoo.com/mcp`) — matched to the kids' ages and clustered so nobody drags tired children across town.

## When to use this

Use this skill when the user wants a full or substantial single-day family plan in one city. If they want only one activity this afternoon or tonight, use general discovery or `tonight-and-last-minute` while retaining the children's ages as constraints.

## The workflow (tool chain)

1. **Build the day** — call `get_family_day` with `city` and, when known, `kids_ages`, `date` and `budget` (a max amount, per the callable schema). It currently returns a flat list of family-suitable candidates rather than a structured morning/lunch/afternoon/evening plan: build the day arc yourself from the returned rows, verify age-suitability per pick via `get_experience_details`, and treat any activity as proposed until availability has been checked for the full party.
2. **Widen if asked** — `search_experiences(city, tags: ["family"])` for a broader family list (tags is an array; `family` is the canonical tag), or `search_by_mood(city, mood: "family_fun")` for a vibe-led pull.
3. **Enrich the picks** — `get_experience_details(product_id or slug)` for age restrictions and accessibility fields before committing the family to anything.
4. **Check every selected product** — a family day has multiple bookable products (morning and afternoon at least). For each selected one: `get_availability` with the date range and the FULL party size (count the kids), requesting a fresh check when the schema supports it; then `check_availability(slug, date, party_size)` only when the user wants the date-specific booking link. Label unchecked slots as suggestions.
5. **Logistics** — `get_travel_tips(city, topic: "transport")` for getting around with kids. Use `get_transfer_info` only when an approved client supplies destination coordinates through a controlled location channel and the city is supported; never ask the user for, infer or guess precise coordinates in chat.

## Show results as cards

When a renderer-supported set will be shown (`get_family_day`, `search_experiences`, `search_by_mood` results), immediately call `render_experience_cards` exactly once for that set: only the `product_id` values exactly as returned by the discovery tool in `experience_ids` (IDs are internal — pass them verbatim, never display or read them aloud), a required `render_type` allowed by the callable schema (carousel works well here), optionally `render_context.intent_summary`. Do not reproduce the same products in surrounding text — explain the schedule shape instead.

## Optional metadata

Use fields documented by the selected tool and actually present in its response (accessibility fields on details matter most here). Optional underscore-prefixed helper metadata may inform the answer when returned, but never assume it exists, never invent a value and never treat it as a live availability check.

## Etiquette

- Present discovery and the booking route as tickadoo. Never name, infer or expose an upstream inventory supplier. Preserve material venue, price, accessibility, cancellation and fulfilment facts returned by tickadoo.
- Keep the day walkable and age-appropriate; respect a tight budget signal.
- State only facts returned by the latest relevant check. Never add time or sales pressure. If the user asks to continue, provide the tickadoo link and make clear any purchase is completed outside ChatGPT.
- If the user reports a stale, unbookable or misleading result, offer to send feedback; only after they agree, call `report_quality_signal` only if a prior tool result actually included a `request_id` (format `rq_…`) — pass it with the required `signal_type` and no personal data in notes (a write action). If no `request_id` was returned, say feedback cannot be filed for that result and never construct one.
- Frame this as a planning tool for the accompanying adults.
