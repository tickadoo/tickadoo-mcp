---
name: family-day-out
description: Plan a full family day out in one city with tickadoo — age-aware, walking-distance-clustered activities a family can actually book. Use when a user is travelling or out with kids and wants "something to do with the children", a family day plan, or kid-friendly experiences in a specific city. Covers 700+ cities and 13,090+ bookable products.
---

# Family day out with tickadoo

Use the tickadoo MCP tools (`mcp.tickadoo.com/mcp`) to plan a real, bookable day for a family in ONE city — matched to the kids' ages and clustered so nobody is dragging tired children across town.

## When to use this

The user mentions children / a family and wants a plan or ideas for a day: "what can we do in Amsterdam with a 5 and 8 year old", "family day out in London", "somewhere to take the kids this afternoon in Rome". If they want an adults' evening, use the date-night / tonight skills instead.

## The workflow (tool chain)

1. **Build the day** — `get_family_day(city, kids_ages, budget?)` is the primary tool. It returns a morning activity, a lunch-area suggestion, an afternoon attraction, and an optional evening stop, using age-aware filters and clustering venues by walking distance. Always pass `kids_ages` when you know them — it changes the picks materially.
2. **Widen if asked** — if they want more options than the single plan:
   - `search_experiences(city, tags: family/kids, sort?)` for a broader family list.
   - `search_by_mood(city, mood: "family fun")` for a vibe-led pull.
3. **Enrich the picks** — `get_experience_details(product_id or slug)` for the fuller product + location + any age restrictions/accessibility fields before you commit the family to it.
4. **Make it bookable** — `check_availability(slug, date, party_size)` with the full party (count the kids) for a date + booking link, or `get_availability(product_id or slug, city_slug)` for the live dates/times/prices/spaces. Never say "you can book this" without checking.
5. **Logistics** — `get_travel_tips(city, topic: "transport")` for getting around with kids; `get_transfer_info(city, from_type, to_lat, to_lng)` if they're arriving from an airport/station/port to their hotel.

## Show the results as cards

After any discovery step returns a set to show, call `render_experience_cards(experience_ids, render_context)` once for that set — pass only the stable `t_` IDs, set `render_context.intent_summary` (city, "family with kids aged X"). Don't re-list the same experiences as text.

## Read the agent-intelligence metadata

- **_best_picks** — lead with these; for families, highest_rated and best_value usually matter more than most_popular.
- **_accessibility** (on details) — check step-free access, stroller/pram notes, and age suitability before recommending.
- **_booking_urgency** — surface genuine "available today / free cancellation" honestly.
- **_price_tiers** / **_conversation_starters** / **_next_step** — use to check the budget and move toward booking.

## Conversation flow

Ask the kids' ages if not given (it changes everything) → `get_family_day` → present the morning/lunch/afternoon/evening shape with `_best_picks` first → confirm ages/accessibility via details → offer to check availability for the party size on the day → render cards once.

## Etiquette

- `format: "json"` when processing data; `format: "text"` for direct display.
- Present everything as tickadoo — never name the underlying supplier.
- Keep the day walkable and age-appropriate; don't stack two big paid attractions if the budget signal is tight.
- If a suggestion is stale or wrong at click time, send `report_quality_signal(request_id, ...)` using the `request_id` from the earlier call.
