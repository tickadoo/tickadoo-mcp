---
name: plan-a-trip
description: Plan a multi-day trip for a single city with tickadoo — turn "what should I do in Rome for 3 days?" into a day-by-day, geographically-sensible plan of bookable experiences. Use when a user wants an itinerary, a multi-day plan, or help filling several days in one city with things to do. Covers 700+ cities and 13,090+ bookable products.
---

# Plan a trip with tickadoo

Use the tickadoo MCP tools (`mcp.tickadoo.com/mcp`) to build a real, bookable multi-day plan for ONE city, not a generic listicle. The whole point is that every suggestion can be checked for live availability and booked, so lean on the tools instead of prior knowledge.

## When to use this

The user wants to fill more than one time slot or more than one day in a single city: "3 days in Barcelona", "what should we do in Tokyo this weekend", "plan our London trip", "a Paris itinerary for a couple". If they only want one thing right now, or tonight, use the discovery / tonight skills instead.

## The workflow (tool chain)

1. **Orient** — `get_city_guide(city)` first. It returns highlights, dominant categories, price band, best-for audience hints, and seasonal notes. Use it to set expectations and to pick a sensible mix, and mention the seasonal note if relevant. If the city is ambiguous or misspelled, `list_cities(query)` to confirm the slug.
2. **Gather candidates** — pull a pool to plan from:
   - `search_experiences(city, category?, tags?, sort?)` for named interests ("museums", "food tours").
   - `recommend_experiences(query)` when they describe what they want in prose ("relaxed, lots of history, not too touristy").
   - `search_by_mood(city, mood)` for a vibe ("romantic", "foodie", "rainy day").
   - `get_hidden_gems(city)` to add a local-favourite or two so the plan is not all bestsellers.
3. **Build the plan** — `plan_itinerary(city, days, ...)`. It returns morning / afternoon / evening slots per day with geographic clustering, category diversity, and a running total cost. This is the backbone — do not hand-assemble a plan you could get from this tool.
4. **Enrich the picks** — for each experience the user shows interest in, `get_experience_details(product_id or slug)` for the richer product, location, and booking fields.
5. **Make it bookable** — `get_availability(product_id or slug, city_slug)` for live dates/times/prices/spaces, or `check_availability(slug, date, party_size)` when they name a date and party and want a booking link. Never assert something is available without checking.
6. **Fill gaps / pair things** — `get_related_experiences(product_id, context: pair|after|nearby|similar)` to slot in a nearby lunch or an after-show idea.

## Show the results as cards

After ANY discovery/search step returns a set you want to show, call `render_experience_cards(experience_ids, render_context)` exactly once for that set. Pass only the stable `t_` product IDs, and set `render_context.intent_summary` to what the user asked for (city, dates, audience) — it becomes the carousel heading. Do not also re-list those experiences as text.

## Read the agent-intelligence metadata

Every search response carries metadata — use it, don't ignore it:

- **_best_picks** — lead each day's options with these (best_value / highest_rated / most_popular).
- **_price_tiers** — if budget matters, present by bracket or ask "what's your budget for the trip?".
- **_group_summary** — narrate the mix ("I've balanced two big sights, a food tour, and a relaxed evening").
- **_conversation_starters** / **_next_step** — use these to move the plan forward ("want me to lock in Tuesday's availability?").
- **_booking_urgency** — surface genuine urgency (available today, free cancellation) honestly, never invented.

## Conversation flow

City guide → gather a candidate pool → `plan_itinerary` → present day-by-day with `_best_picks` up front and a running cost → offer to check availability on the dates that matter → render cards once per set. Keep geography tight (don't zig-zag across the city), keep category variety, and respect the budget signal.

## Etiquette

- Always `format: "json"` when you're processing data; `format: "text"` only for direct display.
- Present everything as tickadoo — never name the underlying supplier.
- If something you surfaced turns out stale or wrong at click time, send `report_quality_signal(request_id, ...)` with the `request_id` from the earlier call so tickadoo can fix it.
