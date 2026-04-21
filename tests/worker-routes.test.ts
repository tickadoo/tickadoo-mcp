import { describe, expect, it } from "vitest";
import app from "../src/worker.js";

const ADMIN_TOKEN = "test-admin-token-123456";

function env(overrides: Record<string, unknown> = {}) {
  return { ADMIN_TOKEN, ...overrides };
}

describe("worker routes", () => {
  describe("public routes", () => {
    it("GET /health returns 200 with status ok", async () => {
      const res = await app.request("/health", {}, env());
      expect(res.status).toBe(200);
      const body = (await res.json()) as { status: string };
      expect(body.status).toBe("ok");
    });

    it("GET /robots.txt exposes the AI-bot allowlist", async () => {
      const res = await app.request("/robots.txt", {}, env());
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("User-agent: GPTBot");
      expect(body).toContain("User-agent: ClaudeBot");
      expect(body).toContain("Disallow: /mcp");
    });

    it("GET /sitemap.xml lists the indexable HTML pages", async () => {
      const res = await app.request("/sitemap.xml", {}, env());
      expect(res.status).toBe(200);
      const body = await res.text();
      expect(body).toContain("<loc>https://mcp.tickadoo.com/agentx</loc>");
    });

    it("GET /agentx ships a Content-Security-Policy header", async () => {
      const res = await app.request("/agentx", {}, env());
      expect(res.status).toBe(200);
      expect(res.headers.get("content-security-policy")).toMatch(/default-src 'none'/);
    });

    it("GET /.well-known/mcp.json returns manifest JSON", async () => {
      const res = await app.request("/.well-known/mcp.json", {}, env());
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type") ?? "").toContain("application/json");
    });
  });

  describe("/admin/* auth", () => {
    it("returns 503 when ADMIN_TOKEN is not configured", async () => {
      const res = await app.request("/admin/telemetry", {}, {});
      expect(res.status).toBe(503);
    });

    it("returns 401 with WWW-Authenticate when token is missing", async () => {
      const res = await app.request("/admin/telemetry", {}, env());
      expect(res.status).toBe(401);
      expect(res.headers.get("www-authenticate") ?? "").toContain("Bearer");
    });

    it("returns 401 when token is wrong", async () => {
      const res = await app.request(
        "/admin/telemetry",
        { headers: { Authorization: "Bearer wrong-token" } },
        env(),
      );
      expect(res.status).toBe(401);
    });

    it("returns 401 when token length differs (constant-time guard)", async () => {
      const res = await app.request(
        "/admin/telemetry",
        { headers: { Authorization: "Bearer x" } },
        env(),
      );
      expect(res.status).toBe(401);
    });

    it("serves the dashboard HTML with CSP when token is valid", async () => {
      const res = await app.request(
        "/admin/telemetry",
        { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } },
        env(),
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type") ?? "").toContain("text/html");
      expect(res.headers.get("content-security-policy")).toMatch(/default-src 'none'/);
      const body = await res.text();
      expect(body).toContain("tickadoo agent telemetry");
    });

    it("returns 500 for telemetry.json when NEON_URL is absent (auth passed)", async () => {
      const res = await app.request(
        "/admin/telemetry.json",
        { headers: { Authorization: `Bearer ${ADMIN_TOKEN}` } },
        env(),
      );
      expect(res.status).toBe(500);
    });
  });

  describe("/mcp transport", () => {
    it("OPTIONS returns 204 with CORS headers", async () => {
      const res = await app.request(
        "/mcp",
        { method: "OPTIONS" },
        env(),
      );
      expect(res.status).toBe(204);
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
    });

    it("GET /mcp without SSE accept falls back to health JSON", async () => {
      const res = await app.request("/mcp", {}, env());
      expect(res.status).toBe(200);
      const body = (await res.json()) as { status: string };
      expect(body.status).toBe("ok");
    });
  });

  describe("unknown routes", () => {
    it("returns 404 for unmatched paths", async () => {
      const res = await app.request("/definitely-not-a-route", {}, env());
      expect(res.status).toBe(404);
    });
  });
});
