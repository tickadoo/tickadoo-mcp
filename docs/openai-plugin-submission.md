# OpenAI public plugin submission

## Reconcile the existing listing before upload

tickadoo currently appears on ChatGPT's public Travel page as **tickadoo** with
the subtitle **Find & book live experiences**, but it is absent from the Codex
universal Agent Plugin catalogue. The public copy also differs from the current
repository metadata. Treat this as an older or partial OpenAI listing until the
tickadoo Plugins portal shows its active package, MCP snapshot, version and
direct listing URL.

Do not create a duplicate blindly. Open the existing tickadoo listing in the
Plugins portal first and upload the current package as its next version. Create
a new draft only if the portal confirms that the verified tickadoo organization
does not own an existing listing.

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
prints the SHA-256 digest. The OpenAI archive uses the reviewed 20-tool
`/mcp/chatgpt` surface; the vendor-neutral root package continues to use the
full `/mcp` surface. Record the reviewed commit and printed digest with the
submission.

Do not upload a source checkout or an npm `.tgz`. They contain unrelated files
or use the wrong archive format.

## Account-only steps

These steps require a human operating the tickadoo OpenAI organization:

1. Confirm the selected organization has a verified **tickadoo Inc.** business
   identity. An organization owner already has access; another submitter needs
   **Apps Management: Write**.
2. Open the [Plugins portal](https://platform.openai.com/apps-manage), inventory
   the existing tickadoo listing and its direct URL, active version and MCP
   snapshot, then choose **Upload plugin** on that listing. Use **Upload new or
   existing plugin** only if the portal confirms no tickadoo listing exists.
   Select the verified tickadoo identity and upload the exact ZIP and digest.
3. Inspect the endpoint registered on the existing listing before changing it.
   The prepared ZIP declares the least-privilege 20-tool endpoint at
   `https://mcp.tickadoo.com/mcp/chatgpt`. Older tickadoo submissions may use
   the equivalent `/mcp/store` or `/mcp/store-cards` alias. Preserve the active
   endpoint until the portal confirms a reviewed migration, and select no
   authentication. Do not add headers, API keys, bearer tokens, or customer
   credentials.
4. Complete the portal's domain challenge. The existing endpoint
   `https://mcp.tickadoo.com/.well-known/openai-apps-challenge` responds with
   plain text. Compare it with the token shown for this exact draft before
   using it. Never replace or commit a challenge token blindly because another
   draft may own the same URL.
5. Scan the MCP tools and resolve every blocking finding. Confirm the scan
   discovers 20 tools and excludes `find_nearby_experiences`,
   `get_related_experiences`, and `report_quality_signal`. The general `/mcp`
   endpoint intentionally remains a separate 23-tool vendor-neutral surface.
6. Add a reviewer-accessible demo recording URL. Reviewer credentials are not
   needed for the public unauthenticated MCP server. If the portal requests
   any secure reviewer-only information, enter it there, never in a manifest,
   issue, pull request, prompt, or recording description.
7. Choose only countries where tickadoo's product, support, legal terms, and
   payments are ready. Review the imported five positive and three negative
   cases, commerce disclosure, listing text, logo, URLs, and release notes.
8. Complete the policy attestations and submit for review. Submission does not
   publish the plugin.
9. After approval, explicitly select **Publish plugin**. Verify discovery by
   searching the exact name **tickadoo Experiences** and by opening the direct
   directory URL shown in the portal.

OpenAI states that main-page placement and proactive suggestions are enhanced
distribution decisions based on real utility and satisfaction. They are not
automatic at publication and cannot be requested.

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
