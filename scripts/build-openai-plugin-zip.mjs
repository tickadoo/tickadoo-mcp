#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const manifest = JSON.parse(readFileSync(path.join(repositoryRoot, "plugin.json"), "utf8"));
const { files } = JSON.parse(
  readFileSync(path.join(scriptDirectory, "openai-plugin-files.json"), "utf8"),
);

if (!Array.isArray(files) || files.length === 0 || files.some((file) => typeof file !== "string")) {
  throw new Error("scripts/openai-plugin-files.json must contain a non-empty string array");
}
if (new Set(files).size !== files.length) {
  throw new Error("OpenAI plugin ZIP allowlist contains duplicate paths");
}

const dirty = execFileSync(
  "git",
  ["status", "--porcelain=v1", "--untracked-files=all", "--", ...files],
  { cwd: repositoryRoot, encoding: "utf8" },
).trim();
if (dirty) {
  throw new Error(`Refusing to archive package files that differ from HEAD:\n${dirty}`);
}

const defaultOutput = path.join(
  repositoryRoot,
  "artifacts",
  `${manifest.name}-${manifest.version}-openai.zip`,
);
const outputPath = path.resolve(process.cwd(), process.argv[2] ?? defaultOutput);
mkdirSync(path.dirname(outputPath), { recursive: true });
rmSync(outputPath, { force: true });

execFileSync(
  "git",
  ["archive", "--format=zip", `--output=${outputPath}`, "HEAD", "--", ...files],
  { cwd: repositoryRoot, stdio: "inherit" },
);

const archivedFiles = execFileSync("unzip", ["-Z1", outputPath], { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean);
const expectedFiles = [...files].sort();
if (JSON.stringify([...archivedFiles].sort()) !== JSON.stringify(expectedFiles)) {
  throw new Error(
    `OpenAI plugin ZIP closure mismatch:\nexpected ${expectedFiles.join("\n")}\nactual ${archivedFiles.join("\n")}`,
  );
}

const forbidden = [
  /Bearer\s+[A-Za-z0-9._~+/=-]{12,}/i,
  /"Authorization"\s*:/i,
  /\$\{[^}]*(?:TOKEN|SECRET|PASSWORD|API[_-]?KEY)[^}]*\}/i,
  /(?:sk|ghp|github_pat|AKIA)[-_A-Za-z0-9]{12,}/,
  /https?:\/\/[^/\s]+:[^@/\s]+@/,
];
for (const file of archivedFiles) {
  const source = execFileSync("unzip", ["-p", outputPath, file], { encoding: "utf8" });
  if (forbidden.some((pattern) => pattern.test(source))) {
    throw new Error(`Credential-shaped content found in ${file}`);
  }
}

const digest = createHash("sha256").update(readFileSync(outputPath)).digest("hex");
process.stdout.write(
  `${JSON.stringify({ path: outputPath, sha256: digest, files: archivedFiles }, null, 2)}\n`,
);
