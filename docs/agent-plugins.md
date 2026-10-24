# Agent Plugins distribution

## Architecture

This repository publishes two deliberately different MCP entry points:

| Consumer | Endpoint | Purpose |
| --- | --- | --- |
| Portable Agent Plugins, OpenAI public plugin, Codex compatibility adapter, GitHub Copilot portable marketplace | `https://mcp.tickadoo.com/mcp/agents` | Read-only discovery and informational availability. No direct purchase, transaction, or checkout links. |
| npm stdio bridge, MCP Registry, Claude, copy-ready GitHub Copilot cloud adapter, Gemini, Smithery, Muse, and direct integrators | `https://mcp.tickadoo.com/mcp` | The established full tickadoo MCP surface. |

The split is a policy boundary, not an alias. Do not change the portable root
`mcp.json` or `.codex-plugin/plugin.json` back to the full endpoint. Do not
change `server.json`, `.mcp.json`, the npm bridge, or the other client adapters
to the public-agent endpoint.

Howard owns both hosted endpoints. This repository snapshots the exact
`/mcp/agents` tool contract in `metadata/public-agent-tools.json`; verification
fails closed when the live descriptors, schemas, annotations, server
instructions, or tool order drift.

After a reviewed Howard commit is deployed, refresh the snapshot only with its
exact 40-character commit:

```bash
HOWARD_COMMIT="$DEPLOYED_HOWARD_COMMIT" npm run sync:public-agent
npm run verify:public-agent
```

## Portable package

- `plugin.json` is the canonical Agent Plugins 1.0 manifest. OpenAI-specific
  listing, review, and release metadata is inline under
  `extensions.com.openai`.
- `mcp.json` selects the discovery-only `/mcp/agents` endpoint.
- `skills/*/SKILL.md` contains seven reusable discovery workflows. They never
  instruct a client to purchase, reserve, construct a checkout link, or call a
  tool that is absent from the public-agent snapshot.
- `.codex-plugin/plugin.json` mirrors the public portable identity for clients
  that still use the Codex compatibility manifest.
- `.github/plugin/marketplace.json` also points at the portable repository root,
  so its listing copy describes the public-agent surface.
- `.claude-plugin/`, `.mcp.json`, `clients/`, `gemini-extension.json`,
  `smithery.yaml`, `server.json`, and the npm bridge remain on the full surface.
  Claude Code requires the explicit `"type": "http"` in `.mcp.json`; it skips
  a remote URL-only entry, leaving an otherwise successful plugin install with
  no connected tools.

The public OpenAI plugin declares `review.commerce: false` because its endpoint
is discovery-only. That declaration is valid only while `/mcp/agents` excludes
direct transactional service links and purchase-oriented output fields. The
same endpoint advertises tools only: it exposes no MCP resources and strips
Apps/widget `_meta`, so it cannot bridge into the full-surface checkout UI.

## Validation

Use Node.js 22 or newer:

```bash
npm ci
npm run build
npm test
npm run verify:public-agent
```

`npm test` validates the closed manifests, schema checksums, endpoint split,
exact npm tarball contents, client allowlists, provider-neutral evaluation
corpus, and frozen public-agent contract. `verify:public-agent` additionally
compares that frozen contract with the live endpoint without following
redirects.

## OpenAI review artifact

After all package files are committed, create the deterministic, closed upload
artifact:

```bash
npm run build:openai-zip
```

The builder reads only committed files, includes the allowlist in
`scripts/openai-plugin-files.json`, rejects credential-shaped content, checks
archive limits and containment, and prints the ZIP SHA-256 digest. It excludes
the full-surface client adapters, Registry manifest, npm bridge, source code,
tests, and repository metadata.

The existing OpenAI app ID currently has two observed surfaces: the current
Apps record uses the full `/mcp` URL, while its still-public legacy Plugins page
reports `/mcp/store-cards` and stale copy. OpenAI does not expose endpoint
changes on an already submitted version, but its official review guidance
permits changing the path in a new draft version when the scheme, hostname,
and port stay the same. Reconcile both observed records in the portal, then
submit the existing listing's new draft with
`https://mcp.tickadoo.com/mcp/agents`; do not create a duplicate. Escalate to
support only if the portal cannot reconcile the records. See
`docs/openai-plugin-submission.md`.

## npm and MCP Registry release

Every release-bearing file must use the same version. npm publication is a
manual dispatch of `.github/workflows/publish-npm.yml` from `main`. An
unprivileged verification job installs dependencies, rebuilds, type-checks,
runs the complete test suite and live contract check, audits dependencies, and
hashes the resulting tarball. Only the second job uses the protected `npm`
environment and npm Trusted Publishing OIDC; it verifies and publishes that
exact artifact, then reads back the exact version, `latest` tag, and SLSA
provenance attestation. The workflow has no token fallback.

The npm package must have this trusted publisher mapping before dispatch:

- organization: `tickadoo`
- repository: `tickadoo-mcp`
- workflow: `publish-npm.yml`
- environment: `npm`
- permission: direct publish

MCP Registry publication is a separate manual dispatch of
`.github/workflows/publish-mcp-registry.yml` from `main`. It publishes
`server.json` through GitHub OIDC and reads back the exact version and `latest`
record. The Registry export lists all 27 full-surface tool names and their
standard behavioral hints. Display titles stay on canonical remote
`tools/list` so the publisher extension remains within its 4096-byte limit.

Neither workflow creates an OpenAI or Claude marketplace listing. Those remain
human portal actions.

## Update and rollback

1. Update Howard first when the hosted contract must change.
2. Capture and review the deployed `/mcp/agents` contract in this repository.
3. Bump every release-bearing artifact together and run all checks.
4. Merge only the exact reviewed head.
5. Publish npm and MCP Registry from the merged `main` commit.
6. Complete portal-only directory updates after their endpoint and policy
   checks are satisfied.

Rollback the package by publishing a new patch version that restores the last
reviewed manifests and bridge behavior. Registry and npm versions are
immutable; never overwrite an existing version or move a portal listing back
to the full endpoint to work around a review failure.
