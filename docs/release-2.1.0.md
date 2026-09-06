# `@tickadoo/mcp-server` 2.1.0 release checklist

Status: **prepared only**. This file does not authorize npm publication, MCP
Registry publication, tags, releases, directory submissions, deployment, or
production changes.

## Why this release matters

As verified on 2026-09-06, npm `latest` is still 1.4.3. Its bridge defaults to
the retired `https://api.tickadoo.com` host and its packed `server.json` says
1.4.1. The Official MCP Registry still serves 1.3.0 with count-bearing catalogue
copy. The 2.1.0 candidate replaces that dead local implementation with the
reviewed thin bridge to `https://mcp.tickadoo.com/mcp` and packages the portable
Agent Plugins distribution.

## Approval boundary

Before any external release action, obtain explicit human approval naming the
exact reviewed commit. Recheck that the approved commit is still the branch
head, rebased on `origin/main`, and has green required checks. Publication is
not a normal consequence of merging the preparation PR.

Use the repository's configured npm and Registry identities. Do not place
credentials in commands, files, manifests, issue comments, CI logs, or prompts.
The repository currently has no provenance-capable publish workflow, so npm
activation remains blocked until a separately reviewed and approved path uses a
supported cloud CI runner. Prefer a
[stage-only npm trusted publisher](https://docs.npmjs.com/trusted-publishers/):
CI may run `npm stage publish`, but it must not be allowed to run `npm publish`
directly.
Staging reserves the version and is itself an external mutation, so it also
requires explicit approval for the exact commit. Use Node 22.14.0 or newer and
npm 11.15.0 or newer; npm's current
[staged-publishing documentation](https://docs.npmjs.com/staged-publishing/)
defines those minimums and the separate human 2FA approval step.
The reviewed release baseline is npm 11.19.1, so pin that exact CLI rather than
floating to `latest` in the future workflow.
Adding a workflow, configuring the trusted-publisher connection, staging a
version, or changing package access is separate external authority; do not infer
it from approval of this preparation PR.
The package sets `publishConfig.provenance: true` so an unsupported local
publish path fails closed; do not remove or override that setting during
activation.

## Exact candidate checks

Run these against the approved clean checkout:

```bash
npm ci
npm --version # must report 11.19.1
npm run build
npm test
LIVE=1 npm test
npx tsc --noEmit
npm pack --dry-run --json --ignore-scripts
npm publish --dry-run --json --ignore-scripts
mcp-publisher validate server.json
```

Pin `mcp-publisher` 1.8.1 and verify its
[official release archive](https://github.com/modelcontextprotocol/registry/releases/tag/v1.8.1)
digest before use. The reviewed GitHub release-asset SHA-256 values are
`e45e520892460732a4bdf37255576415d4a53ec171f8b913faf15bb1aef7cb77`
for Darwin arm64 and
`a06c9096dcb9727c13555b6be26c7effa707b01f06a4c561ba7a3635443cf2cc`
for Linux amd64.

The candidate must satisfy all of the following:

- package, root lock entry, bridge constant, portable manifest, Claude/Codex/
  Gemini manifests, Copilot marketplace entry, and `server.json` all report
  2.1.0;
- the tarball contains the bridge, portable and client manifests, seven skills,
  pinned Agent Plugins schemas, provider-neutral evals, and OpenAI brand assets;
- the publish dry-run reports the `mcp-server` executable at `dist/index.js`
  without npm auto-correcting or removing package metadata;
- live MCP tests pass against `https://mcp.tickadoo.com/mcp`;
- `mcp-publisher validate` succeeds without publishing;
- independent exact-head review reports `AI_REVIEW: NO_BLOCKERS_FOUND`.

## Authorized activation sequence

Only after the approval boundary is satisfied:

1. Stage npm 2.1.0 only from the separately approved provenance-capable,
   stage-only trusted-publisher workflow. Record the workflow run, source commit,
   stage ID, tag, and candidate integrity. Trusted publishing generates
   provenance automatically for this public repository and package.
2. A maintainer must inspect `npm stage view`, download the staged tarball, and
   compare its manifest, file list, executable mode, and digest with the reviewed
   candidate. Reject rather than approve any mismatch.
3. Only after that comparison, a maintainer may approve the exact stage with 2FA.
   The OIDC workflow must not approve its own stage.
4. Read back npm `latest`, version, integrity, packed `server.json`, provenance
   source commit/build link, and public-ledger attestation. Verify the installed
   package's registry signature and provenance with a current npm CLI.
5. Install the public tarball in a clean temporary directory and verify
   `tools/list`, `search_experiences`, and `list_cities` through the stdio
   bridge.
6. Publish `server.json` 2.1.0 with the official `mcp-publisher` CLI.
7. Read back the exact 2.1.0 Registry record and its `latest` alias.
8. Create any tag or GitHub release only if separately included in the approval.
9. Record the exact versions, integrity, readbacks, smoke results, and external
   mutations in the release issue and `#activity`.

Keep npm and Registry activation sequential. If npm publication or its clean
install smoke fails, do not publish the Registry record. If Registry
publication fails, leave npm evidence intact and stop for review rather than
re-running publication blindly.

If the staged artifact fails review, do not approve it. Rejecting a stage needs
maintainer 2FA and explicit authority; after rejection, rebuild and re-review
before staging the version again.

## Rollback and correction

npm versions and MCP Registry versions are immutable. A rollback never edits
2.1.0 in place. npm 1.4.2 and 1.4.3 both contain the retired
`https://api.tickadoo.com` backend, so neither is a valid rollback target:

- do not move npm `latest` to 1.4.2 or 1.4.3; when no independently verified
  healthy predecessor exists, deprecate the faulty release with a concise
  operator-approved message and prepare a corrected patch version under a new
  review and approval;
- mark the faulty Registry version deprecated with an operator-approved status
  message, then publish a new patch version for corrected metadata;
- keep the public remote MCP rollback in Howard's existing deployment process;
  this package must not duplicate or trigger it.

Each rollback action is an external mutation and needs the same explicit human
authority as activation. Verify every changed public alias or status by reading
it back before declaring rollback complete.
