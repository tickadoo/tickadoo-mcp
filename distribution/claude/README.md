# tickadoo Experiences for Claude

Find and compare bookable theatre, tours, attractions and live experiences in
cities worldwide. The plugin can turn preferences into grounded suggestions,
build family days, date nights and multi-day itineraries, check current dates
and prices, and return direct tickadoo booking links. No account or API key is
required to explore the catalogue. Checkout and payment happen on
[tickadoo.com](https://www.tickadoo.com), not inside Claude.

## Example requests

- Find family-friendly indoor experiences in London this Saturday.
- Compare two London shows and check live availability for two people.
- Build a relaxed three-day Paris itinerary within a mid-range budget.

## Data handling

The plugin connects to `https://mcp.tickadoo.com/mcp`. Tool calls send only the
inputs needed for the requested search or check, such as a city or place name,
query, preferences, dates, party size, and selected product identifiers.
Precise coordinates are used only when the user intentionally supplies them
through a supported location flow. The plugin does not read Claude memory,
chat history, conversation summaries or uploaded files, and it does not need
credentials. The optional `report_quality_signal` tool writes feedback only
after confirmation and must not include personal data.

See the [tickadoo privacy policy](https://www.tickadoo.com/privacy) for the
remote service's data practices and retention. For product support, use the
[tickadoo contact page](https://www.tickadoo.com/contact). Source and issue
tracking are available in the
[tickadoo-mcp repository](https://github.com/tickadoo/tickadoo-mcp).
