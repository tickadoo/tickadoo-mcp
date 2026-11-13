# tickadoo for Claude

Find theatre, tours, attractions and live experiences in more than 1,100 cities, check live availability, and get a link to book on tickadoo.

## What it does

Ask Claude in plain language and it uses tickadoo's catalogue to answer:

- "What's on in London tonight?"
- "Plan a three-day trip to Paris with two children aged 6 and 9."
- "Compare The Lion King and Wicked in London for a Saturday matinee."
- "Find something to do near the Colosseum on Friday afternoon."
- "Plan a date night in New York with a show."

Claude searches, compares options, checks current availability for the one you pick, and gives you a tickadoo link for it. You complete the booking yourself on tickadoo.com. The plugin cannot place an order, hold seats or take payment.

## What is in the plugin

| Part | What it is |
| --- | --- |
| `.mcp.json` | One remote MCP server: `https://mcp.tickadoo.com/mcp` (Streamable HTTP, no sign-in) |
| `skills/` | Seven workflows that tell Claude which tickadoo tools to use and in what order |

The skills are `tickadoo-experiences` (general search and lookup), `plan-a-trip`, `family-day-out`, `date-night`, `tonight-and-last-minute`, `near-a-landmark` and `compare-before-you-book`.

There are no hooks, commands, agents, scripts or local programs. Nothing is installed or run on your machine.

## What it connects to and sends

The plugin talks to one host, `mcp.tickadoo.com`, operated by tickadoo Inc. It sends only what a tool call needs: for example a city, a date, a party size, a search phrase or an experience id. It does not read your files, your other conversations or Claude's memory.

- **No account, API key or sign-in.** There is nothing to configure.
- **Read-only catalogue tools.** 26 of the 27 tools are marked read-only: they read tickadoo's public catalogue and availability.
- **One feedback tool.** `report_quality_signal` lets Claude tell tickadoo that a result it was given was wrong, such as stale availability or a broken link. It sends a signal type, an optional short note and the id of the earlier result.
- **Booking links.** Links point to `www.tickadoo.com`. They carry `utm_` parameters naming the assistant and the tool that produced the result, and an `mcp_rid` request id, so that if you open the link tickadoo can match the visit to the search it came from. They do not contain your name, email or any account detail.
- **Images.** Experience images are served from `cdn.tickadoo.com`.

tickadoo's privacy policy is at <https://www.tickadoo.com/privacy> and its terms are at <https://www.tickadoo.com/terms>.

## Good to know

- Prices, times and availability come from tickadoo at the moment Claude checks. Claude is told to re-check availability before saying something can be booked.
- Results are tickadoo's catalogue, not paid placements. Claude is told not to add urgency or sales pressure.
- If a tool returns no booking link for an option, Claude will not make one up.

## Support

Questions or problems: <https://www.tickadoo.com/contact> or support@tickadoo.com. Source and issues: <https://github.com/tickadoo/tickadoo-mcp>.

## Licence

MIT. See `LICENSE`.
