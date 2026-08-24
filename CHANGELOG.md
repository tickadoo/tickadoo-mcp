# Changelog

## Unreleased

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
