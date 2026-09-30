# Claude public directory submission

## Distribution model

Anthropic's public directory is separate from a Claude Code repository
marketplace and from the independent MCP Registry. A self-hosted marketplace
makes tickadoo installable for someone who already knows the repository. It
does not make tickadoo discoverable in Claude.

For a product that owns its remote MCP service, Anthropic requires two
submissions from the same Claude organization:

1. `https://mcp.tickadoo.com/mcp` as an **MCP connector**.
2. `distribution/claude` in `tickadoo/tickadoo-mcp` as a **Plugin bundle**.

After both pass review, pair the connector and plugin in the portal. One
listing then reaches Claude web, desktop, mobile, Cowork and Claude Code.

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
- `report_quality_signal` remains the only write action and requires explicit
  confirmation plus a genuine prior `request_id`.
- Purchases and payments happen on tickadoo.com, not through the MCP tools.

For MCP Apps, Claude derives the sandbox domain from the exact server URL. For
`https://mcp.tickadoo.com/mcp`, the standard resource `_meta.ui.domain` must be:

```text
9ec6ba7822a8ffc3cc779b8a1c4cc649.claudemcpcontent.com
```

Keep OpenAI's `openai/widgetDomain` as its own client-specific value. The app's
standard CSP and link permissions must allow only the origins it actually uses,
including `https://www.tickadoo.com` for booking links. Do not submit the
connector until the deployed live metadata passes those checks and the cards
render in Claude.

Capture three to five PNG screenshots of the working UI at the dimensions
required by the current connector form. Never include customer data,
credentials, private logs or supplier-confidential information.

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
   tickadoo. Precise coordinates are optional and only user-directed. Confirm
   the remote service's actual operational-log retention with the Howard owner
   before attesting to a retention period.
7. Choose scheduled checks or the GitHub webhook. Webhook setup requires
   repository admin access. Review details and submit.
8. Pair the connector and plugin from the same organization. Track validation,
   security scan and human review in the portal.
9. A passing version is not live. Select **Publish** and complete the reviewer
   publication flow, then verify its public URL and the synced Claude Code name.

Do not create a second draft after a duplicate-ownership error. If an older
Console submission cannot be withdrawn, follow Anthropic's documented migration
route through `directory@anthropic.com` with explicit human approval.

## Interim direct connector

Before public approval, a user can knowingly add the unauthenticated connector
manually with this prefilled Claude URL:

```text
https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=tickadoo&connectorUrl=https%3A%2F%2Fmcp.tickadoo.com%2Fmcp
```

Label this as a manual, unverified connector path. It is not a directory
listing and does not replace connector review.
