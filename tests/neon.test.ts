import { describe, expect, it } from "vitest";
import { createNeonClient } from "../src/shared/neon.js";

describe("createNeonClient", () => {
  it("returns null for an absent connection string", () => {
    expect(createNeonClient(undefined)).toBeNull();
    expect(createNeonClient(null)).toBeNull();
    expect(createNeonClient("")).toBeNull();
    expect(createNeonClient("   ")).toBeNull();
  });

  it("throws a generic error on malformed URLs (no internal detail leak)", () => {
    expect(() => createNeonClient("not a url")).toThrowError("Database configuration error.");
    expect(() => createNeonClient("://missing-scheme")).toThrowError("Database configuration error.");
  });

  it("returns a callable query function for a well-formed URL", () => {
    // The URL does not need to resolve — construction is a pure parse step.
    // Actual query execution is integration-tested live against Neon.
    const client = createNeonClient("postgres://u:p@example.neon.tech/db?sslmode=require");
    expect(client).toBeTypeOf("function");
  });

  it("typechecks as a generic Row-returning function", () => {
    // Guard against accidental signature drift. If NeonClient ever stops
    // accepting `(query, params)`, this file will fail to compile.
    const client = createNeonClient("postgres://u:p@example.neon.tech/db");
    if (!client) throw new Error("expected non-null client");
    const _signature: (query: string, params?: unknown[]) => Promise<unknown[]> = client;
    expect(_signature).toBeTypeOf("function");
  });
});
