---
name: date-night
description: Build one coherent evening for two in a single city with tickadoo, centred on discoverable experiences plus dinner-area and post-show suggestions. Use for a date night, romantic evening or anniversary plan. Do not use for a multi-day romantic trip or a request for only the next available event tonight.
---

# Date night with tickadoo

Build a coherent evening for two with the discovery-only tickadoo MCP tools (`mcp.tickadoo.com/mcp/agents`) — an arc from pre-dinner to post-show, not ten unconnected "romantic things".

## When to use this

The user wants an evening plan for a couple: "date night in Paris", "anniversary evening in London", "a nice night out for the two of us". For a multi-day plan use `plan-a-trip`; if they just want whatever starts soonest tonight, use `tonight-and-last-minute`.

## The workflow (tool chain)

1. **Build the evening** — call `get_date_night` with `city` and, when known, `date`. It returns a flat candidate list rather than a structured pre-dinner/dinner/show arc: select date-appropriate picks yourself (prefer `search_by_mood(city, mood: "romantic")` to bias the pool), compose the evening arc in your answer, and check each selected experience before presenting the evening as settled. Any dinner-area or post-show suggestion you add is yours, not a tickadoo product.
2. **Tune the vibe** — `search_by_mood(city, mood: "romantic")` for alternatives; `whats_on_tonight(city)` if the date is TONIGHT; `get_hidden_gems(city)` for alternative pulls (verify they differ from the main list before presenting them as hidden gems).
3. **Nearby extras** — if the user wants another experience near the selected venue, call `search_local_experiences` with that venue or neighbourhood as the place hint, or `get_related_experiences(product_id)` for catalogue-related options.
4. **Check every selected slot** — the evening can include a pre-dinner experience AND a show. For each selected experience: `get_experience_details(product_id)`, then `get_availability` for two on the date (fresh check when the schema supports it). Use `check_availability(slug, date, party_size: 2)` only for a date-specific informational check. For a same-day check, use the venue-local calendar date (for example from the selected result's `start_time`), never the assistant's system timezone.

## Present the evening

Summarise only returned experience facts, keep internal product identifiers out of the answer, and clearly distinguish your dinner-area or post-show suggestions from tickadoo catalogue results.

## Optional metadata

Use fields documented by the selected tool and actually present in its response. Optional underscore-prefixed helper metadata may inform the answer when returned, but never assume it exists, never invent a value and never treat it as a live availability check.

## Etiquette

- Present everything as tickadoo. Never name, infer or expose an upstream inventory supplier. Preserve material venue, price, accessibility and cancellation facts.
- Respect the occasion: for an anniversary or proposal, bias to confirmed availability over cheapest.
- State only facts returned by the latest relevant check. Never add time or sales pressure.
- This public plugin is discovery-only. Never provide or construct a direct purchase, transaction, or checkout link, and never imply that an order or reservation was started.
