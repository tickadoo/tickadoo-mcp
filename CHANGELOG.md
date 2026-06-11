# Changelog

## [2.0.0] - 2026-06-11

Rebuilt `@tickadoo/mcp-server` as a thin stdio bridge to the canonical remote MCP server at `https://mcp.tickadoo.com/mcp`. The package no longer ships local tool definitions, local catalogue formatting, or legacy backend calls, so npm users receive the live remote tool list, schemas, results, and errors through the bridge.
