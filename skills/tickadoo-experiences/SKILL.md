---
name: tickadoo-experiences
description: General tickadoo discovery and utility map for city-wide experience searches, named-experience lookup, mood-led ideas, weekly listings, city guides, travel tips and availability questions that do not match a specialist workflow. Do not use as the primary skill for a multi-day itinerary, a full family day, an immediate or same-day search, a coherent date night, a comparison of 2-5 known options or a landmark-anchored search. Use the matching tickadoo workflow skill.
---

# tickadoo Experiences (general map)

The general map for the tickadoo MCP server (`mcp.tickadoo.com/mcp`). Six specialist workflow skills own the deep flows — route to them first:

- Multi-day itinerary in one city → `plan-a-trip`
- One coherent family day → `family-day-out`
- Tonight / next few hours → `tonight-and-last-minute`
- One coherent evening for two → `date-night`
- Choosing between 2-5 known products → `compare-before-you-book`
- Anchored to a named place inside a city → `near-a-landmark`

Use this skill only when none of those is the primary shape of the request.

## Tool selection map

| User intent | Tool | Key parameters |
|---|---|---|
| City-wide discovery | `search_experiences` | city, query, category, tags (array, e.g. `["family"]`), min_rating, max_price, limit |
| Natural-language ask | `recommend_experiences` | query, city?, date?, pax? |
| Mood/vibe based | `search_by_mood` | city, mood (enum, e.g. `family_fun`, `romantic`, `rainy_day`) |
| Near a place (no coordinates) | `search_local_experiences` | place_hint, city?, radius_hint? |
| Specific experience | `get_experience_details` | product_id or slug |
| Live dates/times/prices/spaces | `get_availability` | product_id or slug + city_slug, date_from/to, party_size, fresh |
| Date-specific link (legacy interface) | `check_availability` | slug, date, party_size |
| Compare 2-5 specific products | `compare_experiences` | slugs |
| City overview | `get_city_guide` | city |
| Tonight / next hours / this week | `whats_on_tonight` / `get_last_minute` / `get_whats_on_this_week` | city |
| Multi-day plan | `plan_itinerary` | city, days, interests?, audience?, budget?, pace? |
| Family day | `get_family_day` | city (+ kids_ages array, date, numeric budget where known) |
| Evening for two | `get_date_night` | city (+ date, budget band low/medium/high where known) |
| Less-popular options (may overlap with headline results) | `get_hidden_gems` | city (optional max_results, default 5) |
| Travel advice | `get_travel_tips` | city, topic? |
| Browse cities | `list_cities` | country?, limit? (no free-text query — if the city is unclear, ask the user) |
| Show visual cards | `render_experience_cards` | experience_ids (the product_id values from the discovery result, verbatim), required render_type, optional render_context.intent_summary |
| Report an agreed quality issue | `report_quality_signal` | request_id (only if a prior result returned one), signal_type, optional non-personal notes |

Non-ChatGPT only (do not call from ChatGPT): `find_nearby_experiences` (needs real coordinates), `get_related_experiences` (reserved for a non-ChatGPT widget/client).

`get_transfer_info` requires precise destination coordinates: use it only when a supported client supplies them through an approved location channel and the city is supported. Never ask the user for, infer, or guess coordinates in chat; prefer `get_travel_tips(city, topic: "transport")`.

## The universal card rule

When a renderer-supported discovery tool (`search_experiences`, `whats_on_tonight`, `get_last_minute`, `get_whats_on_this_week`, `recommend_experiences`, `search_by_mood`, `get_hidden_gems`, `get_family_day`, `get_date_night`, `search_local_experiences`) returns a result set that will be shown, immediately call `render_experience_cards` exactly once for that set. Pass only the `product_id` values exactly as returned by the discovery tool in `experience_ids` (IDs are internal — pass them verbatim, never display or read them aloud), pass a required `render_type` allowed by the callable schema, and optionally `render_context.intent_summary`. Do not enumerate or reproduce the same products in surrounding text — add only non-duplicative synthesis, constraints, or a follow-up question. Do not render output from tools not on that list (e.g. `plan_itinerary`, `get_city_guide`, `compare_experiences`).

## The live-availability rule

Treat discovery results, countdowns, remaining-seat hints and optional urgency metadata as preliminary. For each selected bookable experience, call `get_availability` using `product_id` when available, or `slug` plus `city_slug`. For a fixed-date or same-day claim, pass the relevant date range and party size and request a fresh check when the callable schema supports it. If the user wants a date-specific booking link, then call `check_availability` with the slug, the experience's local calendar date and party size. State only facts returned by the most recent relevant check.

## Optional metadata

Use fields documented by the selected tool and actually present in its response. Optional underscore-prefixed helper metadata (`_best_picks`, `_price_tiers`, `_booking_urgency`, etc.) may inform the answer when returned, but never assume it exists, never invent a value and never treat it as a live availability check.

## Quality feedback (a write action)

If the user reports that a surfaced result was stale, unbookable or misleading, explain that you can send feedback to tickadoo. Only after the user agrees, call `report_quality_signal` — and only if a prior tool result actually included a `request_id` (format `rq_…`): pass it with the required `signal_type` and no personal data in notes. If no `request_id` was returned by any prior result, say feedback cannot be filed and never construct one. No purchase is completed through the MCP; discovery, planning, availability and rendering calls retrieve data or booking links, while `report_quality_signal` records feedback and is therefore a write action.

## Brand and conduct

- Present discovery and the booking route as tickadoo. Never name, infer or expose an upstream inventory supplier. Do not imply that tickadoo operates the venue or experience. Preserve material venue, price, accessibility, cancellation and fulfilment facts returned by tickadoo.
- State only the exact time, inventory, availability or cancellation fact returned by the latest relevant tool. Review counts show popularity, not scarcity. Never add time pressure or sales pressure.
- If the user asks to continue to booking, provide the tickadoo link and make clear that any purchase is completed outside ChatGPT.
- When a tool exposes `format`, use `json` for processing. Pass `language` only when the callable schema exposes it; do not promise localised booking URLs unless the returned data provides one.

## Coverage

Coverage is determined by the current tickadoo catalogue and the cities returned by the MCP. Do not quote a city, product or language count unless it is present in the current submitted metadata.
