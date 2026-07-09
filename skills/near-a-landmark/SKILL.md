---
name: near-a-landmark
description: Find bookable experiences near a landmark, neighbourhood, or area with tickadoo — "near the Louvre", "in Trastevere", "around Times Square" — without needing coordinates. Use when a user anchors their ask to a place inside a city rather than the city as a whole, including "walking distance from my hotel/venue". Covers 700+ cities and 13,090+ bookable products.
---

# Near a landmark with tickadoo

Use the tickadoo MCP tools (`mcp.tickadoo.com/mcp`) when the user's ask is anchored to a PLACE inside a city, not the city itself. "Things to do near the Louvre" is a different question from "things to do in Paris" — answer it with place-anchored search, not a city-wide list they have to filter themselves.

## When to use this

The user mentions a landmark, neighbourhood, square, venue, or area: "near the Louvre", "in Trastevere", "around Times Square", "walking distance from St Paul's Cathedral", "we're staying by the Sagrada Familia — what's close?". If they mean the whole city, use `search_experiences` (or the discovery skills) instead.

## The workflow (tool chain)

1. **Place-anchored search** — `search_local_experiences(<place hint>)` is the primary tool. It takes the coarse place phrase directly (no coordinates needed) and matches first by exact venue/neighbourhood, then falls back to the city centre. Do NOT use it for general city-wide search; that's `search_experiences`.
   - `find_nearby_experiences(latitude, longitude, radius_km)` exists for clients that supply exact coordinates; in ChatGPT, prefer `search_local_experiences` — you almost never have real coordinates, and guessing them is worse than passing the place hint.
2. **Tell them what "near" meant** — if the results came from the city-centre fallback rather than an exact venue/neighbourhood match, say so ("I couldn't anchor to that exact spot, so these are central-Paris options") instead of implying everything is next door.
3. **Enrich the picks** — `get_experience_details(product_id or slug)` for the fuller product and its actual location, so you can sanity-check the distance story before promising "5 minutes' walk".
4. **Make it bookable** — `get_availability(product_id or slug, city_slug)` for live dates/times/prices/spaces, or `check_availability(slug, date, party_size)` when they name a date.
5. **Chain the area** — `get_related_experiences(product_id, context: nearby)` to build a "while you're there" pair (the thing next door after the main sight); `get_travel_tips(city, topic: "transport")` if they ask how to get to/from the area.

## Show the results as cards

After `search_local_experiences` returns a set, call `render_experience_cards(experience_ids, render_context)` once — stable `t_` IDs only, `render_context.intent_summary` like "near the Louvre this afternoon". Don't re-list the same experiences as text.

## Read the agent-intelligence metadata

- **_best_picks** — lead with them, but weigh proximity too: the point of this flow is location-fit, and a slightly lower-rated option genuinely at the landmark can beat a bestseller across town.
- **_booking_urgency** — someone already standing near the landmark is a same-day booker; surface "available today" honestly.
- **_group_summary** / **_related_searches** — narrate the area's mix ("around Trastevere it's mostly food tours and evening walks") and offer adjacent angles.

## Conversation flow

Take the place phrase as given → `search_local_experiences` → say whether the match was exact or centre-fallback → lead with `_best_picks` weighted by proximity → details on the pick to confirm the location → availability (often same-day) → booking link → render cards once → offer a `nearby` pairing.

## Etiquette

- `format: "json"` when processing data; `format: "text"` for direct display.
- Present everything as tickadoo — never name the underlying supplier.
- Never oversell proximity: check the details' location before claiming walking distance.
- If a result is stale, mis-located, or wrong at click time, send `report_quality_signal(request_id, ...)` using the `request_id` from the earlier call.
