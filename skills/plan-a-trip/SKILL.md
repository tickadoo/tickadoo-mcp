---
name: plan-a-trip
description: Build a multi-day itinerary in one city with tickadoo. Use when the user wants activities arranged across two or more days. This is the primary workflow for a multi-day request even when the user also mentions children, romance or a neighbourhood. Retain those constraints. Do not use for one evening, one family day, immediate same-day options or choosing between named experiences.
---

# Plan a trip with tickadoo

Build a real multi-day plan for ONE city with the discovery-only tickadoo MCP tools (`mcp.tickadoo.com/mcp/agents`), grounded in the catalogue rather than prior knowledge.

## When to use this

The user wants activities arranged across at least two days in one city, such as "three days in Barcelona", "plan our Tokyo weekend" or "a Paris itinerary from Monday to Thursday". If the request covers only one day or one time period, use the relevant discovery, family, date-night or tonight skill.

## The workflow (tool chain)

1. **Orient** — `get_city_highlights(city)` returns a ranked list of the city's popular experiences, which you can use to gauge dominant categories and price levels. Do not promise or invent highlights, price bands, best-for hints or seasonal notes; state only what the returned rows contain. If the city is unclear or ambiguous, ask the user to clarify (use `list_cities` only to browse, optionally by country; it has no free-text query).
2. **Build the backbone** — call `get_itinerary_candidates` with `city` and `days`, plus `audience` when known. It returns a flat candidate list rather than structured day slots or a running cost: arrange the returned candidates into morning/afternoon/evening slots yourself, grouping geographically by venue, and compute any cost total from returned `price` fields only.
3. **Replace or widen only when needed** — use `search_experiences` for a named category, `recommend_experiences` for a natural-language preference, `search_by_mood` for a supported mood, or `get_hidden_gems` for alternative pulls (verify they differ from the main list before presenting them as hidden gems) — only when the user asks to replace a slot or browse alternatives. Do not imply that an earlier candidate pool is consumed by `get_itinerary_candidates`.
4. **Enrich and check selected items** — fetch `get_experience_details` for experiences the user is considering, then follow the live-availability sequence for each selected slot.

## Present the itinerary

Summarise only returned experience facts, keep internal product identifiers out of the answer, and distinguish catalogue-backed items from your own unchecked scheduling suggestions.

## Availability discipline (composite plan)

Treat the returned plan as proposed until every selected slot has been checked for the user's date and party size: `get_availability` per slot (product_id, or slug + city_slug; pass the date range and party size; request a fresh check when supported). Use `check_availability(slug, date, party_size)` only for a date-specific informational check. If the user has not asked to check every slot, label unchecked slots as suggestions rather than confirmed available plans.

## Optional metadata

Use fields documented by the selected tool and actually present in its response. Optional underscore-prefixed helper metadata may inform the answer when returned, but never assume it exists, never invent a value and never treat it as a live availability check.

## Etiquette

- Present discovery as tickadoo. Never name, infer or expose an upstream inventory supplier. Do not imply tickadoo operates the venue. Preserve material venue, price, accessibility, cancellation and fulfilment facts returned by tickadoo.
- State only the exact time, inventory, availability or cancellation fact returned by the latest relevant tool. Never add time pressure or sales pressure.
- This public plugin is discovery-only. Never provide or construct a direct purchase, transaction, or checkout link, and never imply that an order or reservation was started.
