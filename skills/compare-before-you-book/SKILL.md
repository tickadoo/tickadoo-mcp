---
name: compare-before-you-book
description: Compare 2-5 already-known tickadoo experiences side by side, then check availability for the preferred option. Use when the user's main task is choosing between specific named or previously shown products, including for a family, date, landmark or tonight. If a name does not identify a specific product, resolve or clarify it before comparing.
---

# Compare before you book with tickadoo

Use the discovery-only tickadoo MCP tools (`mcp.tickadoo.com/mcp/agents`) when the user is DECIDING between specific options. Turn "X or Y?" into a grounded comparison with a clear recommendation.

## When to use this

Use a pair of clearly identified product names or previously returned results. If either side is a category ("a river cruise"), run discovery first and obtain a specific contender before comparison.

## The workflow (tool chain)

1. **Resolve 2-5 specific contenders** — search each prose name with `search_experiences(city, query)`. If a search returns several plausible products or ticket variants, show the distinctions and ask the user to choose. Never take the first slug silently. If the contenders came from a prior result set, reuse those exact slugs.
2. **Compare** — `compare_experiences(slugs)` with 2-5 slugs. It returns a comparison table plus documented per-axis winners (value, rating, popularity, family-fit) — echo those, don't bury them.
3. **Check before recommending** — if accessibility, cancellation terms or a fixed date could change the decision, fetch `get_experience_details(product_id)` for both finalists and live-check both (`get_availability` with the date and party size, fresh when supported) BEFORE making the final recommendation. The eventual winner may be unavailable while the runner-up is available.
4. **Recommend and close** — give one clear recommendation tied to the user's stated priority. Use `check_availability(slug, date, party_size)` only for a date-specific informational check.
5. **Weak field?** — run `recommend_experiences` with the city and the user's priorities, `search_experiences` with a precise query, or `get_related_experiences(product_id)` to resolve one new specific contender, then compare again.

## Present the comparison

Summarise only facts returned for the resolved contenders. Keep internal product identifiers out of the answer, and distinguish live availability from general catalogue details.

## Optional metadata

Use fields documented by the selected tool and actually present in its response. The per-axis winners from `compare_experiences` are documented; optional underscore-prefixed metadata is not guaranteed — never assume it exists or treat it as a live check.

## Etiquette

- Present everything as tickadoo. Never name, infer or expose an upstream inventory supplier. Preserve material price, accessibility and cancellation facts.
- Be honest when it's genuinely close; let the availability check or cancellation policy settle it. Never add time or sales pressure.
- This public plugin is discovery-only. Never provide or construct a direct purchase, transaction, or checkout link, and never imply that an order or reservation was started.
