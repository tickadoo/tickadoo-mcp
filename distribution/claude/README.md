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

The plugin connects to `https://mcp.tickadoo.com/mcp`. Depending on the tool,
requests can include search text, city or area, dates, party size, filters,
product identifiers, and precise coordinates supplied by the client. Live
availability checks can send the applicable supplier product identifier, date
range, and currency to that experience supplier. The plugin does not read
Claude memory, chat history, conversation summaries, or uploaded files, and it
does not need credentials.

The remote service retains structured tool-call metadata for reliability and
quality, processes normal connection telemetry, and stores optional feedback
submitted through `report_quality_signal`. High-severity feedback can notify
tickadoo's private operations channel. Retention differs by record type, so a
directory submission must not claim a blanket 30- or 90-day deletion period
without verifying the deployed controls. The MCP exposes no account, checkout,
payment, booking, or customer-record tools.

See the [tickadoo privacy policy](https://www.tickadoo.com/privacy) for the
general service policy. For product support, use the
[tickadoo contact page](https://www.tickadoo.com/contact). Source and issue
tracking are available in the
[tickadoo-mcp repository](https://github.com/tickadoo/tickadoo-mcp).
