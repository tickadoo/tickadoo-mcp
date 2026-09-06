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
  Tests pin both spellings and the identical endpoint.
- `.claude-plugin/marketplace.json`, `.claude-plugin/plugin.json`, and
  `.mcp.json` provide Claude Code's native repository marketplace, plugin, and
  credential-free MCP adapters. The marketplace source is the repository root;
  the plugin manifest alone owns the version, as Anthropic's
  [version-resolution guidance](https://code.claude.com/docs/en/plugin-marketplaces#version-resolution-and-release-channels)
  recommends.
- `clients/github-copilot/mcp.json` is a copy-ready repository-settings adapter
  for Copilot cloud agent and Copilot code review. It uses GitHub's `http`
  transport spelling and an explicit eight-tool, read-only allowlist. It omits
  the consent-gated feedback tool, the ChatGPT card renderer, wildcards,
  headers, environment variables and credentials.

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

The published `.mcp.json` and `.claude-plugin/` files are compatibility adapters
for clients that install or unpack the npm artifact as a plugin source; they do
not alter MCP configuration merely by existing under `node_modules`.
The portable root `mcp.json` remains authoritative for Agent Plugins clients.

`evals/agent-plugin-scenarios.json` defines the same discovery, grounding,
availability, privacy, feedback-consent and booking-handoff expectations for
every client. It is intentionally provider-neutral: client-specific runners
may score ChatGPT, Claude, Copilot, Cursor, VS Code and Kiro without forking the
acceptance contract. Nine positive cases include explicit fixture assumptions
and expected result shapes; three negative cases define the safe fallback and
why the requested action must not be completed. Tests enforce that split so the
corpus remains directly reusable by review and evaluation runners. A negative
case may name a tool when the expected safe behavior permits it only after an
explicit gate (for example, feedback consent); an empty list means no tool call.
The corpus has its own version so runner integrations can pin its field contract
independently of the plugin version.

The MCP Registry export preserves each live tool's standard title and
annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, and
`openWorldHint`). This lets downstream registries evaluate safety and tool
selection from the published artifact instead of receiving only names and
descriptions. The feedback tool remains explicitly non-read-only; catalogue,
planning, availability and rendering tools remain read-only.
`report_quality_signal` is also explicitly open-world because it submits the
user-approved quality signal to the remote service; it remains non-destructive
and idempotent.

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
- Claude Code: add `tickadoo/tickadoo-mcp` as a marketplace, then install
  `tickadoo@tickadoo-agent-plugins`. Its strict marketplace entry resolves to
  the repository root and relies on `.claude-plugin/plugin.json` as the single
  version authority.
- GitHub Copilot: CLI 1.0.78 successfully discovered this checkout through
  `copilot --plugin-dir . plugin list` as external plugin
  `tickadoo-experiences`. GitHub now also documents direct installation from a
  repository or local path and declarative enablement through
  `.github/copilot/settings.json`. Copilot discovers the portable root
  `plugin.json`, standard `skills/`, and the credential-free `.mcp.json`
  adapter without a second Copilot-specific manifest. On 2026-08-30, Copilot
  CLI 1.0.80 installed the checkout and reported all seven skills, but warned
  that direct installs are deprecated. The repository therefore also carries
  `.github/plugin/marketplace.json` for the supported marketplace installation
  and update path.
- Kiro: import the plugin as a Power; it advertises Agent Skills and all three
  portable MCP transports.

### GitHub Copilot cloud setup

GitHub's [primary repository MCP documentation](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/configure-mcp-servers),
rechecked on 2026-08-24, requires repository administrators to paste MCP JSON
into **Settings → Copilot → MCP servers**.
That configuration is available to Copilot cloud agent and Copilot code review;
repository and CLI MCP configurations also become available in the
[GitHub Copilot app](https://docs.github.com/en/copilot/how-tos/github-copilot-app/customize-github-copilot-app).
GitHub requires a `tools` array and strongly recommends explicitly allowlisting
read-only tools because cloud agents can invoke them autonomously without
per-call approval.

Copy `clients/github-copilot/mcp.json` into that repository setting. The public
tickadoo endpoint requires no authentication, so this adapter needs no Agents
secret, header or environment variable. It deliberately exposes only the core
discovery, comparison, details and live-availability journey. The tests prove
that every allowlisted tool remains present and read-only in `server.json`, the
URL remains identical to portable `mcp.json`, and the published npm tarball
contains the adapter. This repository does not apply settings automatically;
enabling it remains an explicit repository-administrator action.

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
  manifest and marketplace packaging, while the published vendor-neutral 1.0
  specification defines root `plugin.json` and `mcp.json`. Both are kept
  side-by-side with explicit consistency tests until client ingestion
  converges.

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

## 2026-08-28 upstream release audit

Agent Plugins 1.0.0 is now published rather than a working draft. Its canonical
schema files remain byte-for-byte identical to the copies pinned here. A 1.1.0
working draft was opened on 2026-08-12; its current schemas differ from 1.0.0
only in schema identifiers and descriptions, so this package remains on the
published 1.0.0 line until a reviewed draft change adds material value.

GitHub Copilot now documents plugins as first-class bundles across Copilot CLI,
the cloud agent, and the GitHub Copilot app. Its discovery conventions include
root `plugin.json`, `skills/`, and root `.mcp.json`, all of which this package
already ships. The separately tested `clients/github-copilot/mcp.json` remains
useful for repository administrators who want the narrower eight-tool,
default-deny cloud configuration rather than the full plugin tool surface.

Copilot CLI 1.0.80 successfully installed this checkout in an isolated client
home and discovered all seven skills. That release warns that direct repository
and local-path installs will be removed in favor of marketplace installation.
The checked-in marketplace manifest makes this repository locally testable as
`tickadoo-experiences@tickadoo-agent-plugins`; adding the marketplace to a user,
organization, or public catalog remains an explicit distribution decision.

Anthropic's managed-agent MCP connector now separates reusable server URLs from
session credentials held in vaults and supports disabling tools by default
before explicitly enabling a reviewed subset. That validates this package's
credential-free public manifest and least-privilege adapter pattern; it does
not justify embedding Hive credentials or duplicating its authenticated MCP
transport.

## 2026-09-06 upstream release audit

The published Agent Plugins specification remains 1.0.0. The 1.1.0 working
draft still changes only schema identifiers and descriptions, so the portable
package remains pinned to the published line.

Kiro's [Powers documentation](https://kiro.dev/docs/powers/) now confirms that
root `plugin.json` keywords drive on-demand activation as well as discovery.
The portable manifest therefore carries explicit theatre, tour, attraction,
event, and booking intent terms alongside the tickadoo brand and general
experience/travel terms; a focused test keeps that activation vocabulary from
silently regressing.

OpenAI now documents [one universal public plugin directory](https://developers.openai.com/plugins/deploy/submission)
shared by ChatGPT and Codex. The repository therefore includes
`.agents/plugins/marketplace.json` for repo and workspace discovery, while the
existing `.codex-plugin/plugin.json` remains the client manifest. Codex CLI
0.153.4 successfully added the exact local marketplace, discovered the root
plugin, installed version 2.0.0 with all seven skills and both brand assets,
and then removed the plugin and marketplace cleanly.

The Codex listing now uses a 30-character-or-shorter subtitle, a live canonical
terms URL, square SVG `composerIcon` and `logo` assets, HTTPS legal links, three
bounded starter prompts, and a brand colour that passes OpenAI's documented
light-background contrast floor. Tests enforce those final-directory metadata
limits and prove the assets ship in the npm tarball.

OpenAI's [GitHub workspace-import documentation](https://learn.chatgpt.com/docs/enterprise/plugin-management)
currently marks every imported
plugin that declares MCP configuration as desktop-only, even when the server
uses a public HTTPS URL. Web availability therefore still requires either the
public **With MCP** submission flow or an `.app.json` reference to a real
ChatGPT-registered MCP connection. This repository does not invent an
`asdk_app_...` identifier. OpenAI's final submission form also requires the
support URL `https://www.tickadoo.com/contact`; the current local Plugin
Creator 1.2.3 validator rejects the newly documented `interface.supportURL`
field, so the value remains a portal field until the installed package schema
accepts it.

Anthropic CLI 1.30.0 introduced [`ant apply`](https://platform.claude.com/docs/en/cli-sdks-libraries/cli/apply)
for managed resources as code. The current 1.31.0 CLI accepted the exact shipped
adapter with an isolated, credential-free `ant apply --dry-run` and planned one
agent create. That is local parse/plan evidence only, not an authenticated API
rehearsal or remote mutation. Claude Code 2.1.263 also validated the native
`.claude-plugin/plugin.json` with no manifest errors or warnings; its sole
content warning correctly notes that the repository-level `CLAUDE.md` is not
plugin-delivered context, because this package supplies reusable context under
`skills/` instead.

Howard issue #5053 and PR #5054 already own that operational apply/lockfile
lane; this package keeps only the portable copy-ready, default-deny agent body
and does not duplicate account mutation or lockfile infrastructure. Claude
Code 2.1.259 introduced the machine-readable validation used above. Copilot CLI
1.0.83 discovered this exact root package as an external plugin and also
improved MCP lifecycle and OAuth support; both remain client concerns around
the same credential-free public endpoint.

### Claude Managed Agents setup

`clients/anthropic-managed-agents/agent.json` is a copy-ready agent-create body
for Anthropic's Managed Agents beta. It uses the pinned `claude-sonnet-5` model,
declares only the public tickadoo MCP URL, disables newly discovered MCP tools
by default, and explicitly enables the same eight read-only journey tools as
the Copilot cloud adapter. Those reviewed read-only calls use `always_allow`;
anything not listed remains disabled with the conservative `always_ask`
fallback. No vault is required because the public endpoint is unauthenticated.

Create the agent with Anthropic's current Managed Agents API or CLI, then create
a session using the returned agent ID and an environment ID. This repository
does not create an Anthropic agent, environment, session, API key, or vault.
Managed Agents is a beta service, so recheck Anthropic's beta header and model
support before external account setup.

## Update and rollback

Treat `plugin.json` version as the package release. Update the vendored schemas
only when intentionally targeting a new specification version, review the
normative diff, update both `$schema` values together, and rerun compatibility
tests. Roll back by installing or checking out the last reviewed tag/commit;
the remote MCP service and npm bridge are unaffected by package rollback.

## Follow-ups

- Decide marketplace and directory publication only after client-local testing.
- Define distribution integrity/signing once the specification defines it or
  the selected marketplaces provide a suitable mechanism.
- Track the portable OAuth and credential-reference gap. Do not add Hive until
  the standard can express its existing secure client-managed auth path.
- Add client extensions only for demonstrated client-specific value, under a
  stable reverse-domain namespace, with separate tests and ownership.
