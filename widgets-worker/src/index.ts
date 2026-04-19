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

async function fetchStructured(
  mcpUrl: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<StructuredResults | null> {
  const resp = await fetch(mcpUrl + "/mcp", {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
  });
  if (!resp.ok) return null;
  const data = await resp.json() as { result?: { structuredContent?: StructuredResults } };
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

  const data = await fetchStructured(c.env.MCP_INTERNAL_URL, "find_nearby_experiences", { city, max_results: maxResults });
  if (!data) return c.text("Upstream error", 502);

  const results = data.results ?? [];
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

  const data = await fetchStructured(c.env.MCP_INTERNAL_URL, "get_experience_details", { product_id: slug });
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

  const results = data.results ?? [];
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
