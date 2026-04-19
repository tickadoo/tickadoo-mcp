import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { EXPERIENCE_CARD_HTML, EXPERIENCE_MAP_HTML, EXPERIENCE_TRIO_HTML } from "./widgets-html.js";

type Env = {
  NEON_URL: string;
  MCP_INTERNAL_URL: string;
  ADMIN_API_KEY: string;
};

type Partner = {
  partnerId: string;
  publicKey: string;
  name: string;
  domain: string;
  active: boolean;
};

type StructuredResults = {
  results?: unknown[];
  _meta?: Record<string, unknown>;
};

const app = new Hono<{ Bindings: Env }>();

async function validatePartner(
  sql: NeonQueryFunction<false, false>,
  key: string,
  refererUrl: string,
): Promise<Partner | null> {
  if (!key || typeof key !== "string" || key.length > 64) return null;
  const rows = await sql`
    SELECT
      id::text AS "partnerId",
      coalesce(code, id::text) AS "publicKey",
      name,
      domain,
      coalesce(is_active, true) AS active
    FROM partners
    WHERE (code = ${key} OR id::text = ${key})
      AND coalesce(is_active, true) = true
    LIMIT 1
  ` as Partner[];
  if (!rows[0]) return null;
  const partner = rows[0];
  if (!refererUrl) return null;
  let refHost = "";
  try {
    refHost = new URL(refererUrl).hostname;
  } catch {
    return null;
  }
  if (!partner.domain) return null;
  if (refHost !== partner.domain && !refHost.endsWith("." + partner.domain)) return null;
  return partner;
}

// Hardcoded city->coords for the top tickadoo cities, since find_nearby_experiences
// requires lat/lng but the widget URL surface takes a city slug. Covers ~80% of
// demand. Unknown cities fall back to calling search_experiences instead.
const CITY_COORDS: Record<string, { latitude: number; longitude: number }> = {
  london:       { latitude: 51.5074, longitude: -0.1278 },
  "new-york":   { latitude: 40.7128, longitude: -74.0060 },
  newyork:      { latitude: 40.7128, longitude: -74.0060 },
  paris:        { latitude: 48.8566, longitude: 2.3522 },
  rome:         { latitude: 41.9028, longitude: 12.4964 },
  barcelona:    { latitude: 41.3874, longitude: 2.1686 },
  madrid:       { latitude: 40.4168, longitude: -3.7038 },
  amsterdam:    { latitude: 52.3676, longitude: 4.9041 },
  berlin:       { latitude: 52.5200, longitude: 13.4050 },
  venice:       { latitude: 45.4408, longitude: 12.3155 },
  florence:     { latitude: 43.7696, longitude: 11.2558 },
  dubai:        { latitude: 25.2048, longitude: 55.2708 },
  tokyo:        { latitude: 35.6762, longitude: 139.6503 },
  sydney:       { latitude: -33.8688, longitude: 151.2093 },
  "los-angeles":{ latitude: 34.0522, longitude: -118.2437 },
  "las-vegas":  { latitude: 36.1699, longitude: -115.1398 },
  "san-francisco":{ latitude: 37.7749, longitude: -122.4194 },
  chicago:      { latitude: 41.8781, longitude: -87.6298 },
  edinburgh:    { latitude: 55.9533, longitude: -3.1883 },
  dublin:       { latitude: 53.3498, longitude: -6.2603 },
  lisbon:       { latitude: 38.7223, longitude: -9.1393 },
  prague:       { latitude: 50.0755, longitude: 14.4378 },
  vienna:       { latitude: 48.2082, longitude: 16.3738 },
  athens:       { latitude: 37.9838, longitude: 23.7275 },
  istanbul:     { latitude: 41.0082, longitude: 28.9784 },
  bangkok:      { latitude: 13.7563, longitude: 100.5018 },
  singapore:    { latitude: 1.3521, longitude: 103.8198 },
  "hong-kong":  { latitude: 22.3193, longitude: 114.1694 },
  "kuala-lumpur":{ latitude: 3.1390, longitude: 101.6869 },
  marrakech:    { latitude: 31.6295, longitude: -7.9811 },
  "cape-town":  { latitude: -33.9249, longitude: 18.4241 },
  reykjavik:    { latitude: 64.1466, longitude: -21.9426 },
  copenhagen:   { latitude: 55.6761, longitude: 12.5683 },
  stockholm:    { latitude: 59.3293, longitude: 18.0686 },
  oslo:         { latitude: 59.9139, longitude: 10.7522 },
  budapest:     { latitude: 47.4979, longitude: 19.0402 },
};

function normaliseCitySlug(city: string): string {
  return city.trim().toLowerCase().replace(/\s+/g, "-");
}

// Pick the first non-empty list-like payload the tool returned. Different
// tools use different keys (find_nearby: experiences, get_related: related,
// search_experiences: results). All of them are arrays of products.
function pickList(data: StructuredResults | null): unknown[] {
  if (!data || typeof data !== "object") return [];
  const anyData = data as Record<string, unknown>;
  for (const key of ["results", "experiences", "related", "products", "items"]) {
    const v = anyData[key];
    if (Array.isArray(v) && v.length >= 0) return v as unknown[];
  }
  return [];
}

async function fetchStructured(
  mcpUrl: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<StructuredResults | null> {
  const resp = await fetch(mcpUrl + "/mcp", {
    method: "POST",
    headers: {
      // MCP streamable HTTP transport requires BOTH json and text/event-stream in Accept.
      "Accept": "application/json, text/event-stream",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      // format:"json" ensures search_experiences populates structuredContent;
      // tools that ignore it are unaffected.
      params: { name: toolName, arguments: { format: "json", ...args } },
    }),
  });
  if (!resp.ok) return null;
  const data = await resp.json() as { result?: { structuredContent?: StructuredResults; isError?: boolean } };
  if (data?.result?.isError) return null;
  return data?.result?.structuredContent ?? null;
}

function escapeJsonForScript(s: string): string {
  return s.replace(/<\/script>/gi, "<\\/script>");
}

function injectBootstrap(
  html: string,
  data: StructuredResults | null,
  meta: Record<string, unknown>,
): string {
  const structured = data && typeof data === "object" ? data : {};
  const currentMeta = structured._meta && typeof structured._meta === "object"
    ? structured._meta
    : {};
  const merged = {
    ...structured,
    _meta: { ...currentMeta, ...meta },
  };
  const block = `<script id="bootstrap" type="application/json">${escapeJsonForScript(JSON.stringify(merged))}</script>`;
  return html.replace("</body>", block + "</body>");
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function logView(
  sql: NeonQueryFunction<false, false>,
  partnerKey: string,
  widgetType: "card" | "map" | "trio",
  refererHeader: string | null,
  ipHeader: string,
  citySlug?: string,
  productSlug?: string,
  resultCount?: number,
): Promise<void> {
  try {
    const ipHash = ipHeader ? await sha256Hex(ipHeader).catch(() => null) : null;
    await sql`
      INSERT INTO partner_views (partner_id, widget_type, referer, ip_hash, city_slug, product_slug, result_count)
      VALUES (${partnerKey}, ${widgetType}, ${refererHeader}, ${ipHash}, ${citySlug ?? null}, ${productSlug ?? null}, ${resultCount ?? null})
    `;
  } catch (e) {
    console.warn("partner_views insert failed", e);
  }
}

async function resolvePartnerByKey(
  sql: NeonQueryFunction<false, false>,
  key: string,
): Promise<Partner | null> {
  const rows = await sql`
    SELECT
      id::text AS "partnerId",
      coalesce(code, id::text) AS "publicKey",
      name,
      domain,
      coalesce(is_active, true) AS active
    FROM partners
    WHERE (code = ${key} OR id::text = ${key})
    LIMIT 1
  ` as Partner[];
  return rows[0] ?? null;
}

app.get("/health", (c) => c.text("ok"));

app.get("/map", async (c) => {
  const key = c.req.query("key") || "";
  const city = c.req.query("city") || "";
  const maxResults = Math.min(parseInt(c.req.query("max_results") || "10", 10) || 10, 20);
  if (!key) return c.text("Missing key", 400);
  if (!city) return c.text("Missing city", 400);

  const sql = neon(c.env.NEON_URL);
  const partner = await validatePartner(sql, key, c.req.header("Referer") || "");
  if (!partner) return c.text("Invalid partner or referer", 403);

  // Resolve city -> coords. Known cities use find_nearby_experiences
  // (returns lat/lng per product, great for a map). Unknown cities fall
  // back to search_experiences (list-only, no markers).
  const citySlug = normaliseCitySlug(city);
  const coords = CITY_COORDS[citySlug];
  let data: StructuredResults | null;
  if (coords) {
    data = await fetchStructured(c.env.MCP_INTERNAL_URL, "find_nearby_experiences", {
      latitude: coords.latitude,
      longitude: coords.longitude,
      radius_km: 15,
    });
  } else {
    data = await fetchStructured(c.env.MCP_INTERNAL_URL, "search_experiences", {
      city: citySlug,
      max_results: maxResults,
    });
  }
  if (!data) return c.text("Upstream error", 502);

  const results = pickList(data);
  c.executionCtx.waitUntil(logView(
    sql,
    partner.publicKey,
    "map",
    c.req.header("Referer") || null,
    c.req.header("CF-Connecting-IP") || "",
    city,
    undefined,
    results.length,
  ));

  const html = injectBootstrap(EXPERIENCE_MAP_HTML, data, {
    utm_source: `partner_${partner.publicKey}`,
    utm_medium: "widget",
    utm_campaign: "experience-map",
  });
  return c.html(html, 200, {
    "Cache-Control": "public, max-age=60",
    "X-Robots-Tag": "noindex",
  });
});

app.get("/card", async (c) => {
  const key = c.req.query("key") || "";
  const slug = c.req.query("slug") || "";
  if (!key) return c.text("Missing key", 400);
  if (!slug) return c.text("Missing slug", 400);

  const sql = neon(c.env.NEON_URL);
  const partner = await validatePartner(sql, key, c.req.header("Referer") || "");
  if (!partner) return c.text("Invalid partner or referer", 403);

  const data = await fetchStructured(c.env.MCP_INTERNAL_URL, "get_experience_details", { slug });
  if (!data) return c.text("Upstream error", 502);

  c.executionCtx.waitUntil(logView(
    sql,
    partner.publicKey,
    "card",
    c.req.header("Referer") || null,
    c.req.header("CF-Connecting-IP") || "",
    undefined,
    slug,
    1,
  ));

  const html = injectBootstrap(EXPERIENCE_CARD_HTML, data, {
    utm_source: `partner_${partner.publicKey}`,
    utm_medium: "widget",
    utm_campaign: "experience-card",
  });
  return c.html(html, 200, {
    "Cache-Control": "public, max-age=300",
    "X-Robots-Tag": "noindex",
  });
});

app.get("/trio", async (c) => {
  const key = c.req.query("key") || "";
  const slug = c.req.query("slug") || "";
  const context = (c.req.query("context") as "pair" | "after" | "nearby" | "similar" | undefined) ?? "pair";
  if (!key) return c.text("Missing key", 400);
  if (!slug) return c.text("Missing slug", 400);

  const sql = neon(c.env.NEON_URL);
  const partner = await validatePartner(sql, key, c.req.header("Referer") || "");
  if (!partner) return c.text("Invalid partner or referer", 403);

  const data = await fetchStructured(c.env.MCP_INTERNAL_URL, "get_related_experiences", {
    product_id: slug,
    context,
    max_results: 3,
  });
  if (!data) return c.text("Upstream error", 502);

  const results = pickList(data);
  c.executionCtx.waitUntil(logView(
    sql,
    partner.publicKey,
    "trio",
    c.req.header("Referer") || null,
    c.req.header("CF-Connecting-IP") || "",
    undefined,
    slug,
    results.length,
  ));

  const html = injectBootstrap(EXPERIENCE_TRIO_HTML, data, {
    utm_source: `partner_${partner.publicKey}`,
    utm_medium: "widget",
    utm_campaign: "experience-trio",
  });
  return c.html(html, 200, {
    "Cache-Control": "public, max-age=120",
    "X-Robots-Tag": "noindex",
  });
});


// ── Public embeds gallery at /examples ────────────────────────────────────
// Living demo page for partner conversations. The widget iframes below work
// because the `test_demo` partner has `domain = tickadoo.com`, and any call
// with Referer = https://widgets.tickadoo.com/... matches via the
// ".tickadoo.com" suffix rule in validatePartner.

const EXAMPLES_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>tickadoo widgets &middot; live embeds</title>
<meta name="description" content="Experience commerce embeds: map, card, and related-experiences widgets you can drop into any partner site.">
<style>
  :root {
    --bg: #ffffff;
    --bg-alt: #f9fafb;
    --bg-code: #0f1115;
    --border: #e5e7eb;
    --text: #0f172a;
    --text-dim: #475569;
    --text-muted: #94a3b8;
    --accent: #f97316;
    --accent-hover: #ea580c;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0b0d12;
      --bg-alt: #13161d;
      --bg-code: #05060a;
      --border: #23272f;
      --text: #e5e7eb;
      --text-dim: #9ca3af;
      --text-muted: #6b7280;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--text);
    font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 960px; margin: 0 auto; padding: 56px 24px 96px; }
  header { margin-bottom: 56px; text-align: center; }
  h1 { font-size: 42px; font-weight: 800; margin: 0 0 16px; letter-spacing: -0.03em; line-height: 1.05; }
  h1 .accent { color: var(--accent); }
  .tagline { font-size: 18px; color: var(--text-dim); max-width: 640px; margin: 0 auto; }
  .cta-row { margin-top: 28px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
  .cta { display: inline-block; padding: 10px 22px; background: var(--accent); color: #fff; border-radius: 8px; font-weight: 600; text-decoration: none; font-size: 14px; transition: background 0.15s; }
  .cta:hover { background: var(--accent-hover); }
  .cta.secondary { background: transparent; color: var(--text); border: 1px solid var(--border); }

  .example { margin-bottom: 72px; }
  .example-head { margin-bottom: 20px; }
  .kicker { color: var(--accent); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
  h2 { font-size: 24px; font-weight: 700; margin: 0 0 8px; letter-spacing: -0.02em; }
  .lede { color: var(--text-dim); font-size: 15px; margin: 0; max-width: 560px; }

  .preview-frame {
    border: 1px solid var(--border); border-radius: 14px; overflow: hidden;
    background: var(--bg-alt); margin-bottom: 16px; position: relative;
  }
  .preview-label {
    position: absolute; top: 12px; right: 12px; z-index: 1;
    background: rgba(15,23,42,0.8); color: #fff; padding: 4px 10px;
    border-radius: 999px; font-size: 11px; font-weight: 600;
    font-family: ui-monospace, Menlo, Consolas, monospace; backdrop-filter: blur(4px);
  }
  iframe { width: 100%; border: 0; display: block; background: transparent; }

  .code-block {
    background: var(--bg-code); color: #e5e7eb; border-radius: 10px;
    padding: 18px 20px; font: 13px/1.5 ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    overflow-x: auto; position: relative;
  }
  .code-block::before {
    content: "copy this snippet";
    position: absolute; top: 10px; right: 14px;
    color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em;
    font-family: -apple-system, sans-serif;
  }
  .code-block code { color: inherit; }
  .code-block .str { color: #86efac; }
  .code-block .attr { color: #93c5fd; }
  .code-block .tag { color: #fca5a5; }
  .code-block .comment { color: #64748b; }

  .params-list { display: grid; gap: 6px; margin: 16px 0; color: var(--text-dim); font-size: 14px; }
  .params-list code { background: var(--bg-alt); padding: 2px 7px; border-radius: 4px; color: var(--text); font-size: 13px; }

  .faq { border-top: 1px solid var(--border); padding-top: 48px; }
  .faq h3 { font-size: 14px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; margin: 0 0 24px; }
  details { padding: 12px 0; border-bottom: 1px solid var(--border); }
  details:last-child { border-bottom: none; }
  summary { font-weight: 600; cursor: pointer; padding: 4px 0; list-style: none; }
  summary::marker, summary::-webkit-details-marker { display: none; }
  summary::before { content: "+"; display: inline-block; width: 20px; color: var(--accent); font-weight: 700; }
  details[open] summary::before { content: "−"; }
  details p { color: var(--text-dim); margin: 8px 0 0 20px; }
  details p code { background: var(--bg-alt); padding: 2px 6px; border-radius: 4px; font-size: 13px; }

  footer { margin-top: 72px; padding-top: 24px; border-top: 1px solid var(--border); text-align: center; color: var(--text-muted); font-size: 13px; }
  footer a { color: var(--accent); text-decoration: none; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Embed experiences <span class="accent">anywhere</span>.</h1>
    <p class="tagline">Three production-ready widgets, powered by the tickadoo catalogue. Drop them into any travel site, hotel concierge, or blog post. Live data, live booking, commissions paid out automatically.</p>
    <div class="cta-row">
      <a class="cta" href="mailto:partners@tickadoo.com?subject=tickadoo%20widget%20access">Get your partner key</a>
      <a class="cta secondary" href="https://mcp.tickadoo.com/mcp">Or use the MCP directly</a>
    </div>
  </header>

  <section class="example">
    <div class="example-head">
      <div class="kicker">Widget 1 &middot; /map</div>
      <h2>City map with inventory</h2>
      <p class="lede">A mini-map of bookable experiences in any city. Clicks attribute back to you. Ships as a single iframe.</p>
    </div>
    <div class="preview-frame" style="height: 560px;">
      <div class="preview-label">widgets.tickadoo.com/map</div>
      <iframe src="/map?key=test_demo&city=london" height="560" loading="lazy" title="Live tickadoo map widget for London"></iframe>
    </div>
    <div class="code-block">
<span class="tag">&lt;iframe</span> <span class="attr">src</span>=<span class="str">"https://widgets.tickadoo.com/map?key=YOUR_KEY&amp;city=london"</span>
        <span class="attr">width</span>=<span class="str">"100%"</span> <span class="attr">height</span>=<span class="str">"560"</span> <span class="attr">style</span>=<span class="str">"border:0;border-radius:12px;"</span><span class="tag">&gt;&lt;/iframe&gt;</span>
    </div>
    <div class="params-list">
      <div><code>city</code> &middot; city slug (e.g. <code>london</code>, <code>new-york</code>, <code>paris</code>, <code>tokyo</code>)</div>
      <div><code>max_results</code> &middot; optional, 1–20, defaults to 10</div>
    </div>
  </section>

  <section class="example">
    <div class="example-head">
      <div class="kicker">Widget 2 &middot; /card</div>
      <h2>Single experience card</h2>
      <p class="lede">The full detail card for one experience: hero image, price, reviews, and a book-now button that carries your attribution.</p>
    </div>
    <div class="preview-frame" style="height: 700px;">
      <div class="preview-label">widgets.tickadoo.com/card</div>
      <iframe src="/card?key=test_demo&slug=abba-voyage-tickets" height="700" loading="lazy" title="Live tickadoo card widget for ABBA Voyage"></iframe>
    </div>
    <div class="code-block">
<span class="tag">&lt;iframe</span> <span class="attr">src</span>=<span class="str">"https://widgets.tickadoo.com/card?key=YOUR_KEY&amp;slug=EXPERIENCE_SLUG"</span>
        <span class="attr">width</span>=<span class="str">"100%"</span> <span class="attr">height</span>=<span class="str">"700"</span> <span class="attr">style</span>=<span class="str">"border:0;border-radius:12px;"</span><span class="tag">&gt;&lt;/iframe&gt;</span>
    </div>
    <div class="params-list">
      <div><code>slug</code> &middot; the tickadoo product slug (e.g. <code>abba-voyage-tickets</code>)</div>
    </div>
  </section>

  <section class="example">
    <div class="example-head">
      <div class="kicker">Widget 3 &middot; /trio</div>
      <h2>Related experiences trio</h2>
      <p class="lede">Three related or co-bookable experiences for a given product. Ideal for "you might also like" blocks on experience pages.</p>
    </div>
    <div class="preview-frame" style="height: 320px;">
      <div class="preview-label">widgets.tickadoo.com/trio</div>
      <iframe src="/trio?key=test_demo&slug=abba-voyage-tickets&context=pair" height="320" loading="lazy" title="Live tickadoo related experiences widget"></iframe>
    </div>
    <div class="code-block">
<span class="tag">&lt;iframe</span> <span class="attr">src</span>=<span class="str">"https://widgets.tickadoo.com/trio?key=YOUR_KEY&amp;slug=EXPERIENCE_SLUG&amp;context=pair"</span>
        <span class="attr">width</span>=<span class="str">"100%"</span> <span class="attr">height</span>=<span class="str">"320"</span> <span class="attr">style</span>=<span class="str">"border:0;border-radius:12px;"</span><span class="tag">&gt;&lt;/iframe&gt;</span>
    </div>
    <div class="params-list">
      <div><code>slug</code> &middot; the source experience slug</div>
      <div><code>context</code> &middot; one of <code>pair</code>, <code>after</code>, <code>nearby</code>, <code>similar</code></div>
    </div>
  </section>

  <div class="faq">
    <h3>Common questions</h3>
    <details>
      <summary>How does attribution work?</summary>
      <p>Every click out of a widget carries <code>utm_source=partner_YOUR_KEY</code>, <code>utm_medium=widget</code>, and a campaign tag. When the booking completes, a row lands in <code>partner_commissions</code> with your share of the gross. Dashboards and payouts follow automatically.</p>
    </details>
    <details>
      <summary>What does a partner key look like?</summary>
      <p>Something like <code>ptr_abc12345</code>. You send us the primary domain you'll embed on, we issue a key, and the widget enforces Referer matching so nobody else can borrow your key.</p>
    </details>
    <details>
      <summary>Can I restyle the widgets?</summary>
      <p>For deeper customisation, talk to us about <code>CONNECT</code> or call the MCP directly at <code>mcp.tickadoo.com/mcp</code> and render however you like. These iframes are the zero-effort path.</p>
    </details>
    <details>
      <summary>Is there an API I can call instead of iframes?</summary>
      <p>Yes — <a href="https://mcp.tickadoo.com/mcp" style="color:var(--accent)">mcp.tickadoo.com/mcp</a> exposes the full MCP tool surface. Or the Howard CONNECT REST API for traditional integrations.</p>
    </details>
    <details>
      <summary>What is the current commercial rate?</summary>
      <p>Default is 10% of gross on confirmed bookings. Higher for strategic partners and hotels on CONNECT. Paid out via Stripe Connect.</p>
    </details>
  </div>

  <footer>
    <a href="mailto:partners@tickadoo.com">partners@tickadoo.com</a> &middot; tickadoo ® &middot; powered by <a href="https://mcp.tickadoo.com">mcp.tickadoo.com</a>
  </footer>
</div>
</body>
</html>`;

app.get("/examples", (c) => c.html(EXAMPLES_HTML, 200, {
  "Cache-Control": "public, max-age=300",
  "Content-Security-Policy": "default-src 'self'; frame-src 'self'; style-src 'self' 'unsafe-inline'",
  "X-Robots-Tag": "noindex",
}));

const requireAdmin = async (c: any, next: any) => {
  const key = c.req.header("X-Admin-Key");
  if (!key || key !== c.env.ADMIN_API_KEY) return c.text("Forbidden", 403);
  await next();
};

app.use("/admin/*", requireAdmin);

app.post("/admin/partners", async (c) => {
  const body = await c.req.json() as { name?: string; domain?: string; category?: string; contact_email?: string };
  if (!body.name || !body.domain || !body.category) return c.text("Missing fields", 400);
  const sql = neon(c.env.NEON_URL);
  const partnerId = crypto.randomUUID();
  const publicKey = "ptr_" + nanoid(8);
  await sql`
    INSERT INTO partners (id, code, name, domain, category, contact_email, is_active, revenue_share_percent, created_at, updated_at)
    VALUES (${partnerId}, ${publicKey}, ${body.name}, ${body.domain}, ${body.category}, ${body.contact_email ?? null}, true, 10, now(), now())
  `;
  const embed = {
    map: `<iframe src="https://widgets.tickadoo.com/map?key=${publicKey}&city=YOUR_CITY" width="100%" height="560" style="border:0;border-radius:12px;"></iframe>`,
    card: `<iframe src="https://widgets.tickadoo.com/card?key=${publicKey}&slug=YOUR_PRODUCT_SLUG" width="100%" height="700" style="border:0;border-radius:12px;"></iframe>`,
    trio: `<iframe src="https://widgets.tickadoo.com/trio?key=${publicKey}&slug=YOUR_PRODUCT_SLUG" width="100%" height="320" style="border:0;border-radius:12px;"></iframe>`,
  };
  return c.json({ id: publicKey, embed });
});

app.get("/admin/partners", async (c) => {
  const sql = neon(c.env.NEON_URL);
  const rows = await sql`
    SELECT
      coalesce(code, id::text) AS id,
      name,
      domain,
      category,
      coalesce(is_active, true) AS active,
      created_at
    FROM partners
    ORDER BY created_at DESC
    LIMIT 100
  `;
  return c.json({ partners: rows });
});

app.get("/admin/partners/:id/stats", async (c) => {
  const key = c.req.param("id");
  const sql = neon(c.env.NEON_URL);
  const partner = await resolvePartnerByKey(sql, key);
  if (!partner) return c.text("Not found", 404);
  const stats = await sql`
    SELECT
      (SELECT count(*)::int FROM partner_views WHERE partner_id = ${partner.publicKey} AND viewed_at > now() - interval '24 hours') AS views_24h,
      (SELECT count(*)::int FROM partner_views WHERE partner_id = ${partner.publicKey} AND viewed_at > now() - interval '7 days') AS views_7d,
      (SELECT count(*)::int FROM partner_commissions WHERE partner_id::text = ${partner.partnerId}) AS bookings_total,
      (SELECT coalesce(sum(coalesce(commission_amount, partner_share)), 0)::numeric FROM partner_commissions WHERE partner_id::text = ${partner.partnerId} AND coalesce(paid_out, false) = false) AS unpaid_commission
  `;
  return c.json(stats[0] ?? {});
});

export default app;
