import { describe, expect, it } from "vitest";

import { buildLlmsFullTxt, buildLlmsTxt } from "../src/shared/llms.js";
import { createTickadooServer } from "../src/shared/server.js";
import { buildTransferPayload, formatTransferInfo, resolveTransferCity } from "../src/shared/transfer.js";

function firstTextContent(result: { content?: Array<{ type?: string; text?: string }> }): string {
  return result.content?.find(item => item.type === "text")?.text ?? "";
}

describe("transfer helpers", () => {
  it("builds London airport transfer estimates from the default airport hub", () => {
    const payload = buildTransferPayload({
      city: "london",
      fromType: "airport",
      toLatitude: 51.5115,
      toLongitude: -0.124,
    });

    expect(payload.city).toBe("London");
    expect(payload.origin_name).toBe("Heathrow Airport");
    expect(payload.assumption).toContain("default airport hub");
    expect(payload.distance_km).toBeGreaterThan(20);
    expect(payload.options.map(option => option.mode)).toEqual(["taxi", "tube", "bus", "train"]);

    const taxi = payload.options.find(option => option.mode === "taxi");
    const bus = payload.options.find(option => option.mode === "bus");
    const train = payload.options.find(option => option.mode === "train");

    expect(taxi?.currency).toBe("GBP");
    expect(taxi?.estimated_cost).toBeGreaterThan(train?.estimated_cost ?? 0);
    expect(bus?.estimated_cost).toBeLessThan(taxi?.estimated_cost ?? Number.POSITIVE_INFINITY);
    expect(train?.directions_summary).toContain("Heathrow Airport");
    expect(formatTransferInfo(payload, "en")).toContain("Transfer options from Heathrow Airport");
  });

  it("resolves city aliases and uses the default station hub", () => {
    expect(resolveTransferCity("new york")?.name).toBe("New York");

    const payload = buildTransferPayload({
      city: "new york",
      fromType: "station",
      toLatitude: 40.758,
      toLongitude: -73.9855,
    });

    expect(payload.origin_name).toBe("Penn Station");
    expect(payload.distance_km).toBeLessThan(5);

    const tube = payload.options.find(option => option.mode === "tube");
    const taxi = payload.options.find(option => option.mode === "taxi");

    expect(tube?.estimated_cost).toBeLessThan(taxi?.estimated_cost ?? Number.POSITIVE_INFINITY);
  });
});

describe("get_transfer_info tool", () => {
  it("registers the expected schema and returns structured JSON payloads", async () => {
    const server = createTickadooServer() as any;
    const tool = server._registeredTools.get_transfer_info;
    const schema = tool.inputSchema.shape;

    expect(tool).toBeTruthy();
    expect(schema.from_type._def.values).toEqual(["airport", "station", "port"]);
    expect(schema.city._def.typeName).toBe("ZodString");

    const result = await tool.handler({
      city: "London",
      from_type: "airport",
      to_latitude: 51.5115,
      to_longitude: -0.124,
      format: "json",
    });

    expect(result.isError).not.toBe(true);
    const json = JSON.parse(firstTextContent(result));

    expect(json.origin_name).toBe("Heathrow Airport");
    expect(json.options).toHaveLength(4);
    expect(json.options[0].mode).toBe("taxi");
    expect(result.structuredContent.origin_name).toBe("Heathrow Airport");
  });

  it("returns helpful validation errors for unsupported cities and invalid hub types", async () => {
    const server = createTickadooServer() as any;
    const tool = server._registeredTools.get_transfer_info;

    const unsupportedCity = await tool.handler({
      city: "Berlin",
      from_type: "airport",
      to_latitude: 52.52,
      to_longitude: 13.405,
      format: "text",
    });

    expect(unsupportedCity.isError).toBe(true);
    expect(firstTextContent(unsupportedCity)).toContain("Unsupported city");

    const invalidFromType = await tool.handler({
      city: "London",
      from_type: "heliport",
      to_latitude: 51.5115,
      to_longitude: -0.124,
      format: "text",
    });

    expect(invalidFromType.isError).toBe(true);
    expect(firstTextContent(invalidFromType)).toContain("Invalid from_type");
  });

  it("documents get_transfer_info in llms docs", () => {
    const sharedSnippets = [
      "get_transfer_info",
      "Estimate airport, station, or port transfers from a city's default arrival hub to hotel coordinates.",
    ];
    const fullOnlySnippets = [
      "from_type (required): airport, station, or port. Uses the city's default hub for that type",
      "to_latitude (required): hotel latitude",
      "to_longitude (required): hotel longitude",
    ];

    const shortDoc = buildLlmsTxt();
    const fullDoc = buildLlmsFullTxt();

    for (const snippet of sharedSnippets) {
      expect(shortDoc).toContain(snippet);
      expect(fullDoc).toContain(snippet);
    }

    for (const snippet of fullOnlySnippets) {
      expect(fullDoc).toContain(snippet);
    }
  });
});
