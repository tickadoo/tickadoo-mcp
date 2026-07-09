---
name: compare-before-you-book
description: Compare 2-5 specific tickadoo experiences side by side before booking — a real comparison table with per-axis winners (value, rating, popularity, family-fit), then live availability on the choice. Use when a user is deciding between named options, asks "which is better", "X or Y?", or wants help choosing between shows, tours, or attractions. Covers 700+ cities and 13,090+ bookable products.
---

# Compare before you book with tickadoo

Use the tickadoo MCP tools (`mcp.tickadoo.com/mcp`) when the user is DECIDING, not discovering. The job is to turn "the London Eye or a river cruise?" into a grounded comparison with a clear recommendation and a bookable next step — not two paragraphs of generic pros and cons.

## When to use this

The user names (or has just been shown) specific options and wants help choosing: "which is better", "X or Y", "help me pick between these three", "is the expensive one worth it". If they haven't got candidates yet, run discovery first (`search_experiences` / `recommend_experiences`) and come back here once 2-5 contenders exist.

## The workflow (tool chain)

1. **Resolve the contenders to slugs** — `compare_experiences` takes slugs. If the user named products in prose, find each with `search_experiences(city, query: "<name>")` and take the slug from the result. If they're choosing from a set you just showed, you already have the slugs.
2. **Compare** — `compare_experiences(slugs)` with 2-5 slugs. It returns a comparison table plus per-axis winners: value, rating, popularity, family-fit. This is the backbone; don't hand-write a comparison you could get from it.
3. **Present the decision** — lead with the per-axis winners, then the differences that actually decide it: price, duration, rating vs review volume, cancellation policy. Map the winner to what the USER said they care about (budget → value winner; with kids → family-fit winner; once-in-a-lifetime → rating winner). Make one clear recommendation and say why.
4. **Thin field?** — if the set feels weak, `get_related_experiences(product_id, context: similar)` on the strongest contender to add one better-fitting alternative, then re-compare.
5. **Close the loop** — `get_experience_details(slug)` on the chosen one for the full picture, then `check_availability(slug, date, party_size)` for the booking link, or `get_availability(...)` for live dates/times/prices. A comparison that ends without a bookable winner is homework, not help.

## Show the results as cards

When you show the contenders (or the winner + runner-up), call `render_experience_cards(experience_ids, render_context)` once — stable `t_` IDs only, `render_context.intent_summary` like "comparing Thames cruises for Saturday". Don't re-list the same products as text.

## Read the agent-intelligence metadata

- The per-axis **winners** from `compare_experiences` are the headline — echo them, don't bury them.
- **_booking_urgency** (on details) can break a tie honestly: "both are great; this one has availability today with free cancellation".
- **_price_tiers** — frame the price gap in tiers, not just absolute numbers.
- **_accessibility** — if anyone in the party has access needs, check it on the finalists before recommending.

## Conversation flow

Confirm what matters to them (budget? kids? date fixed?) → resolve slugs → `compare_experiences` → per-axis winners + the 2-3 deciding differences → one clear recommendation tied to their stated priority → availability check on the winner → booking link → render cards once.

## Etiquette

- `format: "json"` when processing data; `format: "text"` for direct display.
- Present everything as tickadoo — never name the underlying supplier.
- Be honest when it's genuinely close: say so, and let the availability check or cancellation policy settle it.
- If comparison data is stale or wrong at click time, send `report_quality_signal(request_id, ...)` using the `request_id` from the earlier call.
