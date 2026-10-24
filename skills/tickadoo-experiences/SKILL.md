---
name: tickadoo-experiences
description: General tickadoo discovery and utility map for city-wide experience searches, named-experience lookup, mood-led ideas, weekly listings, city guides, travel tips and availability questions that do not match a specialist workflow. Do not use as the primary skill for a multi-day itinerary, a full family day, an immediate or same-day search, a coherent date night, a comparison of 2-5 known options or a landmark-anchored search. Use the matching tickadoo workflow skill.
---

# tickadoo Experiences (general map)

The general map for the discovery-only tickadoo MCP server (`mcp.tickadoo.com/mcp/agents`). Six specialist workflow skills own the deep flows — route to them first:

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
| Natural-language ask | `recommend_experiences` | query, city?, limit?, language? |
| Mood/vibe based | `search_by_mood` | city, mood (enum, e.g. `family_fun`, `romantic`, `rainy_day`) |
| Near a place (no coordinates) | `search_local_experiences` | place_hint, city?, radius_hint? |
| Specific experience | `get_experience_details` | product_id |
| Live dates/times/prices/spaces | `get_availability` | product_id or slug + city_slug, date_from/to, party_size, fresh |
| Date-specific availability | `check_availability` | slug, date, party_size |
| Compare 2-5 specific products | `compare_experiences` | slugs |
| City overview | `get_city_highlights` | city |
| Tonight / next hours / this week | `whats_on_tonight` / `get_last_minute` / `get_whats_on_this_week` | city |
| Multi-day plan | `get_itinerary_candidates` | city, days, audience?, language? |
| Family day | `get_family_day` | city, date? |
| Evening for two | `get_date_night` | city, date? |
| Less-popular options (may overlap with headline results) | `get_hidden_gems` | city (optional max_results, default 5) |
| Broad city candidates (legacy topic alias; it does not accept a topic filter) | `search_experiences_by_topic` | city, language? |
| Browse cities | `list_cities` | country?, limit? (no free-text query — if the city is unclear, ask the user) |
| Show-specific guide | `get_show_guide` | product_id or city_slug + slug |
| Theatre this weekend | `get_theatre_weekend` | city or city_slug, weekend? |
| Theatre question | `ask_theatre_concierge` | question, city or city_slug |
| Theatre for an occasion | `find_theatre_for_occasion` | occasion, city or city_slug, party?, date? |
| Related catalogue options | `get_related_experiences` | product_id, context?, max_results? |

The public plugin does not expose coordinate-bearing or write tools. Never ask the user for, infer, or guess precise coordinates in chat.

## Presenting results

Summarise only facts returned by the selected discovery tools. Keep internal product identifiers out of the answer and do not invent fields, links or availability.

## The live-availability rule

Treat discovery results, countdowns, remaining-seat hints and optional urgency metadata as preliminary. For each selected experience, call `get_availability` using `product_id` when available, or `slug` plus `city_slug`. For a fixed-date or same-day claim, pass the relevant date range and party size and request a fresh check when the callable schema supports it. Use `check_availability` only for a date-specific informational check. State only facts returned by the most recent relevant check.

## Optional metadata

Use fields documented by the selected tool and actually present in its response. Optional underscore-prefixed helper metadata may inform the answer when returned, but never assume it exists, never invent a value and never treat it as a live availability check.

## Brand and conduct

- Present discovery as tickadoo. Never name, infer or expose an upstream inventory supplier. Do not imply that tickadoo operates the venue or experience. Preserve material venue, price, accessibility, cancellation and fulfilment facts returned by tickadoo.
- State only the exact time, inventory, availability or cancellation fact returned by the latest relevant tool. Review counts show popularity, not scarcity. Never add time pressure or sales pressure.
- This public plugin is discovery-only. Never provide or construct a direct purchase, transaction, or checkout link, and never imply that an order or reservation was started.
- Pass `language` only when the callable schema exposes it.

## Coverage

Coverage is determined by the current tickadoo catalogue and the cities returned by the MCP. Do not quote a city, product or language count unless it is present in the current submitted metadata.
