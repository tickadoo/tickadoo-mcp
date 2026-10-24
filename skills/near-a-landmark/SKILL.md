---
name: near-a-landmark
description: Find experiences near a named landmark, neighbourhood, hotel or venue with tickadoo, without asking for coordinates. Use when proximity is the main constraint and no higher-priority comparison, multi-day, coherent family-day, coherent date-night or immediate-time workflow applies. If the place is unnamed, ask for it.
---

# Near a landmark with tickadoo

Use the discovery-only tickadoo MCP tools (`mcp.tickadoo.com/mcp/agents`) when the ask is anchored to a PLACE inside a city. "Things to do near the Louvre" is a different question from "things to do in Paris".

## When to use this

The user names a landmark, neighbourhood, square, venue or area: "near the Louvre", "in Trastevere", "around Times Square". If the place is unnamed ("walking distance from my hotel"), ask which hotel or area they mean — never guess. If they mean the whole city, use city-wide discovery instead.

## The workflow (tool chain)

1. **Place-anchored search** — `search_local_experiences(place_hint, city?)` is the primary tool. It takes the coarse place phrase directly (no coordinates) and matches first by exact venue/neighbourhood, then falls back to the city centre. Never ask for or guess coordinates.
2. **Say what "near" meant** — prefer exact venue or neighbourhood matches over city-centre fallback results, and say which you got ("I couldn't anchor to that exact spot, so these are central-Paris options"). Do not claim or rank by walking time unless returned location data supports it.
3. **Enrich the picks** — `get_experience_details(product_id)` for the actual location before making any proximity claim.
4. **Check the pick** — `get_availability` for the selected product (date range, party size, fresh when supported). Use `check_availability(slug, date, party_size)` only for a date-specific informational check. For a same-day check ("this afternoon"), use the venue-local calendar date (for example from the selected result's `start_time`), never the assistant's system timezone.
5. **"While you are there" pair** — run a new `search_local_experiences` call anchored to the selected venue or area, or `get_related_experiences(product_id)` for catalogue-related options.

## Present nearby results

Summarise only returned experience and location facts. Keep internal product identifiers out of the answer, and never turn a city-centre fallback into a specific proximity claim.

## Optional metadata

Use fields documented by the selected tool and actually present in its response. Optional underscore-prefixed helper metadata may inform the answer when returned, but never assume it exists, never invent a value and never treat it as a live availability check.

## Etiquette

- Present everything as tickadoo. Never name, infer or expose an upstream inventory supplier.
- Never oversell proximity: check the details' location before claiming distances.
- State only facts returned by the latest relevant check. Never add time or sales pressure.
- This public plugin is discovery-only. Never provide or construct a direct purchase, transaction, or checkout link, and never imply that an order or reservation was started.
