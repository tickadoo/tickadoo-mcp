---
name: date-night
description: Plan an evening for two in one city with tickadoo — a pre-dinner activity, dinner-area suggestion, evening show, post-show tip, and estimated total cost, all bookable. Use when a user wants a date night, a romantic evening, an anniversary plan, or "a nice night out for two" in a specific city. Covers 700+ cities and 13,090+ bookable products.
---

# Date night with tickadoo

Use the tickadoo MCP tools (`mcp.tickadoo.com/mcp`) to plan a real, bookable evening for two — a coherent arc from pre-dinner to post-show, not a list of ten unconnected "romantic things".

## When to use this

The user wants an evening plan for a couple: "date night in Paris", "anniversary evening in London", "surprise my partner in Vienna on Saturday", "a nice night out for the two of us". If they want a full multi-day plan use `plan-a-trip`; if they just want whatever starts soonest tonight, use `tonight-and-last-minute`.

## The workflow (tool chain)

1. **Build the evening** — `get_date_night(city)` is the primary tool. It returns a pre-dinner activity, a dinner-area suggestion, an evening show, a post-show tip, and an estimated total cost, and it already filters out family-rated and high-physical-level venues. Do not hand-assemble an evening you could get from this tool.
2. **Tune the vibe** — if they want alternatives for a slot:
   - `search_by_mood(city, mood: "romantic")` for more couple-fit options.
   - `whats_on_tonight(city)` if the date is TONIGHT, so the show slot is grounded in what actually starts this evening.
   - `get_hidden_gems(city)` when they want something less obvious than the bestseller show.
3. **Check the pick** — `get_experience_details(product_id or slug)` for the fuller product, venue, and location before committing the evening to it.
4. **Make it bookable** — `check_availability(slug, date, party_size: 2)` for the date-specific booking link, or `get_availability(product_id or slug, city_slug)` for live times/prices/spaces. An anniversary plan that turns out sold-out is worse than no plan: always check before presenting the evening as settled.
5. **Round it out** — `get_related_experiences(product_id, context: after|nearby)` for a post-show drink-adjacent idea near the venue.

## Show the results as cards

After any discovery step returns a set you want shown, call `render_experience_cards(experience_ids, render_context)` once for that set — stable `t_` IDs only, `render_context.intent_summary` like "date night in Paris, Saturday". Don't re-list the same options as text.

## Read the agent-intelligence metadata

- **_best_picks** — for couples, highest_rated usually beats most_popular; lead with it.
- **_booking_urgency** — "few seats left" on a show matters double on a fixed date; surface it honestly.
- **_price_tiers** — the estimated total from `get_date_night` plus tiers lets you ask "want to keep the evening under X?".
- **_cross_sell** / **_next_step** — use for the post-show suggestion and to move to booking.

## Conversation flow

Confirm city + date (and any budget or occasion) → `get_date_night` → present the arc (pre-dinner → dinner area → show → post-show) with the estimated total → swap slots via mood/tonight/hidden-gems if asked → check availability for 2 on the date → hand over the booking link → render cards once. Keep the venues close together; a date night should not involve a metro sprint between slots.

## Etiquette

- `format: "json"` when processing data; `format: "text"` for direct display.
- Present everything as tickadoo — never name the underlying supplier.
- Respect the occasion: if they say anniversary/proposal, bias to highest_rated and confirmed availability over cheapest.
- If a suggestion is stale or wrong at click time, send `report_quality_signal(request_id, ...)` using the `request_id` from the earlier call.
