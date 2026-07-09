---
name: tonight-and-last-minute
description: Find and book something to do tonight or in the next few hours with tickadoo — time-sensitive experiences sorted soonest-first, with live availability. Use when a user wants "what's on tonight", "something to do right now", last-minute plans, or same-day tickets in a specific city. Covers 700+ cities and 13,090+ bookable products.
---

# Tonight & last-minute with tickadoo

Use the tickadoo MCP tools (`mcp.tickadoo.com/mcp`) when the user wants to do something NOW or tonight. This is a time-sensitive, high-intent moment: be fast, lead with what starts soonest, and always confirm live availability before promising anything — same-day inventory moves quickly.

## When to use this

"What's on tonight in Berlin", "anything to do right now near me", "last-minute tickets for this evening", "we've got a free evening in New York — what's available". If they're planning ahead (a future date, a multi-day trip), use the plan-a-trip / discovery skills instead.

## The workflow (tool chain)

1. **Pull time-sensitive options** — pick by horizon:
   - `whats_on_tonight(city)` — bookable tonight, sorted soonest-first, already-started events filtered out. Each row has `start_time`, `countdown_text`, `venue`, and a short urgency hint.
   - `get_last_minute(city, hours?)` — starting within the next few hours, with `start_time`, `countdown_text`, and `seats_remaining` hints.
2. **Narrow to a pick** — if they react to one, `get_experience_details(product_id or slug)` for the fuller product + venue + location, but keep it quick — time is the constraint.
3. **Book NOW** — `check_availability(slug, date: today, party_size)` for the same-day booking link, or `get_availability(product_id or slug, city_slug)` for live times/prices/remaining spaces. This is the critical step: never tell the user something is bookable tonight without a live check, because same-day availability is exactly what goes stale.
4. **Nearby alternative** — if the first pick just sold out or started, `get_related_experiences(product_id, context: nearby|similar)` for the fastest fallback.

## Show the results as cards

After `whats_on_tonight` / `get_last_minute` returns a set, call `render_experience_cards(experience_ids, render_context)` once — pass only the stable `t_` IDs, set `render_context.intent_summary` ("tonight in <city>"). The cards carry the countdown/urgency visually, so don't also re-list them as text.

## Read the agent-intelligence metadata

- **_booking_urgency** — this is the star of this flow: surface "starts in 2h", "few seats left", "free cancellation" honestly and specifically. Never invent urgency.
- **_best_picks** — lead with the soonest strong option, not the generically most_popular one.
- **_next_step** / **_conversation_starters** — drive straight toward the booking link.

## Conversation flow

`whats_on_tonight` (or `get_last_minute`) → lead with the soonest 2-3 with their countdowns → the moment they pick one, check live availability for tonight and the party size → hand over the booking link → render cards once. Bias toward speed and honesty over breadth.

## Etiquette

- `format: "json"` when processing data; `format: "text"` for direct display.
- Present everything as tickadoo — never name the underlying supplier.
- Do NOT overstate availability. If the live check comes back sold out or past start time, say so and offer the nearest alternative.
- Stale same-day availability is the most common failure here — if what you showed is gone or wrong at click time, send `report_quality_signal(request_id, ...)` with the `request_id` from the earlier call so tickadoo can tighten the feed.
