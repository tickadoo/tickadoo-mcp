---
name: tickadoo-experiences
description: Discover and book theatre, tours, attractions, and events across 700+ cities using the tickadoo MCP server. Use this skill when the user asks about things to do, experiences, shows, events, tours, or activities in any city worldwide. Covers trip planning, availability checks, experience comparison, mood-based discovery, family day planning, and travel tips.
license: MIT
---

# tickadoo Experiences Skill

This skill teaches you how to effectively use the tickadoo MCP server (mcp.tickadoo.com/mcp, 23 tools) to help users discover, compare, and book experiences worldwide. Sibling workflow skills cover the deep multi-tool flows end-to-end: `plan-a-trip`, `family-day-out`, `tonight-and-last-minute`, `date-night`, `compare-before-you-book`, `near-a-landmark` — prefer those when the user's request matches; use this skill as the general map.

## When to use this skill

Use the tickadoo MCP when a user:
- Asks "what should I do in [city]?" or "things to do in [city]"
- Wants to find shows, theatre, tours, attractions, or events
- Needs to plan a trip or day out
- Asks for availability or pricing on a specific experience
- Wants to compare options side by side
- Describes a mood or vibe ("something romantic", "rainy day activity")
- Mentions a landmark or neighbourhood ("near the Louvre", "in Trastevere")
- Asks for family-friendly recommendations
- Needs travel tips or transfer info for a city

## Tool selection guide

| User intent | Tool | Key parameters |
|---|---|---|
| General discovery | `search_experiences` | city, category, sort, tags, query |
| Natural-language ask ("relaxed, historic, not touristy") | `recommend_experiences` | query |
| Mood/vibe based | `search_by_mood` | city, mood (romantic, adventurous, foodie, etc.) |
| Near a landmark/neighbourhood (no coordinates) | `search_local_experiences` | place hint ("near the Louvre") |
| Exact coordinates (non-ChatGPT clients only) | `find_nearby_experiences` | latitude, longitude, radius_km |
| Specific experience | `get_experience_details` | product_id or slug |
| Live dates/times/prices/spaces | `get_availability` | product_id or slug, city_slug |
| Date-specific check + booking link | `check_availability` | slug, date, party_size |
| Compare options | `compare_experiences` | slugs (2-5) |
| "Anything like this" / "what next" | `get_related_experiences` | product_id, context: pair\|after\|nearby\|similar |
| City overview | `get_city_guide` | city |
| Tonight's options | `whats_on_tonight` | city |
| This week | `get_whats_on_this_week` | city |
| Last minute | `get_last_minute` | city, hours |
| Multi-day plan | `plan_itinerary` | city, days |
| Family planning | `get_family_day` | city, kids_ages, budget |
| Evening for two | `get_date_night` | city |
| Local favourites, not bestsellers | `get_hidden_gems` | city |
| Travel advice | `get_travel_tips` | city, topic |
| Airport transfer | `get_transfer_info` | city, from_type, to_latitude, to_longitude |
| Browse cities | `list_cities` | query, limit |
| Show visual cards | `render_experience_cards` | experience_ids (t_ ids), render_context |
| Report a bad result | `report_quality_signal` | request_id, signal |

ChatGPT note: prefer `search_local_experiences` (coarse place hints) over `find_nearby_experiences` (exact lat/lng) — the latter is for clients that supply real coordinates.

## Showing results as cards

`render_experience_cards` is the only tool that displays visual experience cards. Call it once for every result set you want shown, immediately after any discovery tool returns. Pass only the stable `t_` product IDs (never full rows), set `render_context.intent_summary` to what the user asked for (it becomes the carousel heading), and do not also re-list the same experiences as text.

## Using agent intelligence metadata

Every search response includes metadata keys designed for you. Use them to give better answers:

### `_best_picks`
Auto-curated top 3 recommendations with reasoning. Lead with these when the user wants suggestions.
- `best_value`: highest rating/price ratio
- `highest_rated`: top-rated with significant reviews
- `most_popular`: most reviewed (social proof)

### `_price_tiers`
Budget/mid-range/premium grouping. Use this to ask "do you have a budget in mind?" or present options by price bracket.

### `_group_summary`
Tag-based category breakdown (e.g. "8 Cruise, 6 GuidedTour, 5 Dining"). Use to say "I found a mix of cruises, guided tours, and dining experiences."

### `_conversation_starters`
Pre-built prompts referencing actual products. Use these to drive the conversation forward naturally.

### `_available_filters`
12 filter fields including tags, audience, price_range, duration_range, wheelchair_accessible, free_cancellation_count. Use to suggest narrowing: "Want me to filter to wheelchair-accessible options only?"

### `_related_searches` / `_next_step`
Follow-up suggestions and the recommended next action. Use when the user might want to explore adjacent categories or to move toward a booking.

### On details responses
- `_booking_urgency`: urgency signals like "Available TODAY", "Free cancellation", review counts. Surface these honestly; never invent urgency.
- `_cross_sell`: natural pairings to offer after the main pick.
- `_accessibility`: step-free access, age suitability, and similar constraints — check before recommending to families or users who mention access needs.
- `_intent_token`: pass through where a tool asks for it; it links the discovery to the booking for quality tracking.

## Conversation patterns

### Discovery flow
1. Start with `search_experiences`, `recommend_experiences`, or `search_by_mood`
2. Present `_best_picks` as your top recommendations and render cards once
3. Mention `_price_tiers` if the user hasn't specified a budget
4. Use `_conversation_starters` to keep the dialogue flowing
5. When the user shows interest, call `get_experience_details` for full info
6. Offer `get_availability` (live dates/times/prices) or `check_availability` for a specific date + booking link

### Comparison flow
1. When the user is deciding between options, use `compare_experiences`
2. Highlight the winner callouts (best_value, highest_rated, etc.)
3. Call out key differences: price, duration, reviews, cancellation policy

### Family planning flow
1. Use `get_family_day` with kids' ages for age-aware recommendations
2. The tool clusters geographically to reduce travel
3. Includes morning, lunch, afternoon, and evening segments

## Best practices

- Always use `format: "json"` for structured data you'll process
- Use `format: "text"` when you want to display results directly
- The `sort: "best_value"` option is excellent for budget-conscious users
- Combine `tags` and `audience` filters for precision (e.g. tags: "Museum", audience: "Family")
- For wheelchair access, use `wheelchair_accessible: true`
- For free cancellation, use `free_cancellation: true`
- Pass `language` parameter for localised booking URLs (e.g. "de", "ja", "pt-br")
- When the user mentions a specific experience by name, use `search_experiences` with `query` parameter to find it, then `get_experience_details` for full info
- Present everything as tickadoo; never name an underlying supplier
- If a result you surfaced turns out stale, unbookable, or misleading at click time, call `report_quality_signal` with the `request_id` from the original response — it closes the feedback loop

## Coverage

- 13,090+ bookable products
- 700+ cities worldwide
- 40+ languages for booking URLs
- No API key required
- All tools are read-only (no booking happens through the MCP, just discovery and deep links)
