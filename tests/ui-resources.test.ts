import { describe, it, expect } from "vitest";
import {
  EXPERIENCE_CARD_URI,
  EXPERIENCE_MAP_URI,
  EXPERIENCE_TRIO_URI,
  MCP_APP_MIME_TYPE,
  TICKADOO_UI_RESOURCES,
  uiMeta,
} from "../src/shared/ui-resources.js";

describe("ui-resources", () => {
  it("exports the two expected URIs", () => {
    expect(EXPERIENCE_CARD_URI).toBe("ui://tickadoo/experience-card.html");
    expect(EXPERIENCE_MAP_URI).toBe("ui://tickadoo/experience-map.html");
  });

  it("uses the MCP Apps standard mime type", () => {
    expect(MCP_APP_MIME_TYPE).toBe("text/html;profile=mcp-app");
  });

  it("exposes both resources via TICKADOO_UI_RESOURCES", () => {
    expect(TICKADOO_UI_RESOURCES).toHaveLength(3);
    const byName = Object.fromEntries(
      TICKADOO_UI_RESOURCES.map(r => [r.name, r]),
    );
    expect(byName["experience-card"].uri).toBe(EXPERIENCE_CARD_URI);
    expect(byName["experience-map"].uri).toBe(EXPERIENCE_MAP_URI);
    expect(byName["experience-trio"].uri).toBe(EXPERIENCE_TRIO_URI);
  });

  it("uiMeta produces both ui.resourceUri and openai/outputTemplate keys", () => {
    const meta = uiMeta(EXPERIENCE_CARD_URI);
    expect(meta.ui.resourceUri).toBe(EXPERIENCE_CARD_URI);
    expect(meta["openai/outputTemplate"]).toBe(EXPERIENCE_CARD_URI);
    expect(meta["openai/toolInvocation/invoking"]).toBeUndefined();
    expect(meta["openai/toolInvocation/invoked"]).toBeUndefined();
  });

  it("uiMeta supports optional ChatGPT invocation hints", () => {
    const meta = uiMeta(EXPERIENCE_MAP_URI, {
      invoking: "Searching…",
      invoked: "Done",
    });
    expect(meta["openai/toolInvocation/invoking"]).toBe("Searching…");
    expect(meta["openai/toolInvocation/invoked"]).toBe("Done");
  });

  it("experience-card HTML carries the required markers and UTM attribution", () => {
    const card = TICKADOO_UI_RESOURCES.find(r => r.name === "experience-card");
    expect(card).toBeDefined();
    expect(card!.html).toContain("badge--popular");
    expect(card!.html).toContain("tickadoo\u00ae");
    expect(card!.html).toContain("utm_source");
    expect(card!.html).toContain("experience-card");
  });

  it("experience-map HTML carries the required markers and UTM attribution", () => {
    const map = TICKADOO_UI_RESOURCES.find(r => r.name === "experience-map");
    expect(map).toBeDefined();
    expect(map!.html).toContain("cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4");
    expect(map!.html).toContain("pin--popular");
    expect(map!.html).toContain("tickadoo\u00ae");
    expect(map!.html).toContain("utm_source");
    expect(map!.html).toContain("experience-map");
  });

  it("experience-map resource declares CSP allowlist for cdnjs and CARTO", () => {
    const map = TICKADOO_UI_RESOURCES.find(r => r.name === "experience-map");
    const ui = (map!.resourceMeta as { ui?: { csp?: { resourceDomains?: string[] } } } | undefined)?.ui;
    expect(ui?.csp?.resourceDomains).toContain("https://cdnjs.cloudflare.com");
    expect(ui?.csp?.resourceDomains?.some(d => d.includes("basemaps.cartocdn.com"))).toBe(true);
  });

  it("each resource declares an html doctype and a description", () => {
    for (const r of TICKADOO_UI_RESOURCES) {
      expect(typeof r.description).toBe("string");
      expect(r.description.length).toBeGreaterThan(0);
      expect(r.html.startsWith("<!doctype html>")).toBe(true);
    }
  });
});
