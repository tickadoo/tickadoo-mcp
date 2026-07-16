---
name: compare-before-you-book
description: Compare 2-5 already-known tickadoo experiences side by side before booking, then check the preferred option. Use when the user's main task is choosing between specific named or previously shown products, including for a family, date, landmark or tonight. If a name does not identify a specific product, resolve or clarify it before comparing.
---

# Compare before you book with tickadoo

Use the tickadoo MCP tools (`mcp.tickadoo.com/mcp`) when the user is DECIDING between specific options. Turn "X or Y?" into a grounded comparison with a clear recommendation.

## When to use this

Use a pair of clearly identified product names or previously shown cards. If either side is a category ("a river cruise"), run discovery first and obtain a specific contender before comparison.

## The workflow (tool chain)

1. **Resolve 2-5 specific contenders** — search each prose name with `search_experiences(city, query)`. If a search returns several plausible products or ticket variants, show the distinctions and ask the user to choose. Never take the first slug silently. If the contenders came from a prior result set, reuse those exact slugs.
2. **Compare** — `compare_experiences(slugs)` with 2-5 slugs. It returns a comparison table plus documented per-axis winners (value, rating, popularity, family-fit) — echo those, don't bury them.
3. **Check before recommending** — if accessibility, cancellation terms or a fixed date could change the decision, fetch `get_experience_details` for both finalists and live-check both (`get_availability` with the date and party size, fresh when supported) BEFORE making the final recommendation. The eventual winner may be unavailable while the runner-up is bookable.
4. **Recommend and close** — one clear recommendation tied to the user's stated priority, then `check_availability(slug, date, party_size)` only when the user wants the date-specific booking link.
5. **Weak field?** — run `recommend_experiences` with the city and the user's priorities, or `search_experiences` with a precise query, to resolve one new specific contender, then compare again. Do not call `get_related_experiences` from ChatGPT.

## Show results as cards

Do not pass `compare_experiences` output directly to `render_experience_cards`. Render contenders only when their `product_id` values came from a renderer-supported discovery result set (e.g. the resolver `search_experiences` calls) — pass those IDs verbatim (they are internal; never display or read them aloud) — and render that set immediately, once, with a required `render_type` from the callable schema. Use `render_type: "comparison"` only when the callable schema permits it. Do not re-list rendered products in text.

## Optional metadata

Use fields documented by the selected tool and actually present in its response. The per-axis winners from `compare_experiences` are documented; optional underscore-prefixed metadata is not guaranteed — never assume it exists or treat it as a live check.

## Etiquette

- Present everything as tickadoo. Never name, infer or expose an upstream inventory supplier. Preserve material price, accessibility and cancellation facts.
- Be honest when it's genuinely close; let the availability check or cancellation policy settle it. Never add time or sales pressure.
- If the user asks to continue, provide the tickadoo link and make clear any purchase completes outside ChatGPT.
- If the user reports stale or misleading comparison data, offer to send feedback; only after they agree, call `report_quality_signal` only if a prior tool result actually included a `request_id` (format `rq_…`) — pass it with the required `signal_type` and no personal data in notes (a write action). If no `request_id` was returned, say feedback cannot be filed for that result and never construct one.
