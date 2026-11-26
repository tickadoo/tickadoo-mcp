# OpenAI public plugin handoff

## Fixed identifiers

- Existing listing ID: `asdk_app_69be6f6bf4b481918a2d44ce5d9a9ea9`
- Existing listing URL:
  `https://chatgpt.com/apps/tickadoo/asdk_app_69be6f6bf4b481918a2d44ce5d9a9ea9`
- Legacy plugin URL for the same ID:
  `https://chatgpt.com/plugins/plugin_asdk_app_69be6f6bf4b481918a2d44ce5d9a9ea9`
- Required public-plugin MCP URL: `https://mcp.tickadoo.com/mcp/agents`
- Full integrator MCP URL, not valid for this public listing:
  `https://mcp.tickadoo.com/mcp`

Do not create a replacement listing or invent another app ID. A 2026-10-24
portal audit found two existing surfaces for this ID: the current Apps record
was configured for `/mcp`, while the still-public legacy Plugins page reported
version 2.0.1, `/mcp/store-cards`, and stale count-bearing copy. OpenAI permits
an endpoint-path change in a new draft version of the existing plugin because
the scheme, hostname, and port remain unchanged. Reconcile both observed
surfaces in the portal before upload, then create a new draft version of this
listing targeting `/mcp/agents`; do not create a replacement listing. Do not
publish until the approved version replaces the stale endpoint and copy.

Primary references: OpenAI's
[commerce and monetization guidelines](https://developers.openai.com/plugins/plugin-guidelines#commerce-and-monetization)
and
[new-version review guidance](https://developers.openai.com/plugins/deploy/app-review#submitting-new-versions-for-review).

## Pre-submission evidence

1. Confirm the deployed Howard commit that owns `/mcp/agents`.
2. Run `npm run verify:public-agent` and retain the exact passing output.
3. Run the complete repository checks on the final package commit.
4. Run `npm run build:openai-zip` from that clean commit and retain the printed
   path and SHA-256 digest.
5. Inspect the ZIP and confirm it contains only the files listed in
   `scripts/openai-plugin-files.json`.
6. In the portal, reconcile the legacy and current records for this app ID,
   create a new draft version targeting `https://mcp.tickadoo.com/mcp/agents`,
   and retain the submitted version evidence. Escalate to OpenAI support only
   if the portal cannot reconcile the two observed surfaces.

The required policy boundary is discovery and informational availability only:
no direct checkout or transaction links for ticketed services, no order or
reservation creation, and no payment collection. Prices may be presented as
catalogue information when returned by the reviewed endpoint.

## Portal completion

Upload the generated ZIP to the existing listing. Use the five positive and
three negative cases already stored in `plugin.json`; do not rewrite them in
the portal without making the same reviewed change in source. Record the demo
required by the portal, complete human review, and publish only after the
approved `/mcp/agents` version and legacy-record disposition are visible.

Portal state, support correspondence, demo recordings, reviewer decisions, and
the final publish click are external evidence. They are not implied by a
merged repository change or a generated ZIP.
