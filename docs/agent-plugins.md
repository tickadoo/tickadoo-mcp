# Agent Plugins 1.0 package

## Decision

The canonical portable package lives at the root of `tickadoo/tickadoo-mcp`.
This repository already owns the public MCP distribution, its release version,
and the seven reusable tickadoo Agent Skills. Keeping `plugin.json`, `mcp.json`,
and `skills/` together gives compatible clients one source and one update path.

Explicit non-fits:

- `tickadoo/claude-platform` owns Hive's private coordination runtime. Its MCP
  endpoint requires client-managed Cloudflare Access authentication. Agent
  Plugins 1.0 has literal headers and no OAuth or credential-reference fields,
  so packaging that endpoint would either be unusable or invite unsafe secret
  embedding. Hive remains installed by its reviewed client-specific installers.
- A new repository would duplicate the skill source, versioning, review, and
  release lifecycle without adding a portable capability.
- Codex's current marketplace ingestion still requires
  `.codex-plugin/plugin.json`, even though the Agent Plugins compatibility page
  lists ChatGPT/Codex as supporting the portable components. That client
  manifest is retained as a parallel adapter and tested against the portable
  package for name/version alignment; it does not replace root `plugin.json`.

## Portable package

- `plugin.json` targets the immutable Agent Plugins schema identifier `1.0.0`.
- `skills/*/SKILL.md` are discovered from the standard fixed location.
- `mcp.json` points directly to the public Streamable HTTP endpoint. It has no
  headers, credentials, environment-variable substitutions, or customer data.
- The official schemas are vendored under `schemas/agent-plugins/1.0.0/` so CI
  never depends on retrieving mutable network content while loading a plugin.
  `SHA256SUMS` records the reviewed schema bytes and the tests enforce them.
- `.codex-plugin/plugin.json` maps the same skills and public endpoint into the
  current Codex marketplace shape. Its client-specific transport spelling is
  `http`; the portable manifest uses the normative `streamable-http` spelling.
  Tests pin both spellings and the identical endpoint. Existing
  `.claude-plugin/plugin.json` and `.mcp.json` remain untouched for their
  established client flows.

The package does not reimplement MCP protocol behavior. The canonical remote
server remains in Howard and the existing npm stdio bridge remains available
to clients that prefer stdio.

## Validation and compatibility

Run `npm run test:plugin` for schema validation and tests covering manifest
closure, fixed-location discovery, filesystem containment, forbidden secrets,
schema-version agreement, HTTPS, Streamable HTTP transport selection, published
tarball closure, and the provider-neutral acceptance-scenario corpus.

The npm distribution is a complete portable artifact rather than only a stdio
bridge: its allowlist includes the portable manifests, seven skills, pinned
schemas, client adapters, documentation and eval corpus. `npm pack --dry-run`
is executed by the test suite so a future packaging change cannot silently ship
the bridge while omitting the plugin.

The published `.mcp.json` and `.claude-plugin/plugin.json` are compatibility
adapters for clients that install or unpack the npm artifact as a plugin source;
they do not alter MCP configuration merely by existing under `node_modules`.
The portable root `mcp.json` remains authoritative for Agent Plugins clients.

`evals/agent-plugin-scenarios.json` defines the same discovery, grounding,
availability, privacy, feedback-consent and booking-handoff expectations for
every client. It is intentionally provider-neutral: client-specific runners
may score ChatGPT, Claude, Copilot, Cursor, VS Code and Kiro without forking the
acceptance contract.

Client setup verified from primary documentation and installed CLIs on
2026-08-06:

- ChatGPT/Codex: current OpenAI documentation requires a
  `.codex-plugin/plugin.json` manifest and marketplace installation; Codex CLI
  0.147.0 exposes marketplace add/install commands but no direct local-path
  mount. A temporary local marketplace successfully installed and listed
  `tickadoo-experiences@tickadoo-agent-plugins-test` version `2.0.0`; the plugin
  and marketplace were then removed successfully. The portable root package is
  therefore accompanied by the live-tested Codex adapter rather than treated
  as a replacement for it.
- VS Code: set `chat.plugins.enabled`, then use **Chat: Install Plugin From
  Source**, or map the checkout in `chat.pluginLocations`. VS Code recognizes
  the canonical root `$schema`, discovers `skills/` and `mcp.json`, and supports
  stdio, Streamable HTTP, and legacy SSE.
- Cursor: install from its Plugins marketplace/source flow; it advertises Agent
  Skills and all three portable MCP transports.
- GitHub Copilot: CLI 1.0.78 successfully discovered this checkout through
  `copilot --plugin-dir . plugin list` as external plugin
  `tickadoo-experiences`. Its direct install flow otherwise expects a GitHub
  repository or marketplace source.
- Kiro: import the plugin as a Power; it advertises Agent Skills and all three
  portable MCP transports.

Record exact live client results in the PR. A schema/discovery test is not a
claim that a particular GUI successfully connected.

Transport verification on 2026-08-06 sent a read-only MCP 2026-07-28
`server/discover` request to the exact URL in `mcp.json`. It returned HTTP 200,
advertised `2026-07-28`, `2025-11-25`, and `2025-06-18`, and exposed tools and
resources capabilities. This validates endpoint/transport compatibility
without duplicating the protocol implementation in this repository.

## Existing MCP and OpenAI/ChatGPT work reviewed

The implementation was checked against the existing work rather than creating
a parallel runtime:

- Howard owns the public `/mcp` protocol, tool registry, surface adapter,
  public-field stripping, supplier aliases, telemetry, feedback controls, and
  ChatGPT cards resources/widgets. Its recent history includes the MCP
  2026-07-28 migration, live conformance tests, Apps SDK widget metadata,
  domain verification, and adversarial privacy/honesty fixes. None belongs in
  this package.
- `tickadoo-mcp` v2.0.0 is intentionally a thin npm stdio bridge. Its
  `server.json`, `.claude-plugin/plugin.json`, `.mcp.json`, Smithery metadata,
  seven Plugin Directory skills, metadata consistency tests, and live-audited
  ChatGPT-specific tool guidance already cover registry and legacy client
  distribution. The portable files reuse those assets and do not fork them.
- `claude-platform` owns independently authenticated Hive coordination,
  Codex/Claude/Gemini/Grok adapters, secure launchers, and the already-complete
  MCP 2026-07-28 dual-era compatibility layer. It is intentionally excluded
  from this public plugin.
- OpenAI's current plugin documentation still describes the Codex-specific
  manifest and marketplace packaging, while the vendor-neutral working draft
  defines root `plugin.json` and `mcp.json`. Both are kept side-by-side with
  explicit consistency tests until client ingestion converges.

Review gaps found and handled here: there was no root portable manifest, no
portable typed MCP config, no pinned official schemas, and no tests for secret
absence, containment, manifest closure, schema-version agreement, or portable
client discovery. No missing MCP protocol or Apps SDK implementation was found.

## 2026-08-06 upstream release audit

The Agent Plugins specification repository's two changes on 2026-08-06 only
renamed the project description from a community standard to an open standard.
The 1.0.0 schema blobs did not change, so the reviewed vendored schemas and
their checksums remain current; no package migration is warranted.

Codex changes released the same day added plugin-root-aware skill loading,
remote installed-plugin discovery across scopes, lazy startup of cached MCP
servers for subagents, MCP discovery-timeout cleanup, and reuse of MCP handlers
across sampling steps. The first of these confirms that portable skills must be
immediate children of `skills/` and that every discovered path must remain
inside the plugin root. The tests now recursively enforce that contract and
reject symlinks throughout the portable skills and Codex adapter, nested skill
entry points, schema extensions, non-HTTPS endpoint forms, and URL credentials.

The remaining Codex changes are client lifecycle and performance improvements.
They require no Howard or `tickadoo-mcp` protocol duplication: the package
continues to advertise one canonical remote endpoint and lets each client own
connection caching, lazy startup, discovery cancellation, and authentication.

## Update and rollback

Treat `plugin.json` version as the package release. Update the vendored schemas
only when intentionally targeting a new specification version, review the
normative diff, update both `$schema` values together, and rerun compatibility
tests. Roll back by installing or checking out the last reviewed tag/commit;
the remote MCP service and npm bridge are unaffected by package rollback.

## Follow-ups

- Decide marketplace and directory publication only after client-local testing.
- Define distribution integrity/signing once the working draft specifies it or
  the selected marketplaces provide a suitable mechanism.
- Track the portable OAuth and credential-reference gap. Do not add Hive until
  the standard can express its existing secure client-managed auth path.
- Add client extensions only for demonstrated client-specific value, under a
  stable reverse-domain namespace, with separate tests and ownership.
