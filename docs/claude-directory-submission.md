# Claude public directory submission

Status: **prepared only**. Do not submit until `/mcp/agents` is deployed and a
clean Claude client has validated its 20-tool read-only contract and MCP Apps
metadata.

## Distribution model

Anthropic's public directory is separate from a Claude Code repository
marketplace and from the independent MCP Registry. A self-hosted marketplace
makes tickadoo installable for someone who already knows the repository. It
does not make tickadoo discoverable in Claude.

For a product that owns its remote MCP service, Anthropic requires two
submissions from the same Claude organization:

1. `https://mcp.tickadoo.com/mcp/agents` as an **MCP connector**.
2. `distribution/claude` in `tickadoo/tickadoo-mcp` as a **Plugin bundle**.

After both pass review, pair the connector and plugin in the portal. Anthropic
keeps them as two linked listings; pairing the same connector URL prevents the
plugin from presenting a duplicate tool connection. The paired experience
reaches Claude web, desktop, mobile, Cowork and Claude Code.

Current primary documentation:

- [Publish to the directory](https://claude.com/docs/directory/publish)
- [Submit a plugin](https://claude.com/docs/plugins/submit)
- [Plugin pre-submission checklist](https://claude.com/docs/plugins/pre-submission-checklist)
- [Anthropic Software Directory Policy](https://support.claude.com/en/articles/13145358-anthropic-software-directory-policy)

## Repository artifact

Submit the GitHub plugin path `distribution/claude`, not the repository root.
The dedicated folder contains only regular text files:

- `.claude-plugin/plugin.json`
- `.mcp.json` with `type: "http"` and the public HTTPS endpoint
- one host-neutral discovery, planning and availability skill
- a README that discloses remote data flow and external checkout
- the MIT license

This avoids the dependency-install reviewer hold caused by the root
`package.json` and lockfile, reduces scanner scope, and excludes source,
workflows, local launchers and credentials. Run:

```bash
claude plugin validate ./distribution/claude
npm run test:plugin
```

Claude's portal performs stricter validation and security scanning than the
local command. A local pass is necessary but not sufficient.

## MCP connector prerequisites

Before submission, verify the live endpoint through a clean Claude client:

- Streamable HTTP initializes and lists the current tool set.
- Tool names, descriptions, annotations and schemas precisely match behavior.
- Tool descriptions do not coerce Claude to make unrelated calls or interfere
  with other software. Visual rendering is optional and user-serving, not an
  unconditional second tool call.
- The connector exposes exactly 20 read-only tools and does not expose
  `report_quality_signal` or any other write action.
- Purchases and payments happen on tickadoo.com, not through the MCP tools.

For MCP Apps, Claude derives the sandbox domain from the exact server URL. For
`https://mcp.tickadoo.com/mcp/agents`, the standard resource `_meta.ui.domain`
must be:

```text
d53165539e9c809abe3e3f334ac7150c.claudemcpcontent.com
```

Keep OpenAI's `openai/widgetDomain` as its own client-specific value. The app's
standard CSP and link permissions must allow only the origins it actually uses,
including `https://www.tickadoo.com` for booking links. Do not submit the
connector until the deployed live metadata passes those checks and the cards
render in Claude.

Capture three to five PNG screenshots of the working UI, each at least 1,000
pixels wide. Crop to the app response, provide the matching prompt separately,
and do not upload video or GIF files. Never include customer data, credentials,
private logs or supplier-confidential information.

## Prepared portal copy

Keep the public copy count-free so catalogue growth does not make a reviewed
listing stale. Reconfirm the portal's current category labels before selecting
them.

- **Name:** tickadoo
- **One-liner:** Discover and compare live experiences, then continue to
  tickadoo.com to book.
- **Description:** Search theatre, tours, attractions and other experiences by
  city, date, mood or occasion. Compare returned options, check current
  availability and prices, build day or trip plans, and open tickadoo booking
  links. The connector is read-only: it does not create orders, take payment or
  complete a purchase inside Claude.
- **Suggested categories:** Travel and Entertainment, using the exact labels
  offered by the current form.
- **Authentication:** None.
- **Read/write scope:** 20 read-only discovery, planning, availability and
  rendering tools; no feedback, account, checkout, payment or booking write.
- **Example use cases:** family-friendly indoor experiences in London; compare
  two London shows and check availability for two people; build a relaxed
  three-day Paris itinerary within a mid-range budget.
- **Documentation:** `https://mcp.tickadoo.com/llms-full.txt`
- **Website:** `https://www.tickadoo.com`
- **Support:** `https://www.tickadoo.com/contact`
- **Privacy:** `https://www.tickadoo.com/privacy`

## Account-only submission steps

These steps accept directory terms and create public listings, so a human owner
performs them in the target tickadoo Claude organization:

1. Use a paid Pro, Max, Team or Enterprise Claude account. For Team or
   Enterprise, use an Owner or an Enterprise custom role with Directory access.
2. Open [Claude directory management](https://claude.ai/directory/manage) and
   connect the GitHub identity that can push to `tickadoo/tickadoo-mcp`.
3. Inventory existing drafts or earlier Console submissions first. The first
   organization to submit a repository folder owns that listing, and repository
   and folder cannot be changed after submission.
4. Select **Submit new**, choose **MCP connector**, use the canonical endpoint,
   select no authentication, complete metadata, data-handling, support, privacy,
   category and use-case fields, validate, attest and submit.
5. Select **Submit new**, choose **Plugin bundle**, use repository
   `tickadoo/tickadoo-mcp`, plugin path `distribution/claude`, and the exact
   reviewed branch or tag. Validate the exact commit.
6. Answer data-handling questions accurately. The plugin sends requested city,
   place, query, preference, date, party-size and product identifiers to
   tickadoo. The public-agent endpoint does not accept precise-coordinate
   location or transfer tools. Live
   availability can send the applicable supplier product identifier, date
   range and currency to that experience supplier. The remote service retains
   structured tool-call metadata and processes connection telemetry. The
   submitted public-agent surface has no quality-feedback tool. Confirm the
   deployed retention controls with the Howard owner before attesting to a
   retention period; do not claim that all MCP data is deleted in 30 or 90 days.
7. Complete the connector source and merchandising attestations only after a
   Howard or product owner confirms them. Select first-party or
   permissioned-partner API use only when tickadoo controls the submitted MCP
   endpoint and has documented rights to proxy every underlying inventory API;
   keep that evidence outside the public package. Confirm that ranking is not
   bought, sponsored or changed by compensation or commission. If any placement
   is paid or commercially influenced, stop and obtain policy review rather
   than describing it as ordinary relevance ranking.
8. Choose scheduled checks or the GitHub webhook. Webhook setup requires
   repository admin access. Review details and submit.
9. Pair the connector and plugin from the same organization. Track validation,
   security scan and human review in the portal.
10. A passing version is not live. Select **Publish** and complete the reviewer
   publication flow, then verify its public URL and the synced Claude Code name.

Do not create a second draft after a duplicate-ownership error. If an older
Console submission cannot be withdrawn, follow Anthropic's documented migration
route through `directory@anthropic.com` with explicit human approval.

## Data-handling gate

The current implementation needs an owner or DPO decision before final portal
attestation. Structured tool-call lineage has no automated expiry in the
audited code. The 30-day purge for recognized AI-client metadata is runtime
gated and its production activation is not yet verified. External quality
feedback is scheduled for deletion after 90 days, while general analytics has
its own retention period. The public privacy policy is general and does not by
itself prove these MCP-specific settings.

Before submission, approve and verify:

- bounded retention and deletion for structured tool-call lineage;
- whether exact coordinates, nested human text, idempotency keys and trace IDs
  should be stored at all;
- the deployed AI-client telemetry purge and platform log retention;
- MCP-specific public privacy language and an erasure process.

Before accepting the directory's commercial-content and API-rights terms, a
Howard or product owner must also record two non-public attestations: tickadoo
controls the submitted MCP endpoint and has permission to proxy the inventory
APIs it uses; and public-agent ranking is not sponsored, paid-placement or
compensation-driven. Repository metadata cannot prove either commercial fact.

Keep the disclosure factual if submission proceeds after those decisions. The
MCP processes search and coarse-place inputs plus standard connection
telemetry. It has no feedback, account, checkout, payment, booking or customer-
record tools.

## Interim direct connector

After `/mcp/agents` is deployed and live-validated, but before public approval,
a user can knowingly add the unauthenticated connector manually with this
prefilled Claude URL:

```text
https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=tickadoo&connectorUrl=https%3A%2F%2Fmcp.tickadoo.com%2Fmcp%2Fagents
```

Label this as a manual, unverified connector path. It is not a directory
listing and does not replace connector review.
