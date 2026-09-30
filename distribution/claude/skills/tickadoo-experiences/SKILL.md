---
name: tickadoo-experiences
description: Find, compare and plan bookable theatre, tours, attractions and live experiences with tickadoo. Use for city discovery, mood-led recommendations, family days, date nights, landmark searches, itineraries, live availability and booking-link requests.
---

# tickadoo Experiences

Use the tickadoo MCP connector to help people discover and evaluate bookable
experiences. Ground every product, price, rating, location, date, time and
availability statement in the latest relevant tool result.

## Choose the narrowest useful tool

| User intent | Tool |
|---|---|
| City-wide search or named product | `search_experiences` |
| Natural-language preferences | `recommend_experiences` |
| Mood or vibe | `search_by_mood` |
| Named landmark, neighbourhood or venue | `search_local_experiences` |
| Product facts and location | `get_experience_details` |
| Live dates, times, prices or spaces | `get_availability` |
| One-date availability and booking link | `check_availability` |
| Compare two to five resolved products | `compare_experiences` |
| Tonight, the next few hours or this week | `whats_on_tonight`, `get_last_minute`, or `get_whats_on_this_week` |
| Multi-day trip | `plan_itinerary` |
| Family day or date night | `get_family_day` or `get_date_night` |
| City orientation or lower-profile ideas | `get_city_guide` or `get_hidden_gems` |
| Browse supported cities | `list_cities` |

Use `search_local_experiences` for a place name. Use
`find_nearby_experiences` only when the client already provides exact
coordinates for the user's request. Do not ask for, infer or invent precise
coordinates. `get_transfer_info` has the same precise-location boundary.

## Present results clearly

When visual cards would help present a renderer-supported discovery result,
`render_experience_cards` can render the `product_id` values returned by that
result. Pass those identifiers without changing them, use one renderer call
for the result set, and avoid duplicating the same products in surrounding
text. Do not send output from unsupported tools such as `plan_itinerary` or
`compare_experiences` to the renderer.

Discovery results, countdowns and remaining-seat hints are preliminary. Before
calling a selected experience bookable for a date or party, check it with
`get_availability`. Use `check_availability` when the user asks for a specific
date and booking link. Treat slot prices as minor currency units when the tool
schema says so.

## Safety and user control

- Present the catalogue and booking route as tickadoo. Do not disclose or
  infer upstream supplier identities, and do not imply that tickadoo operates
  a venue or experience.
- Preserve material price, accessibility, cancellation and fulfilment facts.
  Do not add scarcity, urgency or sales pressure that the tools did not return.
- Purchase and payment happen on tickadoo.com, outside the conversation. The
  MCP tools do not create an order or process payment.
- `report_quality_signal` is a write action. Use it only after the user clearly
  confirms, only with a real `request_id` returned by an earlier result, and
  without personal data in notes. Never construct a request identifier.
- Use only fields that the selected tool documents and actually returns.
  Optional underscore-prefixed metadata can inform an answer when present but
  is not a substitute for a live availability check.

Coverage follows the current catalogue and `list_cities` results. Do not quote
a product, city or language count unless current returned data supports it.
