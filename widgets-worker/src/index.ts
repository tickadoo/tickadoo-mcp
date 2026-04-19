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
