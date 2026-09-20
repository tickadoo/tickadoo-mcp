import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../.github/workflows/exact-head-review-bot.yml", import.meta.url),
  "utf8",
);

const EXPECTED_RUN_NAME =
  "run-name: 'Exact-head review PR #${{ inputs.pr_number }} @ ${{ inputs.expected_head_sha }} [${{ inputs.request_id }}]'";

describe("exact-head review workflow", () => {
  it("preserves the complete correlation title as a quoted YAML scalar", () => {
    const runNameLines = workflow
      .split(/\r?\n/)
      .filter((line) => line.startsWith("run-name:"));

    expect(runNameLines).toEqual([EXPECTED_RUN_NAME]);
  });
});
