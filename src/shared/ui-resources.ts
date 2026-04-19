import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * MCP Apps UI resources served by the tickadoo MCP server.
 *
 * Conforming clients (Claude, ChatGPT Apps, Goose, VS Code) inspect the
 * `_meta.ui.resourceUri` field on a tool result and render the matching
 * UI resource inline. Non-conforming clients ignore `_meta.ui` and fall
 * back to the tool's normal text / structuredContent output, so this is
 * fully additive.
 *
 * HTML is kept as inline `String.raw` template literals so the module
 * works identically under Node, Cloudflare Workers, and Vercel Edge with
 * no bundler plugin and no runtime fs access. The only external asset
 * is Leaflet 1.9.4, pinned to a specific cdnjs URL with SRI hashes, and
 * loaded only inside the experience-map iframe.
 *
 * GRO-229.
 */

export const EXPERIENCE_CARD_URI = "ui://tickadoo/experience-card.html";
export const EXPERIENCE_MAP_URI = "ui://tickadoo/experience-map.html";
export const EXPERIENCE_TRIO_URI = "ui://tickadoo/experience-trio.html";

/**
 * Build the `_meta` payload that wires a tool to one of these UI
 * resources. The dual key shape (`ui.resourceUri` + `openai/outputTemplate`)
 * lets one declaration light up Claude/Goose/VS Code (MCP Apps spec) and
 * ChatGPT Apps simultaneously, with neither client breaking on the other's
 * key. Optional `invoking`/`invoked` hints are ChatGPT-only loading state
 * strings; conforming MCP-Apps clients ignore them safely.
 */
export function uiMeta(
  uri: string,
  hints?: { invoking?: string; invoked?: string },
): {
  ui: { resourceUri: string };
  "openai/outputTemplate": string;
  "openai/toolInvocation/invoking"?: string;
  "openai/toolInvocation/invoked"?: string;
} {
  const meta: {
    ui: { resourceUri: string };
    "openai/outputTemplate": string;
    "openai/toolInvocation/invoking"?: string;
    "openai/toolInvocation/invoked"?: string;
  } = {
    ui: { resourceUri: uri },
    "openai/outputTemplate": uri,
  };
  if (hints?.invoking) meta["openai/toolInvocation/invoking"] = hints.invoking;
  if (hints?.invoked) meta["openai/toolInvocation/invoked"] = hints.invoked;
  return meta;
}

/**
 * MCP Apps standard MIME type. Hosts (Claude, ChatGPT, Goose, VS Code)
 * only enable the MCP Apps bridge — sandbox iframe + ui/* postMessage
 * channel — when this exact MIME is returned. Plain `text/html` is
 * treated as a generic resource and will NOT render inline.
 */
export const MCP_APP_MIME_TYPE = "text/html;profile=mcp-app";

interface UiResourceSpec {
  readonly name: string;
  readonly uri: string;
  readonly description: string;
  readonly html: string;
  readonly resourceMeta?: Record<string, unknown>;
}

export const EXPERIENCE_CARD_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>tickadoo experience</title>
<style>
  :root {
    --bg: #ffffff;
    --fg: #0f1115;
    --muted: #5a6172;
    --line: #e6e8ee;
    --card: #ffffff;
    --gold: #c69b3d;
    --gold-fg: #1a1305;
    --accent: #0f1115;
    --accent-fg: #ffffff;
    --pop-bg: #fff7e3;
    --pop-fg: #6b4a05;
    --urg-bg: #fdecec;
    --urg-fg: #8a1f1f;
    --chip-bg: #f3f4f8;
    --chip-fg: #2a2f3a;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0d1016;
      --fg: #ecedf1;
      --muted: #98a0b3;
      --line: #1f2330;
      --card: #141823;
      --gold: #d6ad55;
      --gold-fg: #1a1305;
      --accent: #ecedf1;
      --accent-fg: #0d1016;
      --pop-bg: #2a2113;
      --pop-fg: #f1d692;
      --urg-bg: #2a1515;
      --urg-fg: #f7b3b3;
      --chip-bg: #1d2230;
      --chip-fg: #d8dbe4;
    }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--fg);
    font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 14px;
    overflow: hidden; max-width: 560px; margin: 12px auto; }
  .hero { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; background: #11141c; }
  .body { padding: 14px 16px 4px; }
  .badges { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; min-height: 0; }
  .badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px;
    border-radius: 999px; font-size: 11px; font-weight: 600; letter-spacing: 0.01em; }
  .badge--popular { background: var(--pop-bg); color: var(--pop-fg); }
  .badge--urgent { background: var(--urg-bg); color: var(--urg-fg); }
  .title { font-size: 17px; font-weight: 600; line-height: 1.25; margin: 0 0 6px; }
  .meta { color: var(--muted); font-size: 12px; margin: 0 0 10px;
    display: flex; gap: 10px; flex-wrap: wrap; }
  .meta span { white-space: nowrap; }
  .desc { color: var(--fg); opacity: 0.85; margin: 0 0 12px;
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
  .tag { background: var(--chip-bg); color: var(--chip-fg); font-size: 11px;
    padding: 3px 8px; border-radius: 6px; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 10px 16px 14px; border-top: 1px solid var(--line); }
  .price { font-size: 18px; font-weight: 700; }
  .price small { font-size: 11px; font-weight: 500; color: var(--muted); margin-left: 4px; }
  .cta { background: var(--accent); color: var(--accent-fg); border: 0; padding: 10px 16px;
    border-radius: 10px; font: inherit; font-weight: 600; cursor: pointer; text-decoration: none;
    display: inline-block; }
  .cta:hover { opacity: 0.92; }
  .footer { padding: 8px 16px 14px; font-size: 11px; color: var(--muted); text-align: right; }
  .empty { padding: 28px 16px; color: var(--muted); text-align: center; }
</style>
</head>
<body>
<div id="root">
  <div class="card"><div class="empty">Loading experience…</div></div>
</div>
<script>
(function () {
  "use strict";

  function safeGet(obj, path) {
    var cur = obj;
    for (var i = 0; i < path.length; i++) {
      if (cur == null || typeof cur !== "object") return undefined;
      cur = cur[path[i]];
    }
    return cur;
  }

  function extractPayload(raw) {
    if (!raw || typeof raw !== "object") return null;
    var sc = safeGet(raw, ["params", "structuredContent"]);
    if (sc) return sc;
    var sc2 = safeGet(raw, ["structuredContent"]);
    if (sc2) return sc2;
    if (raw.experience) return raw;
    if (raw.product) return raw;
    if (raw.title || raw.name) return raw;
    var data = safeGet(raw, ["params", "data"]);
    if (data) return data;
    return raw;
  }

  function pickExperience(payload) {
    if (!payload) return null;
    if (payload.experience) return payload.experience;
    if (payload.product) return payload.product;
    if (payload.result && payload.result.experience) return payload.result.experience;
    if (Array.isArray(payload.results) && payload.results.length) return payload.results[0];
    if (Array.isArray(payload.experiences) && payload.experiences.length) return payload.experiences[0];
    return payload;
  }

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function num(v) {
    if (v == null) return null;
    var n = typeof v === "number" ? v : parseFloat(String(v));
    return isFinite(n) ? n : null;
  }

  function isPopular(exp) {
    if (exp.popular === true) return true;
    var rating = num(exp.review_rating || exp.reviewRating || exp.rating);
    var reviews = num(exp.review_count || exp.reviewCount || exp.reviews);
    return rating != null && reviews != null && rating >= 4.5 && reviews >= 100;
  }

  function isUrgent(exp) {
    if (exp.limited_availability === true) return true;
    if (exp.low_availability === true) return true;
    var b = exp._booking_urgency || exp.booking_urgency;
    if (b && typeof b === "object") {
      if (b.level === "high" || b.level === "limited") return true;
      if (b.message && /limited|few|left|selling fast/i.test(String(b.message))) return true;
    }
    if (typeof b === "string" && /limited|few|left|selling fast/i.test(b)) return true;
    return false;
  }

  function formatPrice(exp) {
    var rawPrice = exp.minimal_price != null
      ? exp.minimal_price
      : (exp.priceAmount != null ? exp.priceAmount : (exp.price && typeof exp.price === "object" ? exp.price.amount : exp.price));
    var p = num(rawPrice);
    if (p == null) return "";
    var ccy = exp.currency || exp.currency_code || exp.priceCurrency || (exp.price && exp.price.currency) || "USD";
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: ccy,
        maximumFractionDigits: p % 1 === 0 ? 0 : 2,
      }).format(p);
    } catch (e) {
      return ccy + " " + p;
    }
  }

  function getBookingUrl(exp) {
    var raw = exp.booking_url || exp.bookingUrl || exp.book_url || exp.url || exp.link || "";
    if (!raw) return "";
    try {
      var u = new URL(raw, "https://www.tickadoo.com");
      if (!u.searchParams.has("utm_source")) {
        var utm = window.__tickadooUtm || { utm_source: "mcp", utm_medium: "mcp-app", utm_campaign: "experience-card" };
        u.searchParams.set("utm_source", utm.utm_source);
        u.searchParams.set("utm_medium", utm.utm_medium);
        u.searchParams.set("utm_campaign", utm.utm_campaign || "experience-card");
        var callId = exp && exp._meta && exp._meta.agent_call_id;
        if (callId && typeof callId === "string") u.searchParams.set("utm_content", callId.replace(/-/g, "").slice(0, 8));
      }
      var agentCallId = safeGet(exp, ["_meta", "agent_call_id"]) || exp.agent_call_id;
      if (agentCallId && !u.searchParams.has("utm_content")) {
        u.searchParams.set("utm_content", String(agentCallId));
      }
      return u.toString();
    } catch (e) {
      return raw;
    }
  }

  function metaParts(exp) {
    var parts = [];
    if (exp.city || exp.city_name) parts.push("📍 " + escapeHtml(exp.city || exp.city_name));
    if (exp.duration_text || exp.duration) parts.push("⏱ " + escapeHtml(exp.duration_text || exp.duration));
    else if (exp.duration_minutes) parts.push("⏱ " + Math.round(exp.duration_minutes) + " min");
    var rating = num(exp.review_rating || exp.reviewRating || exp.rating);
    if (rating != null) {
      var rc = num(exp.review_count || exp.reviewCount || exp.reviews);
      parts.push("⭐ " + rating.toFixed(1) + (rc != null ? " (" + rc + ")" : ""));
    }
    return parts;
  }

  function tagList(exp) {
    var tags = exp.tags || exp.categories || [];
    if (!Array.isArray(tags)) return [];
    return tags.slice(0, 5).map(function (t) {
      if (typeof t === "string") return t;
      if (t && t.name) return t.name;
      if (t && t.label) return t.label;
      return "";
    }).filter(Boolean);
  }

  function emit(message) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(message, "*");
      }
    } catch (e) { /* swallow */ }
  }

  function onBook(url, exp) {
    emit({
      jsonrpc: "2.0",
      method: "notifications/ui/event",
      params: {
        type: "book_click",
        resource: "experience-card",
        booking_url: url,
        experience_id: exp && (exp.id || exp.product_id || exp.slug) || null,
      },
    });
  }

  var rendered = false;
  function render(exp) {
    var root = document.getElementById("root");
    if (!exp || (typeof exp === "object" && !exp.title && !exp.name)) {
      root.innerHTML = '<div class="card"><div class="empty">No experience to display.</div></div>';
      rendered = true;
      return;
    }
    var title = exp.title || exp.name || "Untitled";
    var desc = exp.short_description || exp.description || exp.summary || "";
    var img = exp.hero_image || exp.image || exp.image_url || exp.imageUrl || exp.thumbnail || "";
    var price = formatPrice(exp);
    var url = getBookingUrl(exp);
    var meta = metaParts(exp);
    var tags = tagList(exp);
    var pop = isPopular(exp);
    var urg = isUrgent(exp);

    var html = '<div class="card">';
    if (img) {
      html += '<img class="hero" alt="" loading="lazy" src="' + escapeHtml(img) + '">';
    }
    html += '<div class="body">';
    if (pop || urg) {
      html += '<div class="badges">';
      if (pop) html += '<span class="badge badge--popular">★ Popular</span>';
      if (urg) html += '<span class="badge badge--urgent">⏳ Limited availability</span>';
      html += '</div>';
    }
    html += '<h1 class="title">' + escapeHtml(title) + '</h1>';
    if (meta.length) html += '<p class="meta">' + meta.map(function (m) { return '<span>' + m + '</span>'; }).join(" · ") + '</p>';
    if (desc) html += '<p class="desc">' + escapeHtml(desc) + '</p>';
    if (tags.length) {
      html += '<div class="tags">' + tags.map(function (t) { return '<span class="tag">' + escapeHtml(t) + '</span>'; }).join("") + '</div>';
    }
    html += '</div>';
    html += '<div class="row">';
    html += '<div class="price">' + (price || "—") + (price ? '<small>from</small>' : "") + '</div>';
    if (url) {
      html += '<a class="cta" href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer" id="bookBtn">Book now</a>';
    }
    html += '</div>';
    html += '<div class="footer">Powered by tickadoo®</div>';
    html += '</div>';

    root.innerHTML = html;

    var btn = document.getElementById("bookBtn");
    if (btn && url) {
      btn.addEventListener("click", function () { onBook(url, exp); });
    }
    rendered = true;
  }

  function handleMessage(event) {
    var raw = event && event.data;
    if (raw == null) return;
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch (e) { return; }
    }
    var payload = extractPayload(raw);
    var exp = pickExperience(payload);
    if (exp && typeof exp === "object") render(exp);
  }

  window.addEventListener("message", handleMessage, false);

  (function tryBootstrap() {
    var el = document.getElementById("bootstrap");
    if (!el) return;
    try {
      var bootData = JSON.parse(el.textContent || "{}");
      if (bootData._meta && bootData._meta.utm_source) {
        window.__tickadooUtm = bootData._meta;
      }
      var payload = extractPayload({ params: { structuredContent: bootData } });
      var item = typeof pickExperience === "function"
        ? pickExperience(payload)
        : (typeof pickList === "function" ? pickList(payload) : payload);
      if (item) {
        if (typeof renderList === "function") renderList(item);
        else if (typeof render === "function") render(item);
        rendered = true;
      }
    } catch (e) { /* fall through to postMessage path */ }
  })();

  function sendInitialize() {
    emit({
      jsonrpc: "2.0",
      method: "initialize",
      params: { resource: "experience-card", protocolVersion: "2025-06-18" },
    });
  }

  if (!rendered) sendInitialize();
  var _retry = setInterval(function () { if (rendered) { clearInterval(_retry); return; } sendInitialize(); }, 1500);
  setTimeout(function () { clearInterval(_retry); }, 15000);
})();
</script>
</body>
</html>`;

export const EXPERIENCE_MAP_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>tickadoo nearby map</title>
<link rel="stylesheet"
  href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
  integrity="sha512-h9FcoyWjHcOcmEVkxOfTLnmZFWIH0iZhZT1H2TbOq55xssQGEJHEaIm+PgoUaZbRvQTNTluNOEfb1ZRy6D3BOw=="
  crossorigin="anonymous"
  referrerpolicy="no-referrer">
<style>
  :root {
    --bg: #ffffff;
    --fg: #0f1115;
    --muted: #5a6172;
    --line: #e6e8ee;
    --panel: #ffffff;
    --pin-bg: #0f1115;
    --pin-fg: #ffffff;
    --pin-pop-bg: #c69b3d;
    --pin-pop-fg: #1a1305;
    --accent: #0f1115;
    --accent-fg: #ffffff;
    --tile: "light";
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0d1016;
      --fg: #ecedf1;
      --muted: #98a0b3;
      --line: #1f2330;
      --panel: #141823;
      --pin-bg: #ecedf1;
      --pin-fg: #0d1016;
      --pin-pop-bg: #d6ad55;
      --pin-pop-fg: #1a1305;
      --accent: #ecedf1;
      --accent-fg: #0d1016;
      --tile: "dark";
    }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: 100%; background: var(--bg); color: var(--fg);
    font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
  #wrap { position: relative; width: 100%; height: 100vh; min-height: 360px; }
  #map { position: absolute; inset: 0; }
  .pin { display: inline-flex; align-items: center; justify-content: center;
    background: var(--pin-bg); color: var(--pin-fg); font-weight: 700; font-size: 11px;
    padding: 4px 8px; border-radius: 14px; white-space: nowrap;
    box-shadow: 0 1px 4px rgba(0,0,0,0.25); border: 1.5px solid var(--bg); }
  .pin--popular { background: var(--pin-pop-bg); color: var(--pin-pop-fg); }
  .panel { position: absolute; left: 12px; right: 12px; bottom: 12px; z-index: 600;
    background: var(--panel); border: 1px solid var(--line); border-radius: 14px;
    padding: 12px 14px; box-shadow: 0 4px 24px rgba(0,0,0,0.18);
    transform: translateY(120%); transition: transform 220ms ease; }
  .panel.open { transform: translateY(0); }
  .panel .ttl { font-weight: 600; margin: 0 0 4px; font-size: 15px; }
  .panel .meta { color: var(--muted); font-size: 12px; margin: 0 0 8px;
    display: flex; gap: 10px; flex-wrap: wrap; }
  .panel .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .panel .price { font-size: 17px; font-weight: 700; }
  .panel .cta { background: var(--accent); color: var(--accent-fg); border: 0; padding: 9px 14px;
    border-radius: 10px; font: inherit; font-weight: 600; cursor: pointer; text-decoration: none;
    display: inline-block; }
  .panel .close { position: absolute; top: 6px; right: 8px; background: transparent; border: 0;
    color: var(--muted); font-size: 18px; line-height: 1; cursor: pointer; padding: 4px 6px; }
  .empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    color: var(--muted); padding: 24px; text-align: center; z-index: 500; }
  .footer { position: absolute; right: 8px; bottom: 6px; z-index: 700;
    background: rgba(255,255,255,0.7); padding: 2px 6px; border-radius: 6px;
    font-size: 10px; color: #333; }
  @media (prefers-color-scheme: dark) {
    .footer { background: rgba(20,24,35,0.7); color: #ccc; }
  }
</style>
</head>
<body>
<div id="wrap">
  <div id="map"></div>
  <div id="empty" class="empty" style="display:none;">No mappable experiences yet.</div>
  <div id="panel" class="panel" role="dialog" aria-hidden="true">
    <button id="panelClose" class="close" aria-label="Close">×</button>
    <h2 id="pnlTitle" class="ttl"></h2>
    <p id="pnlMeta" class="meta"></p>
    <div class="row">
      <div id="pnlPrice" class="price"></div>
      <a id="pnlCta" class="cta" href="#" target="_blank" rel="noopener noreferrer">Book now</a>
    </div>
  </div>
  <div class="footer">Powered by tickadoo®</div>
</div>
<script
  src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"
  integrity="sha512-puJW3E/qXDqYp9IfhAI54BJEaWIfloJ7JWs7OeD5i6ruC9JZL1gERT1wjtwXFlh7CjE7ZJ+/vcRZRkIYIb6p4g=="
  crossorigin="anonymous"
  referrerpolicy="no-referrer"></script>
<script>
(function () {
  "use strict";

  var map = null;
  var markers = [];

  function safeGet(obj, path) {
    var cur = obj;
    for (var i = 0; i < path.length; i++) {
      if (cur == null || typeof cur !== "object") return undefined;
      cur = cur[path[i]];
    }
    return cur;
  }

  function extractPayload(raw) {
    if (!raw || typeof raw !== "object") return null;
    var sc = safeGet(raw, ["params", "structuredContent"]);
    if (sc) return sc;
    var sc2 = safeGet(raw, ["structuredContent"]);
    if (sc2) return sc2;
    if (Array.isArray(raw.results)) return raw;
    if (Array.isArray(raw.experiences)) return raw;
    if (Array.isArray(raw)) return { results: raw };
    var data = safeGet(raw, ["params", "data"]);
    if (data) return data;
    return raw;
  }

  function pickList(payload) {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.results)) return payload.results;
    if (Array.isArray(payload.experiences)) return payload.experiences;
    if (Array.isArray(payload.products)) return payload.products;
    if (Array.isArray(payload.items)) return payload.items;
    return [];
  }

  function num(v) {
    if (v == null) return null;
    var n = typeof v === "number" ? v : parseFloat(String(v));
    return isFinite(n) ? n : null;
  }

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function isPopular(exp) {
    if (exp.popular === true) return true;
    var rating = num(exp.review_rating || exp.reviewRating || exp.rating);
    var reviews = num(exp.review_count || exp.reviewCount || exp.reviews);
    return rating != null && reviews != null && rating >= 4.5 && reviews >= 100;
  }

  function getCoords(exp) {
    var lat = num(exp.latitude != null ? exp.latitude : (exp.lat != null ? exp.lat : safeGet(exp, ["location", "latitude"])));
    var lng = num(exp.longitude != null ? exp.longitude : (exp.lng != null ? exp.lng : (exp.lon != null ? exp.lon : safeGet(exp, ["location", "longitude"]))));
    if (lat == null || lng == null) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return [lat, lng];
  }

  function priceShort(exp) {
    var rawPrice = exp.minimal_price != null
      ? exp.minimal_price
      : (exp.priceAmount != null ? exp.priceAmount : (exp.price && typeof exp.price === "object" ? exp.price.amount : exp.price));
    var p = num(rawPrice);
    if (p == null) return "";
    var ccy = exp.currency || exp.currency_code || exp.priceCurrency || (exp.price && exp.price.currency) || "USD";
    var sym = ccy === "USD" ? "$" : (ccy === "EUR" ? "€" : (ccy === "GBP" ? "£" : ""));
    var rounded = Math.round(p);
    return sym ? sym + rounded : ccy + " " + rounded;
  }

  function priceLong(exp) {
    var rawPrice = exp.minimal_price != null
      ? exp.minimal_price
      : (exp.priceAmount != null ? exp.priceAmount : (exp.price && typeof exp.price === "object" ? exp.price.amount : exp.price));
    var p = num(rawPrice);
    if (p == null) return "";
    var ccy = exp.currency || exp.currency_code || exp.priceCurrency || (exp.price && exp.price.currency) || "USD";
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency", currency: ccy,
        maximumFractionDigits: p % 1 === 0 ? 0 : 2,
      }).format(p);
    } catch (e) {
      return ccy + " " + p;
    }
  }

  function getBookingUrl(exp) {
    var raw = exp.booking_url || exp.bookingUrl || exp.book_url || exp.url || exp.link || "";
    if (!raw) return "";
    try {
      var u = new URL(raw, "https://www.tickadoo.com");
      if (!u.searchParams.has("utm_source")) {
        var utm = window.__tickadooUtm || { utm_source: "mcp", utm_medium: "mcp-app", utm_campaign: "experience-map" };
        u.searchParams.set("utm_source", utm.utm_source);
        u.searchParams.set("utm_medium", utm.utm_medium);
        u.searchParams.set("utm_campaign", utm.utm_campaign || "experience-map");
        var callId = exp && exp._meta && exp._meta.agent_call_id;
        if (callId && typeof callId === "string") u.searchParams.set("utm_content", callId.replace(/-/g, "").slice(0, 8));
      }
      var agentCallId = safeGet(exp, ["_meta", "agent_call_id"]) || exp.agent_call_id;
      if (agentCallId && !u.searchParams.has("utm_content")) {
        u.searchParams.set("utm_content", String(agentCallId));
      }
      return u.toString();
    } catch (e) {
      return raw;
    }
  }

  function panelMeta(exp) {
    var parts = [];
    var rating = num(exp.review_rating || exp.reviewRating || exp.rating);
    if (rating != null) {
      var rc = num(exp.review_count || exp.reviewCount || exp.reviews);
      parts.push("⭐ " + rating.toFixed(1) + (rc != null ? " (" + rc + ")" : ""));
    }
    if (exp.distance_text) parts.push("📍 " + escapeHtml(exp.distance_text));
    else if (exp.distance_km != null) parts.push("📍 " + Number(exp.distance_km).toFixed(1) + " km");
    if (exp.duration_text || exp.duration) parts.push("⏱ " + escapeHtml(exp.duration_text || exp.duration));
    return parts.join(" · ");
  }

  function emit(message) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(message, "*");
      }
    } catch (e) { /* swallow */ }
  }

  function onBook(url, exp) {
    emit({
      jsonrpc: "2.0",
      method: "notifications/ui/event",
      params: {
        type: "book_click",
        resource: "experience-map",
        booking_url: url,
        experience_id: exp && (exp.id || exp.product_id || exp.slug) || null,
      },
    });
  }

  function showPanel(exp) {
    var p = document.getElementById("panel");
    document.getElementById("pnlTitle").textContent = exp.title || exp.name || "Experience";
    document.getElementById("pnlMeta").innerHTML = panelMeta(exp);
    document.getElementById("pnlPrice").textContent = priceLong(exp);
    var cta = document.getElementById("pnlCta");
    var url = getBookingUrl(exp);
    if (url) {
      cta.style.display = "inline-block";
      cta.setAttribute("href", url);
      cta.onclick = function () { onBook(url, exp); };
    } else {
      cta.style.display = "none";
    }
    p.classList.add("open");
    p.setAttribute("aria-hidden", "false");
  }

  function hidePanel() {
    var p = document.getElementById("panel");
    p.classList.remove("open");
    p.setAttribute("aria-hidden", "true");
  }

  function ensureMap() {
    if (map) return map;
    if (typeof L === "undefined") return null;
    map = L.map("map", { zoomControl: true, attributionControl: false }).setView([51.5, -0.12], 12);
    var dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var url = dark
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
    L.tileLayer(url, { maxZoom: 19, subdomains: "abcd" }).addTo(map);
    return map;
  }

  var rendered = false;
  function renderList(list) {
    var m = ensureMap();
    if (!m) return;

    markers.forEach(function (mk) { try { m.removeLayer(mk); } catch (e) {} });
    markers = [];
    hidePanel();

    var withCoords = list
      .map(function (e) { return { exp: e, coords: getCoords(e || {}) }; })
      .filter(function (x) { return x.coords; });

    var emptyEl = document.getElementById("empty");
    if (!withCoords.length) {
      emptyEl.style.display = "flex";
      rendered = true;
      return;
    }
    emptyEl.style.display = "none";

    var bounds = L.latLngBounds([]);
    withCoords.forEach(function (item) {
      var exp = item.exp;
      var coords = item.coords;
      var pop = isPopular(exp);
      var label = priceShort(exp) || (exp.title ? "•" : "•");
      var icon = L.divIcon({
        className: "",
        html: '<div class="pin' + (pop ? ' pin--popular' : '') + '">' + escapeHtml(label) + '</div>',
        iconSize: null,
        iconAnchor: [20, 12],
      });
      var marker = L.marker(coords, { icon: icon }).addTo(m);
      marker.on("click", function () { showPanel(exp); });
      markers.push(marker);
      bounds.extend(coords);
    });
    if (markers.length === 1) {
      m.setView(markers[0].getLatLng(), 14);
    } else {
      m.fitBounds(bounds.pad(0.15));
    }
    rendered = true;
  }

  function handleMessage(event) {
    var raw = event && event.data;
    if (raw == null) return;
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch (e) { return; }
    }
    var payload = extractPayload(raw);
    var list = pickList(payload);
    renderList(list);
  }

  document.addEventListener("DOMContentLoaded", function () {
    ensureMap();
    var btn = document.getElementById("panelClose");
    if (btn) btn.addEventListener("click", hidePanel);
  });

  window.addEventListener("message", handleMessage, false);

  (function tryBootstrap() {
    var el = document.getElementById("bootstrap");
    if (!el) return;
    try {
      var bootData = JSON.parse(el.textContent || "{}");
      if (bootData._meta && bootData._meta.utm_source) {
        window.__tickadooUtm = bootData._meta;
      }
      var payload = extractPayload({ params: { structuredContent: bootData } });
      var item = typeof pickExperience === "function"
        ? pickExperience(payload)
        : (typeof pickList === "function" ? pickList(payload) : payload);
      if (item) {
        if (typeof renderList === "function") renderList(item);
        else if (typeof render === "function") render(item);
        rendered = true;
      }
    } catch (e) { /* fall through to postMessage path */ }
  })();

  function sendInitialize() {
    emit({
      jsonrpc: "2.0",
      method: "initialize",
      params: { resource: "experience-map", protocolVersion: "2025-06-18" },
    });
  }

  if (!rendered) sendInitialize();
  var _retry = setInterval(function () { if (rendered) { clearInterval(_retry); return; } sendInitialize(); }, 1500);
  setTimeout(function () { clearInterval(_retry); }, 15000);
})();
</script>
</body>
</html>`;

export const EXPERIENCE_TRIO_HTML = String.raw`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>tickadoo related experiences</title>
<style>
:root { --bg:#fff; --fg:#0f1115; --muted:#5a6172; --line:#e6e8ee; --card:#fff; --gold:#c69b3d; --accent:#0f1115; --accent-fg:#fff; --chip-bg:#f3f4f8; --chip-fg:#2a2f3a; }
@media (prefers-color-scheme: dark) {
  :root { --bg:#0d1016; --fg:#ecedf1; --muted:#98a0b3; --line:#1f2330; --card:#141823; --gold:#d6ad55; --accent:#ecedf1; --accent-fg:#0d1016; --chip-bg:#1d2230; --chip-fg:#d8dbe4; }
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--bg); color: var(--fg);
  font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
.wrap { padding: 12px; }
.tagline { font-size: 12px; color: var(--muted); margin: 0 0 10px; }
.trio { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
@media (max-width: 600px) { .trio { grid-template-columns: 1fr; } }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; display: flex; flex-direction: column; }
.card img { width: 100%; aspect-ratio: 4/3; object-fit: cover; background: #11141c; }
.body { padding: 10px; flex: 1; }
.title { font-size: 13px; font-weight: 600; margin: 0 0 4px; line-height: 1.25; }
.meta { font-size: 11px; color: var(--muted); margin: 0 0 6px; }
.row { display: flex; align-items: center; justify-content: space-between; padding: 0 10px 10px; gap: 8px; }
.price { font-weight: 700; font-size: 14px; }
.cta { background: var(--accent); color: var(--accent-fg); padding: 5px 10px; border-radius: 6px; font-weight: 600; text-decoration: none; font-size: 11px; }
.footer { text-align: right; padding: 6px 10px; font-size: 10px; color: var(--muted); }
.empty { padding: 20px; text-align: center; color: var(--muted); }
</style></head>
<body>
<div class="wrap">
  <p id="tagline" class="tagline">Related experiences</p>
  <div id="trio" class="trio"><div class="empty">Loading related experiences...</div></div>
  <div class="footer">Powered by tickadoo®</div>
</div>
<script>
(function () {
  function emit(msg){ if (window.parent !== window) window.parent.postMessage(msg, '*'); }
  function safeGet(obj, path){ try { return path.split('.').reduce(function(o,k){ return o ? o[k] : undefined; }, obj); } catch(e){ return undefined; } }
  function extractPayload(raw){ if (!raw) return {}; var sc = safeGet(raw, 'params.structuredContent') || safeGet(raw, 'structuredContent') || raw; return sc || {}; }
  function num(v){ if (v == null) return null; var n = +v; return isNaN(n) ? null : n; }
  function escapeHtml(s){ return String(s == null ? '' : s).replace(/[&<>\"]/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[c]; }); }
  function formatPrice(exp){ var p = num(exp.price); if (p == null) return ''; var cur = exp.currency || 'GBP'; try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(p); } catch(e){ return cur + ' ' + p; } }
  function getBookingUrl(exp){
    var raw = exp.booking_url || exp.book_url || exp.url || exp.link || '';
    if (!raw) return '';
    try {
      var u = new URL(raw, 'https://www.tickadoo.com');
      if (!u.searchParams.has('utm_source')) {
        var utm = window.__tickadooUtm || { utm_source: 'mcp', utm_medium: 'mcp-app', utm_campaign: 'experience-trio' };
        u.searchParams.set('utm_source', utm.utm_source);
        u.searchParams.set('utm_medium', utm.utm_medium);
        u.searchParams.set('utm_campaign', utm.utm_campaign || 'experience-trio');
        var callId = exp && exp._meta && exp._meta.agent_call_id;
        if (callId && typeof callId === 'string') u.searchParams.set('utm_content', callId.replace(/-/g,'').slice(0,8));
      }
      return u.toString();
    } catch(e) { return raw; }
  }

  var rendered = false;
  function render(payload) {
    var root = document.getElementById('trio');
    var tagline = document.getElementById('tagline');
    var list = (payload && payload.results) || [];
    if (!list.length) {
      root.innerHTML = '<div class="empty">No related experiences yet.</div>';
      rendered = true;
      return;
    }
    var ctx = (payload && payload.context) || 'pair';
    var taglineMap = { pair: 'Pairs well with this', after: 'After you enjoy this', nearby: 'Nearby experiences', similar: 'Similar experiences' };
    tagline.textContent = taglineMap[ctx] || 'Related experiences';
    root.innerHTML = list.slice(0, 3).map(function (exp) {
      var img = exp.image_url || exp.hero_image || '';
      var url = getBookingUrl(exp);
      var rating = num(exp.rating);
      return '<div class="card">' +
        (img ? '<img alt="" loading="lazy" src="' + escapeHtml(img) + '">' : '') +
        '<div class="body">' +
          '<h3 class="title">' + escapeHtml(exp.title || '') + '</h3>' +
          '<p class="meta">' + (rating != null ? '\u2b50 ' + rating.toFixed(1) : '') + '</p>' +
        '</div>' +
        '<div class="row">' +
          '<span class="price">' + formatPrice(exp) + '</span>' +
          (url ? '<a class="cta" href="' + escapeHtml(url) + '" target="_blank" rel="noopener">Book</a>' : '') +
        '</div>' +
      '</div>';
    }).join('');
    rendered = true;
  }

  function handleMessage(event) {
    var raw = event.data;
    if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch (e) { return; } }
    var payload = extractPayload(raw);
    render(payload || {});
  }
  window.addEventListener('message', handleMessage, false);

  (function tryBootstrap() {
    var el = document.getElementById('bootstrap');
    if (!el) return;
    try {
      var bootData = JSON.parse(el.textContent || '{}');
      if (bootData._meta && bootData._meta.utm_source) {
        window.__tickadooUtm = bootData._meta;
      }
      var payload = extractPayload({ params: { structuredContent: bootData } });
      var item = typeof pickExperience === 'function'
        ? pickExperience(payload)
        : (typeof pickList === 'function' ? pickList(payload) : payload);
      if (item) {
        if (typeof renderList === 'function') renderList(item);
        else if (typeof render === 'function') render(item);
        rendered = true;
      }
    } catch (e) { /* fall through to postMessage path */ }
  })();

  function sendInitialize() {
    emit({ jsonrpc: '2.0', method: 'initialize', params: { resource: 'experience-trio', protocolVersion: '2025-06-18' } });
  }
  if (!rendered) sendInitialize();
  var _retry = setInterval(function () { if (rendered) { clearInterval(_retry); return; } sendInitialize(); }, 1500);
  setTimeout(function () { clearInterval(_retry); }, 15000);
})();
</script>
</body></html>`;

const UI_RESOURCES: readonly UiResourceSpec[] = [
  {
    name: "experience-card",
    uri: EXPERIENCE_CARD_URI,
    description:
      "Inline booking card for a single tickadoo experience. Rendered by MCP Apps-capable clients when get_experience_details returns.",
    html: EXPERIENCE_CARD_HTML,
    resourceMeta: {
      ui: {
        // Card already has its own rounded-border styling; suppress host chrome.
        prefersBorder: false,
      },
    },
  },
  {
    name: "experience-map",
    uri: EXPERIENCE_MAP_URI,
    description:
      "Interactive map with price-pin markers for a list of nearby tickadoo experiences. Rendered by MCP Apps-capable clients when find_nearby_experiences returns.",
    html: EXPERIENCE_MAP_HTML,
    resourceMeta: {
      ui: {
        prefersBorder: true,
        // Map iframe fetches Leaflet from cdnjs and basemap tiles from CARTO.
        // Hosts with strict CSP (Claude, ChatGPT) block anything not listed here.
        csp: {
          resourceDomains: [
            "https://cdnjs.cloudflare.com",
            "https://a.basemaps.cartocdn.com",
            "https://b.basemaps.cartocdn.com",
            "https://c.basemaps.cartocdn.com",
            "https://d.basemaps.cartocdn.com",
          ],
          connectDomains: [],
        },
      },
    },
  },
  {
    name: "experience-trio",
    uri: EXPERIENCE_TRIO_URI,
    description: "Three related experiences in a row. Rendered when get_related_experiences returns.",
    html: EXPERIENCE_TRIO_HTML,
    resourceMeta: {
      ui: {
        prefersBorder: false,
      },
    },
  },
];

/**
 * Register both tickadoo UI resources on the given MCP server. Safe to call
 * once per server instance (call site is `createTickadooServer` just before
 * `return server;`).
 */
export function registerTickadooUiResources(server: McpServer): void {
  for (const resource of UI_RESOURCES) {
    server.resource(
      resource.name,
      resource.uri,
      {
        description: resource.description,
        mimeType: MCP_APP_MIME_TYPE,
      },
      async () => ({
        contents: [
          {
            uri: resource.uri,
            text: resource.html,
            mimeType: MCP_APP_MIME_TYPE,
            ...(resource.resourceMeta ? { _meta: resource.resourceMeta } : {}),
          },
        ],
      }),
    );
  }
}

/** Exposed for tests. */
export const TICKADOO_UI_RESOURCES: readonly UiResourceSpec[] = UI_RESOURCES;
