import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCitiesMock,
} = vi.hoisted(() => ({
  getCitiesMock: vi.fn(),
}));

vi.mock("../src/shared/api.js", () => ({
  buildBookingUrl: (path: string, language = "en") => `https://www.tickadoo.com/${language}/${path}?utm_source=mcp&utm_medium=ai&utm_campaign=tickadoo-mcp`,
  geocodeCityQuery: vi.fn(async () => null),
  getCities: getCitiesMock,
  getExperienceDetails: vi.fn(),
  getMcpEnrichedProducts: vi.fn(async () => new Map()),
  getNearestCoveredCities: vi.fn(async () => []),
  getProductsByLocation: vi.fn(async () => []),
  getProductsForCitySlug: vi.fn(async () => []),
  resolveProductBySlug: vi.fn(),
  heuristicEnrich: vi.fn(product => product),
  normalizeSlugOrPath: (value: string) => value.trim().replace(/^\/+|\/+$/g, ""),
}));

import { buildLlmsFullTxt, buildLlmsTxt } from "../src/shared/llms.js";
import { createTickadooServer } from "../src/shared/server.js";

function firstTextContent(result: { content?: Array<{ type?: string; text?: string }> }): string {
  return result.content?.find(item => item.type === "text")?.text ?? "";
}

describe("get_travel_tips tool", () => {
  beforeEach(() => {
    getCitiesMock.mockReset();
    getCitiesMock.mockResolvedValue([
      {
        id: "city-id-1",
        name: "Tokyo",
        slug: "tokyo",
        location: null,
      },
      {
        id: "city-id-2",
        name: "Paris",
        slug: "paris",
        location: null,
      },
    ]);
  });

  it("registers the expected schema and returns structured local tips", async () => {
    const server = createTickadooServer() as any;
    const tool = server._registeredTools.get_travel_tips;
    const schema = tool.inputSchema.shape;

    expect(tool).toBeTruthy();
    expect(schema.city._def.typeName).toBe("ZodString");
    expect(schema.topic._def.innerType._def.values).toEqual([
      "transport",
      "money",
      "safety",
      "culture",
      "food",
      "weather",
      "language",
      "connectivity",
    ]);
    expect(schema.format._def.innerType._def.innerType._def.values).toEqual(["text", "json"]);

    const result = await tool.handler({
      city: "tokyo",
      topic: "food",
      format: "json",
    });

    expect(result.isError).not.toBe(true);
    const json = JSON.parse(firstTextContent(result));

    expect(json.city).toBe("Tokyo");
    expect(json.tips).toEqual([
      {
        topic: "food",
        tip: expect.stringContaining("reservations"),
        importance: "helpful",
      },
    ]);
    expect(json.emergency).toEqual({
      police: "110",
      ambulance: "119",
      tourist_helpline: "+81 50 3816 2787",
    });
    expect(json.quick_phrases[0]).toEqual({
      local: "Sumimasen",
      english: "Excuse me / sorry",
    });
    expect(result.structuredContent.city).toBe("Tokyo");
  });

  it("auto-corrects close launch-city spellings via city candidates", async () => {
    const server = createTickadooServer() as any;
    const tool = server._registeredTools.get_travel_tips;

    const result = await tool.handler({
      city: "tokyoo",
      format: "json",
    });

    expect(result.isError).not.toBe(true);
    const json = JSON.parse(firstTextContent(result));
    expect(json.city).toBe("Tokyo");
    expect(json.tips).toHaveLength(8);
  });

  it("documents get_travel_tips in llms docs", () => {
    const shortDoc = buildLlmsTxt();
    const fullDoc = buildLlmsFullTxt();

    expect(shortDoc).toContain("get_travel_tips");
    expect(shortDoc).toContain("local insider advice for 20 launch cities");
    expect(fullDoc).toContain("get_travel_tips");
    expect(fullDoc).toContain("emergency numbers");
    expect(fullDoc).toContain("quick local phrases");
    expect(fullDoc).toContain("topic (optional): transport, money, safety, culture, food, weather, language, or connectivity");
  });
});
