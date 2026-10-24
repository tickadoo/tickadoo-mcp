import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { containsCredentialShapedContent } from "../scripts/openai-plugin-security.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("OpenAI plugin package credential scan", () => {
  it("accepts every allowlisted source file without mistaking tool names for keys", async () => {
    const config = JSON.parse(
      await readFile(path.join(root, "scripts/openai-plugin-files.json"), "utf8"),
    ) as { files: string[] };

    for (const file of config.files) {
      const source = await readFile(path.join(root, file), "utf8");
      expect(containsCredentialShapedContent(source), file).toBe(false);
    }
    expect(containsCredentialShapedContent("ask_theatre_concierge")).toBe(false);
  });

  it("keeps packaged brand-asset metadata neutral for the discovery-only surface", async () => {
    for (const file of [
      "brand/apps-directory-icon.svg",
      "brand/apps-directory-icon-monochrome.svg",
    ]) {
      const source = await readFile(path.join(root, file), "utf8");
      expect(source, file).not.toMatch(
        /\b(?:book(?:ed|ing)?|checkout|purchas(?:e|ed|ing)|transaction(?:al)?)\b/i,
      );
    }
  });

  it.each([
    "Bearer abcdefghijklmnop",
    '{"Authorization":"secret"}',
    "${OPENAI_API_KEY}",
    `sk-${"a".repeat(24)}`,
    `ghp_${"a".repeat(36)}`,
    `gho_${"a".repeat(36)}`,
    `github_pat_${"a".repeat(30)}`,
    `AKIA${"A".repeat(16)}`,
    `ASIA${"A".repeat(16)}`,
    "https://user:password@example.com/path",
  ])("rejects credential-shaped content: %s", source => {
    expect(containsCredentialShapedContent(source)).toBe(true);
  });
});
