#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const builderPath = "scripts/build-openai-plugin-zip.mjs";
const configPath = "scripts/openai-plugin-files.json";
const MAX_COMPRESSED_ZIP_BYTES = 100_000_000;
const MAX_ARCHIVE_ENTRIES = 5_000;
const MAX_ARCHIVE_MEMBER_BYTES = 100 * 1024 * 1024;
const MAX_UNCOMPRESSED_ZIP_BYTES = 512 * 1024 * 1024;
const MAX_ARCHIVE_PATH_SEGMENTS = 20;

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
if (existsSync(outputPath)) {
  const outputStat = lstatSync(outputPath);
  if (outputStat.isSymbolicLink() || !outputStat.isFile()) {
    throw new Error("Refusing to replace a non-regular OpenAI plugin ZIP output path");
  }
}
const temporaryOutputPath = path.join(
  artifactsRoot,
  `.${path.basename(outputPath)}.tmp-${process.pid}-${randomUUID()}.zip`,
);

const virtualFiles = Object.entries(sourceOverrides).map(([archivePath, sourcePath]) =>
  `--add-virtual-file=${archivePath}:${readHeadFile(sourcePath)}`,
);
const directFiles = files.filter((file) => !Object.hasOwn(sourceOverrides, file));
try {
  execFileSync(
    "git",
    [
      "archive",
      "--format=zip",
      `--output=${temporaryOutputPath}`,
      ...virtualFiles,
      "HEAD",
      "--",
      ...directFiles,
    ],
    { cwd: repositoryRoot, stdio: "inherit" },
  );

  const archivedEntries = execFileSync("unzip", ["-Z1", temporaryOutputPath], { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean);
  const archivedFiles = archivedEntries.filter((entry) => !entry.endsWith("/"));
  if (statSync(temporaryOutputPath).size > MAX_COMPRESSED_ZIP_BYTES) {
    throw new Error("OpenAI plugin ZIP exceeds the 100 MB compressed upload limit");
  }
  if (archivedEntries.length > MAX_ARCHIVE_ENTRIES) {
    throw new Error("OpenAI plugin ZIP exceeds the 5,000-entry upload limit");
  }
  if (
    archivedEntries.some(
      (entry) => entry.split("/").filter(Boolean).length > MAX_ARCHIVE_PATH_SEGMENTS,
    )
  ) {
    throw new Error("OpenAI plugin ZIP contains a path deeper than 20 segments");
  }
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
  let uncompressedBytes = 0;
  for (const file of archivedFiles) {
    const sourceBuffer = execFileSync("unzip", ["-p", temporaryOutputPath, file]);
    if (sourceBuffer.byteLength > MAX_ARCHIVE_MEMBER_BYTES) {
      throw new Error(`OpenAI plugin ZIP member exceeds 100 MiB: ${file}`);
    }
    uncompressedBytes += sourceBuffer.byteLength;
    if (uncompressedBytes > MAX_UNCOMPRESSED_ZIP_BYTES) {
      throw new Error("OpenAI plugin ZIP exceeds the 512 MiB extracted-size limit");
    }
    const source = sourceBuffer.toString("utf8");
    if (forbidden.some((pattern) => pattern.test(source))) {
      throw new Error(`Credential-shaped content found in ${file}`);
    }
  }

  const digest = createHash("sha256").update(readFileSync(temporaryOutputPath)).digest("hex");
  // Publish only a fully validated archive. A validation exception leaves any
  // prior known-good artifact untouched and removes this temporary candidate.
  renameSync(temporaryOutputPath, outputPath);
  process.stdout.write(
    `${JSON.stringify({ path: outputPath, sha256: digest, files: archivedFiles }, null, 2)}\n`,
  );
} finally {
  rmSync(temporaryOutputPath, { force: true });
}
