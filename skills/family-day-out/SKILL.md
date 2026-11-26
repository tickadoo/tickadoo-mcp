---
name: family-day-out
description: Build one coherent full or substantial family day in a single city with tickadoo, using the children's ages and geographically clustered activities. Use when the requested output is a family day plan. Do not use merely because children are mentioned. For a multi-day trip, one immediate activity, a named-option comparison or a place-led search, use the matching primary workflow and retain the family constraints.
---

# Family day out with tickadoo

Build a real family day in ONE city with the discovery-only tickadoo MCP tools (`mcp.tickadoo.com/mcp/agents`) — matched to the kids' ages and clustered so nobody drags tired children across town.

## When to use this

Use this skill when the user wants a full or substantial single-day family plan in one city. If they want only one activity this afternoon or tonight, use general discovery or `tonight-and-last-minute` while retaining the children's ages as constraints.

## The workflow (tool chain)

1. **Build the day** — call `get_family_day` with `city` and, when known, `date`. It returns a flat list of family-suitable candidates rather than a structured morning/lunch/afternoon/evening plan: build the day arc yourself from the returned rows, apply the children's ages when choosing among candidates, verify age-suitability per pick via `get_experience_details(product_id)`, and treat any activity as proposed until availability has been checked for the full party.
2. **Widen if asked** — `search_experiences(city, tags: ["family"])` for a broader family list (tags is an array; `family` is the canonical tag), or `search_by_mood(city, mood: "family_fun")` for a vibe-led pull.
3. **Enrich the picks** — `get_experience_details(product_id)` for age restrictions and accessibility fields before committing the family to anything.
4. **Check every selected product** — a family day has multiple selected products. For each one, call `get_availability` with the date range and the FULL party size (count the kids), requesting a fresh check when the schema supports it. Use `check_availability(slug, date, party_size)` only for a date-specific informational check. Label unchecked slots as suggestions.
5. **Logistics** — use returned venue and neighbourhood facts to keep the plan coherent. Never ask for, infer, or guess precise coordinates.

## Present the day

Summarise only returned experience facts, keep internal product identifiers out of the answer, and explain the schedule shape without overstating unchecked availability.

## Optional metadata

Use fields documented by the selected tool and actually present in its response (accessibility fields on details matter most here). Optional underscore-prefixed helper metadata may inform the answer when returned, but never assume it exists, never invent a value and never treat it as a live availability check.

## Etiquette

- Present discovery as tickadoo. Never name, infer or expose an upstream inventory supplier. Preserve material venue, price, accessibility, cancellation and fulfilment facts returned by tickadoo.
- Keep the day walkable and age-appropriate; respect a tight budget signal.
- State only facts returned by the latest relevant check. Never add time or sales pressure.
- This public plugin is discovery-only. Never provide or construct a direct purchase, transaction, or checkout link, and never imply that an order or reservation was started.
- Frame this as a planning tool for the accompanying adults.
