# Vendored quality helpers — sync contract

This directory holds **vendored copies** of pure quality-decision helpers
whose source of truth lives in the howard repo at `src/quality/`.
The same helpers are consumed by the OpenAI Commerce feed, this MCP,
the @howard chatbot, and future surfaces (Meta catalog, Apple, Mews).

## Why vendor instead of npm package

Three options were considered (per howard/src/quality/README.md):

1. **Vendored copy with CI sync-check** ← current
2. Sibling npm package `@tickadoo/quality`
3. Monorepo merge of MCP into howard

Option 1 is the cheapest first cut. When three or more independent
repos need the module, we'll promote to option 2. Monorepo merge is
deferred until the cross-repo coordination cost crosses a threshold.

## Vendoring source

| File | Howard source path | Last synced from SHA |
|---|---|---|
| `seasonal-variants.ts` | `src/quality/seasonal-variants.ts` | (recorded in file header) |

## CI sync-check

`.github/workflows/quality-sync.yml` runs on every PR + nightly. It fetches
the howard source and diffs against the vendored copy. Drift fails CI loudly.

## How to refresh

Run `scripts/sync-quality.sh` from the repo root. The script fetches
the latest howard source, replaces the vendored copy, updates the SHA
header, and prints the new SHA for committing.

## How to edit

Edit the howard source. Then refresh here. Never edit the vendored
copy directly — CI will catch the drift, but the howard source is
the authoritative version any new consumer of the module sees.

## Adding a new vendored file

1. Add the file to `src/quality/` in the howard repo
2. Export it from `src/quality/index.ts` there
3. Add a row to the table above
4. Vendor it under `src/shared/quality/` here with the SHA header
5. Re-export it from `src/shared/quality/index.ts`
6. Update `scripts/sync-quality.sh` to include it in the refresh
