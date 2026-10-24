# Changelog

## Unreleased

## [2.2.0] - 2026-10-24

- Route the portable Agent Plugins and OpenAI/Codex public package to the
  discovery-only `https://mcp.tickadoo.com/mcp/agents` contract while keeping
  the npm bridge, MCP Registry, Claude, copy-ready Copilot cloud adapter,
  Gemini, Smithery, Muse, and direct integrators on the established full `/mcp`
  surface. Copilot's portable marketplace entry follows the root public-agent
  package.
- Refresh `server.json` from the live full MCP server. The Registry index lists
  all 27 tool names and their behavioral hints while leaving display titles on
  remote `tools/list`, keeping the publisher extension within 4096 bytes.
- Add OpenAI listing, review, and release metadata under
  `extensions.com.openai`, with five positive cases, three negative cases, and
  an explicit non-commerce boundary for the public-agent endpoint.
- Freeze and verify the exact deployed public-agent tool contract, including
  schemas, safety annotations, server instructions, and transactional-field
  exclusions; the public endpoint advertises no resources and strips
  Apps/widget metadata.
- Remove stale fixed coverage and tool-count claims from package and Muse
  handoff copy; live catalogue and MCP discovery remain authoritative.
- Add a deterministic, allowlisted OpenAI review ZIP builder and document the
  existing-listing draft flow for changing its endpoint path to `/mcp/agents`,
  including reconciliation of the observed current and legacy records.
- Add a manual, main-only npm Trusted Publishing workflow that keeps release
  verification outside the OIDC job, passes a hashed tarball into the protected
  environment, has no token fallback, and verifies exact read-back plus SLSA
  provenance; also make the existing MCP Registry publisher main-only and
  serialized.
- Refresh the locked dependency graph within its declared ranges so both the
  production and development audits report zero current vulnerabilities.
- Declare Claude Code's remote MCP transport explicitly as `http`; Claude Code
  skips URL-only entries, so the plugin otherwise installs while exposing zero
  tools.
- Document the OpenAI Agents API → full tickadoo MCP integration
  (`https://mcp.tickadoo.com/mcp`, rather than the bare-host service landing)
  and add a Lion King / London smoke plus a CI job that requires
  `secrets.OPENAI_API_KEY`.

## [2.1.1] - 2026-10-10

- Require Node.js 22 or newer (`engines.node >=22`); Node.js 20 is end-of-life
  and the bundle already targets `node22`. Take `@modelcontextprotocol/sdk`
  `^1.32.1` ([GHSA-6qxp-vccf-f47h](https://github.com/advisories/GHSA-6qxp-vccf-f47h))
  and build with TypeScript 6.0.3.

## [2.1.0] - 2026-09-06

- Refresh the registry metadata from the live MCP endpoint, align every
  distributed package and client version, and remove count-bearing copy that
  could drift from the catalogue.
- Preserve the live `report_quality_signal` open-world annotation: the
  consent-gated feedback call writes outside the client while remaining
  non-destructive and idempotent.
- Normalize npm executable and repository metadata, require a publish dry-run
  without auto-corrections, and request package provenance at publication.
- Expand portable activation keywords for high-intent theatre, tour,
  attraction, event, and booking requests.
- Add a credential-free, default-deny Claude Managed Agents adapter for the
  public tickadoo MCP endpoint.
- Add a native Claude Code marketplace catalog for repository installation and
  discovery without duplicating the plugin's version authority.
- Add a ChatGPT/Codex repository marketplace and make the Codex listing meet
  current public-directory text, legal-link, branding, and asset requirements.
- Prepare the complete Agent Plugins 1.0 package for publication alongside the stdio bridge,
  including portable manifests, seven skills, pinned schemas, client adapters,
  documentation and a provider-neutral acceptance-scenario corpus.
- Add exact npm tarball-content verification to the portable plugin test suite.
- Make the provider-neutral corpus review-ready with nine positive fixtures and
  result contracts plus three negative safe-behavior cases.
- Add a copy-ready GitHub Copilot cloud adapter with an explicit read-only tool
  allowlist and metadata-backed safety tests.

## [2.0.0] - 2026-06-11

Rebuilt `@tickadoo/mcp-server` as a thin stdio bridge to the canonical remote MCP server at `https://mcp.tickadoo.com/mcp`. The package no longer ships local tool definitions, local catalogue formatting, or legacy backend calls, so npm users receive the live remote tool list, schemas, results, and errors through the bridge.
