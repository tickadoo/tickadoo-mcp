# DEPRECATED

DEPRECATED 2026-06-11 (claude): howard `src/mcp/cards-widget-html.ts` is the
canonical experience-cards widget serving production; this React app is no longer
built by the npm package since v2.0.0; port any outstanding fixes to the howard
bundle; delete +30d unless PRESERVE.

## Why

The accepted ChatGPT app reads the experience-cards widget from
`mcp.tickadoo.com` (the howard Worker), which serves a bundled HTML string from
`howard/src/mcp/cards-widget-html.ts` (`EXPERIENCE_CARDS_HTML` /
`EXPERIENCE_CARDS_EMPTY_HTML`). That bundle is the compiled output of this React
app, captured into howard. howard bundles rather than fetching
`widgets.tickadoo.com` at request time because a Worker fetch to a same-account
Cloudflare host times out (the loopback class covered by the "Workers cannot
self-reference fetch" rule), so the bundled string is the live production
artefact.

Since the v2.0.0 bridge rewrite (GRO-573, PR #92) the `@tickadoo/mcp-server`
package is a thin remote bridge: the `build:widget-cards`, `prebuild`,
`predeploy:widgets` and `deploy:widgets` scripts were removed from
`package.json`, so this React source is no longer built, deployed, or published
by the package. It is orphaned source.

## What this means

- Do NOT add new features here expecting them to ship. They will not.
- The howard bundle has already diverged AHEAD of this source (GRO-237 per-card
  "Book tickets" CTA, SVG trust-badge icons, star-rating glyphs, a richer
  `window.openai` bridge with `openai:set_globals` live refresh). See the parity
  table in the GRO-574 report.
- Any outstanding fix that still matters must be ported into the howard bundle in
  `howard/src/mcp/cards-widget-html.ts` (and ideally re-captured from a rebuilt
  source), not landed here.

## Lifecycle

- PRESERVE marker absent: safe to delete from 2026-07-11 (+30d).
- Add a `PRESERVE` line to this file to keep it (for example if someone decides
  to revive `widgets.tickadoo.com` as the build source of truth and re-wire the
  package to build from here).
