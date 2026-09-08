# Changelog

## Unreleased

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
