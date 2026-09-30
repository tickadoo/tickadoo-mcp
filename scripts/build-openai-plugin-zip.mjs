#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const builderPath = "scripts/build-openai-plugin-zip.mjs";
const configPath = "scripts/openai-plugin-files.json";

function readHeadFile(file) {
  return execFileSync("git", ["show", `HEAD:${file}`], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
}

function isContainedRepositoryPath(file) {
  return (
    typeof file === "string" &&
    file.length > 0 &&
    !path.posix.isAbsolute(file) &&
    path.posix.normalize(file) === file &&
    !file.split("/").includes("..") &&
    !file.endsWith("/")
  );
}

const manifest = JSON.parse(readHeadFile("plugin.json"));
const { files, sourceOverrides = {} } = JSON.parse(readHeadFile(configPath));

if (!Array.isArray(files) || files.length === 0 || files.some((file) => !isContainedRepositoryPath(file))) {
  throw new Error("OpenAI plugin ZIP allowlist must contain safe repository-relative file paths");
}
if (new Set(files).size !== files.length) {
  throw new Error("OpenAI plugin ZIP allowlist contains duplicate paths");
}
if (
  !sourceOverrides ||
  Array.isArray(sourceOverrides) ||
  typeof sourceOverrides !== "object" ||
  Object.entries(sourceOverrides).some(
    ([archivePath, sourcePath]) =>
      !files.includes(archivePath) || !isContainedRepositoryPath(sourcePath),
  )
) {
  throw new Error("OpenAI plugin ZIP source overrides must map allowlisted paths to safe sources");
}

const sourceFiles = files.map((file) => sourceOverrides[file] ?? file);
const controlledFiles = [builderPath, configPath, ...new Set(sourceFiles)];

const dirty = execFileSync(
  "git",
  ["status", "--porcelain=v1", "--untracked-files=all", "--", ...controlledFiles],
  { cwd: repositoryRoot, encoding: "utf8" },
).trim();
if (dirty) {
  throw new Error(`Refusing to archive package files that differ from HEAD:\n${dirty}`);
}

const artifactsRoot = path.join(repositoryRoot, "artifacts");
const requestedOutput =
  process.argv[2] ?? `artifacts/${manifest.name}-${manifest.version}-openai.zip`;
const outputPath = path.resolve(repositoryRoot, requestedOutput);
if (
  path.dirname(outputPath) !== artifactsRoot ||
  path.extname(outputPath).toLowerCase() !== ".zip"
) {
  throw new Error("OpenAI plugin ZIP output must be a .zip file directly inside the repository artifacts directory");
}
mkdirSync(artifactsRoot, { recursive: true });
if (lstatSync(artifactsRoot).isSymbolicLink()) {
  throw new Error("Refusing to use a symbolic-link artifacts directory");
}
rmSync(outputPath, { force: true });

const virtualFiles = Object.entries(sourceOverrides).map(([archivePath, sourcePath]) =>
  `--add-virtual-file=${archivePath}:${readHeadFile(sourcePath)}`,
);
const directFiles = files.filter((file) => !Object.hasOwn(sourceOverrides, file));
execFileSync(
  "git",
  [
    "archive",
    "--format=zip",
    `--output=${outputPath}`,
    ...virtualFiles,
    "HEAD",
    "--",
    ...directFiles,
  ],
  { cwd: repositoryRoot, stdio: "inherit" },
);

const archivedEntries = execFileSync("unzip", ["-Z1", outputPath], { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean);
const archivedFiles = archivedEntries.filter((entry) => !entry.endsWith("/"));
const expectedDirectories = new Set();
for (const file of files) {
  const segments = file.split("/");
  for (let index = 1; index < segments.length; index += 1) {
    expectedDirectories.add(`${segments.slice(0, index).join("/")}/`);
  }
}
const expectedEntries = [...expectedDirectories, ...files].sort();
if (JSON.stringify([...archivedEntries].sort()) !== JSON.stringify(expectedEntries)) {
  throw new Error(
    `OpenAI plugin ZIP closure mismatch:\nexpected ${expectedEntries.join("\n")}\nactual ${archivedEntries.join("\n")}`,
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
