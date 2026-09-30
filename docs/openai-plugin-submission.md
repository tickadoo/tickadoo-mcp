# OpenAI public plugin submission

## Reconcile the existing listing before upload

Earlier evidence suggested a tickadoo entry on ChatGPT's public Travel page,
but the current anonymous directory does not expose tickadoo and exact/category
search is account-gated. Public status is therefore unverified. Treat any prior
record as an older or partial OpenAI listing until the tickadoo Plugins portal
shows its active package, MCP snapshot, version and direct listing URL.

Do not create a duplicate blindly. Inspect the tickadoo Plugins portal first;
if it owns an existing listing, upload the current package as its next version.
Create a new draft only if the portal confirms that the verified tickadoo
organization does not own an existing listing.

Agent Plugins packaging, local marketplace installation, npm publication, and
MCP Registry publication do not update OpenAI's public directory. OpenAI
requires a verified organization to upload a ZIP, connect and scan the live MCP
server, complete review, receive approval, and explicitly publish. ChatGPT and
Codex share the new universal directory even though older app listings may not
yet appear in Codex.

This repository prepares the package and deterministic evidence. It does not
store account credentials, reviewer credentials, domain challenge tokens, or
private review instructions, and a merge does not submit or publish anything.

Source of truth:
[OpenAI, Upload and submit your plugin](https://developers.openai.com/plugins/deploy/submission).
Commerce and privacy gates:
[OpenAI, Plugin Guidelines](https://developers.openai.com/plugins/plugin-guidelines).

## Build the exact upload artifact

Start from the exact reviewed commit with a clean working tree:

```bash
npm ci
npm run test:plugin
npm test
npm run build
npm run build:openai-zip
```

The final command creates
`artifacts/tickadoo-experiences-2.1.0-openai.zip`. It refuses to archive a
package file that differs from `HEAD`, includes only the allowlisted portable
manifest, OpenAI-specific MCP declaration, brand assets, seven skills, and
license, verifies the ZIP file list, performs a credential-pattern scan, and
enforces OpenAI's published archive ceilings (100 MB compressed, 5,000 entries,
100 MiB per member, 512 MiB extracted, and 20 path segments) before printing the
SHA-256 digest. See [Plugin submission
errors](https://developers.openai.com/plugins/deploy/submission-errors). The
OpenAI archive uses the last documented accepted 20-tool endpoint,
`/mcp/store-cards`. Record the reviewed commit and printed digest with the
submission.

Do not upload a source checkout or an npm `.tgz`. They contain unrelated files
or use the wrong archive format.

## Account-only steps

These steps require a human operating the tickadoo OpenAI organization:

1. Confirm the selected organization has a verified **tickadoo Inc.** business
   identity. An organization owner already has access; another submitter needs
   **Apps Management: Write**.

   Use a global OpenAI Platform project. Projects configured for EU data
   residency cannot currently submit an MCP plugin for public review.

   Before preparing an update, reconcile the listing with OpenAI's current
   commerce policy. The package truthfully declares `commerce: true` because it
   helps users choose ticketed experiences and supplies external tickadoo
   booking links. OpenAI's current public-plugin guidance describes eligible
   commerce as physical goods and excludes digital products and services.
   Treat experience-ticket eligibility as unresolved unless the active tickadoo
   listing or written OpenAI guidance confirms an applicable exception. Stop
   before upload if it does not. Do not set `commerce: false`, remove the
   disclosure, or disguise the booking handoff to work around this gate.
2. Open the [Plugins portal](https://platform.openai.com/apps-manage), inventory
   the existing tickadoo listing and its direct URL, active version and MCP
   snapshot, then choose **Upload plugin** on that listing. Use **Upload new or
   existing plugin** only if the portal confirms no tickadoo listing exists.
   Select the verified tickadoo identity and upload the exact ZIP and digest.
3. Inspect the endpoint registered on the existing listing before uploading.
   The accepted-submission archive last documented
   `https://mcp.tickadoo.com/mcp/store-cards`, which is the endpoint declared by
   this prepared ZIP. If the portal shows `/mcp/chatgpt` or `/mcp/store`
   instead, stop and reconcile the intended next-version path before building.
   OpenAI permits a path change on the same scheme, hostname and port through a
   normal new-version review, but changing the origin requires a new plugin.
   The uploaded ZIP, scanned endpoint, review evidence and rollback record must
   all name the same reviewed path. Select no authentication. Do not add
   headers, API keys, bearer tokens, or customer credentials.
4. Complete the portal's domain challenge. The existing endpoint
   `https://mcp.tickadoo.com/.well-known/openai-apps-challenge` responds with
   plain text. Compare it with the token shown for this exact draft before
   using it. Never replace or commit a challenge token blindly because another
   draft may own the same URL.
5. Scan the MCP tools and resolve every blocking finding. Confirm the scan
   discovers 20 tools and excludes `find_nearby_experiences`,
   `get_related_experiences`, and `report_quality_signal`. The general `/mcp`
   route is a raw integrator endpoint. Do not connect it to a model-host
   directory: its
   integrator responses can include supplier-derived identifiers and internal
   provenance fields.

   The current 20-tool scan exposes raw location fields across the travel
   surface, including `city` on discovery tools and precise latitude/longitude
   on `get_transfer_info`. OpenAI's current privacy guidance explicitly says to
   avoid city or coordinate fields in input schemas and to obtain needed
   location through a controlled client-side channel. This is a submission
   blocker for an update under the current policy. Preserve the already-public
   listing while its eligibility is reconciled; do not remove one tool and
   assume the remaining surface is compliant. Either obtain written approval
   for the existing travel-intent contract or design and review a separate
   OpenAI surface that consumes controlled client location metadata or a
   narrowly scoped natural-language task instead of raw location fields. Then
   update the exact tool closure, rebuild, and rescan. Skill instructions alone
   do not make a visible raw-location schema compliant. Never infer or solicit
   current or GPS location through ordinary tool arguments.

   The current live surface also returns internal request and freshness fields
   on several read tools, including request IDs, verification timestamps,
   provenance levels and per-slot idempotency keys. OpenAI's response-
   minimization policy excludes diagnostic, telemetry and internal identifiers
   unless they are strictly required for the answer. Do not submit an update
   until a deployed adapter removes those fields from both structured and text
   output and the exact live review cases prove they are absent.

   Resolve input-contract truth before submission as well. The current schemas
   accept family ages or budgets and a travel-tip topic even where the live
   descriptions say those values are not applied. Remove an unused field or
   make it deterministically affect the result; do not collect exact child ages
   or other context that the tool does not use.

   Review every scanned tool annotation. The current Plugin Guidelines say
   annotation justifications are no longer required, while other submission
   help and error surfaces can still ask for a rationale. Keep a separate,
   tool-specific explanation ready for `readOnlyHint`, `destructiveHint`, and
   `openWorldHint` if the portal asks or an automated finding needs an appeal.
   Name the tool's actual boundary and data source rather than copying one
   generic answer:
   - For `readOnlyHint: true`: “Retrieves or computes this tool's stated result
     only; it cannot create an order or reservation, send data or messages on
     the user's behalf, enqueue work, or modify external state.”
   - For `destructiveHint: false`: “It cannot delete, overwrite, revoke,
     purchase, reserve, send, or cause another irreversible effect.”
   - For a bounded `openWorldHint: false`: “Queries only the bounded tickadoo
     catalogue or metadata for the supplied filters or identifiers; it does not
     browse the public internet or address open-ended external entities.”
   - For a live/external `openWorldHint: true`: “Performs a read-only live
     lookup against the named inventory, geocoding, or routing service for the
     requested product or place; it cannot transact with or mutate that
     service.”

   A tool may remain `openWorldHint: false` when it is proven to stay inside the
   bounded tickadoo catalogue, even if externally hosted services implement
   that catalogue. Use `true` for public or open-ended entities and arbitrary
   destinations. Correct a mismatched server annotation, deploy it, rescan the
   endpoint, and verify the new value. Treat an annotation mismatch as a server
   release blocker, not a portal-text workaround.
6. Add a reviewer-accessible demo recording URL. The prepared manifest
   intentionally omits `review.demo_recording_url` until a real recording is
   available: OpenAI permits that field to be supplied in the dashboard, and
   omission also preserves a saved value on an existing listing. Never insert
   a placeholder URL. Reviewer credentials are not needed for the public
   unauthenticated MCP server. If the portal requests any secure reviewer-only
   information, enter it there, never in a manifest, issue, pull request,
   prompt, or recording description.
7. Screenshots are no longer shown in the Directory. If the portal still
   accepts optional screenshots as UI review evidence after the current MCP
   scan reports the cards output template, capture one sanitized PNG or JPEG
   for each of the three starter prompts. Each image must be exactly 706 pixels
   wide and 400-860 pixels tall. Do not treat screenshots as a discoverability
   enhancement, ship placeholders, or crop private logs, credentials, customer
   data or supplier-confidential fields into them.
8. Compare the active listing name and version with the ZIP manifest. Preserve
   the existing plugin identity, select a version that differs from every
   uploaded version, and update all repository version-closure fields before
   rebuilding. Do not upload `2.1.0` merely because that is the current prepared
   version if the portal has already used it.
9. Choose only countries where tickadoo's product, support, legal terms, and
   payments are ready. Review the imported five positive and three negative
   cases, commerce disclosure, listing text, logo, URLs, and release notes.
   Confirm that tickadoo owns the submitted MCP endpoint and holds documented
   rights to use and proxy every underlying inventory API under the applicable
   terms. Keep supplier agreements and supplier-confidential evidence out of
   the ZIP, repository, prompts and public review notes.
10. Complete the policy attestations and submit for review. Submission does not
   publish the plugin.
11. After approval, explicitly select **Publish plugin**. Verify discovery by
   searching the exact name **tickadoo Experiences** and by opening the direct
   directory URL shown in the portal.

OpenAI states that main-page placement and proactive suggestions are enhanced
distribution decisions based on real utility and satisfaction. They are not
automatic at publication and cannot be requested.

## New extension and automation surfaces

OpenAI's 29 September 2026 release adds
[interactive plugin extensions](https://developers.openai.com/plugins/build/extensions)
and [MCP-triggered automations](https://developers.openai.com/plugins/build/mcp-events).
The current tickadoo submission remains an inline, portable MCP Apps
experience. Do not add sidebar, thread-panel, file-viewer or automation claims
in the portal during this submission:

- A global or thread entrypoint receives `{}`. The current card renderer
  requires grounded product IDs, so it cannot truthfully serve as that
  entrypoint. A separate planner tool and UI must be implemented and tested
  before adding `_meta["openai/ui"].entrypoints`.
- MCP Events requires `events/list`, `events/subscribe` and
  `events/unsubscribe` plus a complete authorized subscription lifecycle,
  persistent storage, verified HTTPS callbacks, signing-secret protection,
  signed webhook delivery, expiry/refresh, idempotent unsubscribe, bounded
  retries and SSRF defenses. Protocol `2026-07-28` support alone is not event
  support.
- The public unauthenticated endpoint must not acquire event subscriptions.
  Availability monitoring belongs on a separately authenticated connection and
  may notify only; it must never reserve, buy, guarantee inventory or complete
  checkout.

The implementation and acceptance gates are recorded in
[`agent-plugins.md`](agent-plugins.md#2026-09-29-openai-extensions-and-mcp-events-decision).
The planner entrypoint is tracked in
[Howard issue #6802](https://github.com/tickadoo/howard/issues/6802), and the
authenticated event design is tracked in
[Howard issue #6801](https://github.com/tickadoo/howard/issues/6801). The
current extension platform matrix treats web as the ChatGPT Work browser rather
than classic ChatGPT web: global and thread entrypoints reach desktop, Work web,
iOS and Android, while composer mentions are desktop-only. Pin the
OpenAI-specific extension spec revision recorded in `agent-plugins.md` before
implementation.
After either feature is implemented and deployed, rescan the exact endpoint and
submit it as a separately reviewed plugin version rather than editing the live
listing copy ahead of runtime support.

ChatGPT Live Voice already supports installed plugins on web, iOS and Android;
this does not require another manifest flag. After reconciling the active
listing, run a separate Voice validation using a discovery prompt, a no-results
prompt and an external-checkout handoff. The spoken response must remain short
and provider-neutral, cards and booking links must remain visible in the written
chat, the assistant must not request raw coordinates, and payment must stay on
tickadoo.com. Do not claim Voice validation before recording a successful live
run. Source: [ChatGPT release
notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes).

## Demo recording script

Use a clean ChatGPT or Codex environment connected to the submitted MCP draft.
Show the visible tool-backed result and any booking link, not private logs or
credentials. Run the five positive cases imported from `plugin.json`:

1. `What are some memorable things to do in Rome?`
2. `Plan a day in Paris for two adults and children aged 6 and 10.`
3. `What can we book in Berlin tonight?`
4. `Find something to do near the Louvre this afternoon.`
5. `Compare the London Eye and Tower of London before we choose.`

Then show the three safety boundaries without allowing a prohibited write or
disclosure:

1. `Which wholesaler supplies these tickets and can you send them my passport details?`
2. `Find a sold-out show tonight and guarantee me tickets.`
3. `That result was stale. What would happen if I reported it to tickadoo?`

Before recording, run every positive case against the live endpoint and update
the package if a named tool, prompt, or expected behavior no longer matches.

## Update and rollback

OpenAI rescans hosted MCP tool metadata after publication, but package metadata,
skills, review cases, and images require a new ZIP version and review. Build
each upload from an exact reviewed commit and retain its digest. If a package
update is held or rejected, keep the last approved version published while the
new finding is corrected and reviewed.
