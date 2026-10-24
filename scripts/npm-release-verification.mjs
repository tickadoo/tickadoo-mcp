#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PROVENANCE_PREDICATE = "https://slsa.dev/provenance/v1";
const GITHUB_WORKFLOW_BUILD_TYPE =
  "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1";
const GITHUB_HOSTED_BUILDER = "https://github.com/actions/runner/github-hosted";
const NPM_REGISTRY = "https://registry.npmjs.org";
const REPOSITORY = "https://github.com/tickadoo/tickadoo-mcp";
const RELEASE_REF = "refs/heads/main";
const RELEASE_WORKFLOW = ".github/workflows/publish-npm.yml";
const WORKFLOW_IDENTITY = `${REPOSITORY}/${RELEASE_WORKFLOW}@${RELEASE_REF}`;
const FULCIO_OIDS = Object.freeze({
  subjectAlternativeName: "2.5.29.17",
  oidcIssuer: "1.3.6.1.4.1.57264.1.8",
  buildSignerUri: "1.3.6.1.4.1.57264.1.9",
  buildSignerDigest: "1.3.6.1.4.1.57264.1.10",
  runnerEnvironment: "1.3.6.1.4.1.57264.1.11",
  sourceRepositoryUri: "1.3.6.1.4.1.57264.1.12",
  sourceRepositoryDigest: "1.3.6.1.4.1.57264.1.13",
  sourceRepositoryRef: "1.3.6.1.4.1.57264.1.14",
  buildConfigUri: "1.3.6.1.4.1.57264.1.18",
  buildConfigDigest: "1.3.6.1.4.1.57264.1.19",
  buildTrigger: "1.3.6.1.4.1.57264.1.20",
  sourceRepositoryVisibility: "1.3.6.1.4.1.57264.1.22",
  deploymentEnvironment: "1.3.6.1.4.1.57264.1.23",
  tokenSubject: "1.3.6.1.4.1.57264.1.24",
});

export async function sha512Integrity(filePath) {
  const bytes = await readFile(filePath);
  return `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
}

function readDerElement(bytes, offset) {
  if (!Buffer.isBuffer(bytes) || offset < 0 || offset >= bytes.length) {
    throw new Error("certificate contains a truncated DER element");
  }
  const tag = bytes[offset];
  if ((tag & 0x1f) === 0x1f) {
    throw new Error("certificate uses an unsupported high-tag DER element");
  }

  const firstLength = bytes[offset + 1];
  if (firstLength === undefined || firstLength === 0x80) {
    throw new Error("certificate contains an invalid DER length");
  }
  let length;
  let headerLength = 2;
  if ((firstLength & 0x80) === 0) {
    length = firstLength;
  } else {
    const lengthBytes = firstLength & 0x7f;
    if (lengthBytes === 0 || lengthBytes > 4 || offset + 2 + lengthBytes > bytes.length) {
      throw new Error("certificate contains an invalid long-form DER length");
    }
    if (bytes[offset + 2] === 0) {
      throw new Error("certificate contains a non-minimal DER length");
    }
    length = 0;
    for (let index = 0; index < lengthBytes; index += 1) {
      length = length * 256 + bytes[offset + 2 + index];
    }
    if (length < 128) {
      throw new Error("certificate contains a non-minimal DER length");
    }
    headerLength += lengthBytes;
  }

  const contentStart = offset + headerLength;
  const contentEnd = contentStart + length;
  if (!Number.isSafeInteger(length) || contentEnd > bytes.length) {
    throw new Error("certificate contains an out-of-bounds DER element");
  }
  return { tag, contentStart, contentEnd, next: contentEnd };
}

function readDerChildren(bytes, element) {
  const children = [];
  let offset = element.contentStart;
  while (offset < element.contentEnd) {
    const child = readDerElement(bytes, offset);
    if (child.next > element.contentEnd) {
      throw new Error("certificate child exceeds its DER container");
    }
    children.push(child);
    offset = child.next;
  }
  if (offset !== element.contentEnd) {
    throw new Error("certificate DER container is not closed");
  }
  return children;
}

function decodeDerOid(bytes, element) {
  if (element.tag !== 0x06 || element.contentStart === element.contentEnd) {
    throw new Error("certificate extension has no DER object identifier");
  }
  const components = [];
  let value = 0;
  for (let offset = element.contentStart; offset < element.contentEnd; offset += 1) {
    const byte = bytes[offset];
    value = value * 128 + (byte & 0x7f);
    if (!Number.isSafeInteger(value)) {
      throw new Error("certificate extension object identifier is too large");
    }
    if ((byte & 0x80) === 0) {
      components.push(value);
      value = 0;
    } else if (offset === element.contentEnd - 1) {
      throw new Error("certificate extension has a truncated object identifier");
    }
  }
  const first = components.shift();
  const firstArc = Math.min(2, Math.floor(first / 40));
  return [firstArc, first - firstArc * 40, ...components].join(".");
}

function readCertificateExtensions(certificateBytes) {
  const root = readDerElement(certificateBytes, 0);
  if (root.tag !== 0x30 || root.next !== certificateBytes.length) {
    throw new Error("provenance certificate is not one canonical DER sequence");
  }
  const rootChildren = readDerChildren(certificateBytes, root);
  const tbsCertificate = rootChildren[0];
  if (tbsCertificate?.tag !== 0x30) {
    throw new Error("provenance certificate has no TBSCertificate sequence");
  }
  const extensionContainers = readDerChildren(certificateBytes, tbsCertificate).filter(
    element => element.tag === 0xa3,
  );
  if (extensionContainers.length !== 1) {
    throw new Error("provenance certificate must have one extensions container");
  }
  const explicitChildren = readDerChildren(certificateBytes, extensionContainers[0]);
  if (explicitChildren.length !== 1 || explicitChildren[0].tag !== 0x30) {
    throw new Error("provenance certificate extensions container is malformed");
  }

  const extensions = new Map();
  for (const extension of readDerChildren(certificateBytes, explicitChildren[0])) {
    if (extension.tag !== 0x30) {
      throw new Error("provenance certificate extension is not a sequence");
    }
    const fields = readDerChildren(certificateBytes, extension);
    const oid = decodeDerOid(certificateBytes, fields[0]);
    const value = fields.at(-1);
    if ((fields.length !== 2 && fields.length !== 3) || value?.tag !== 0x04) {
      throw new Error(`provenance certificate extension ${oid} is malformed`);
    }
    if (fields.length === 3 && fields[1].tag !== 0x01) {
      throw new Error(`provenance certificate extension ${oid} has an invalid critical field`);
    }
    if (extensions.has(oid)) {
      throw new Error(`provenance certificate repeats extension ${oid}`);
    }
    extensions.set(oid, certificateBytes.subarray(value.contentStart, value.contentEnd));
  }
  return extensions;
}

function decodeFulcioTextExtension(extensions, oid) {
  const encoded = extensions.get(oid);
  if (!encoded) throw new Error(`provenance certificate is missing extension ${oid}`);
  const value = readDerElement(encoded, 0);
  if (value.tag !== 0x0c || value.next !== encoded.length) {
    throw new Error(`provenance certificate extension ${oid} is not one UTF8String`);
  }
  const text = encoded.subarray(value.contentStart, value.contentEnd).toString("utf8");
  if (!Buffer.from(text, "utf8").equals(encoded.subarray(value.contentStart, value.contentEnd))) {
    throw new Error(`provenance certificate extension ${oid} is not valid UTF-8`);
  }
  return text;
}

function assertFulcioCertificateIdentity(provenanceBundle, commitSha) {
  const rawBytes = provenanceBundle?.bundle?.verificationMaterial?.certificate?.rawBytes;
  if (typeof rawBytes !== "string" || rawBytes === "") {
    throw new Error("npm provenance bundle has no Fulcio certificate");
  }
  const certificateBytes = Buffer.from(rawBytes, "base64");
  if (certificateBytes.length === 0 || certificateBytes.toString("base64") !== rawBytes) {
    throw new Error("npm provenance certificate is not canonical base64 DER");
  }
  const extensions = readCertificateExtensions(certificateBytes);

  const san = extensions.get(FULCIO_OIDS.subjectAlternativeName);
  if (!san) throw new Error("npm provenance certificate has no subject alternative name");
  const sanSequence = readDerElement(san, 0);
  if (sanSequence.tag !== 0x30 || sanSequence.next !== san.length) {
    throw new Error("npm provenance certificate subject alternative name is malformed");
  }
  const names = readDerChildren(san, sanSequence);
  const expectedSan = `URI:${WORKFLOW_IDENTITY}`;
  const actualSans = names.map(name => {
    if (name.tag !== 0x86) {
      throw new Error("npm provenance certificate contains a non-URI identity");
    }
    const identityBytes = san.subarray(name.contentStart, name.contentEnd);
    if (identityBytes.some(byte => byte > 0x7f)) {
      throw new Error("npm provenance certificate identity is not ASCII");
    }
    return `URI:${identityBytes.toString("ascii")}`;
  });
  if (actualSans.length !== 1 || actualSans[0] !== expectedSan) {
    throw new Error(`npm provenance certificate identity is not ${expectedSan}`);
  }

  const expectedClaims = new Map([
    [FULCIO_OIDS.oidcIssuer, "https://token.actions.githubusercontent.com"],
    [FULCIO_OIDS.buildSignerUri, WORKFLOW_IDENTITY],
    [FULCIO_OIDS.buildSignerDigest, commitSha],
    [FULCIO_OIDS.runnerEnvironment, "github-hosted"],
    [FULCIO_OIDS.sourceRepositoryUri, REPOSITORY],
    [FULCIO_OIDS.sourceRepositoryDigest, commitSha],
    [FULCIO_OIDS.sourceRepositoryRef, RELEASE_REF],
    [FULCIO_OIDS.buildConfigUri, WORKFLOW_IDENTITY],
    [FULCIO_OIDS.buildConfigDigest, commitSha],
    [FULCIO_OIDS.buildTrigger, "workflow_dispatch"],
    [FULCIO_OIDS.sourceRepositoryVisibility, "public"],
    [FULCIO_OIDS.deploymentEnvironment, "npm"],
    [FULCIO_OIDS.tokenSubject, "repo:tickadoo/tickadoo-mcp:environment:npm"],
  ]);
  for (const [oid, expected] of expectedClaims) {
    const actual = decodeFulcioTextExtension(extensions, oid);
    if (actual !== expected) {
      throw new Error(`npm provenance certificate extension ${oid} does not match release identity`);
    }
  }
}

export function assertNpmPublication({
  auditReport,
  lockfile,
  packageName,
  version,
  integrity,
  commitSha,
}) {
  if (!/^[0-9a-f]{40}$/.test(commitSha)) {
    throw new Error("release commit must be an exact 40-character lowercase SHA");
  }
  if (!Array.isArray(auditReport.invalid) || auditReport.invalid.length !== 0) {
    throw new Error("npm signature audit reported invalid packages");
  }
  if (!Array.isArray(auditReport.missing) || auditReport.missing.length !== 0) {
    throw new Error("npm signature audit reported packages with missing signatures");
  }
  if (!Array.isArray(auditReport.verified)) {
    throw new Error("npm signature audit has no verified package list");
  }

  const lockPath = `node_modules/${packageName}`;
  const locked = lockfile.packages?.[lockPath];
  if (!locked || typeof locked !== "object") {
    throw new Error(`npm lockfile has no ${lockPath} entry`);
  }
  if (locked.version !== version) {
    throw new Error(`npm lockfile version is ${locked.version}, expected ${version}`);
  }
  if (locked.integrity !== integrity) {
    throw new Error("npm lockfile integrity does not match the verified release artifact");
  }

  let resolved;
  try {
    resolved = new URL(locked.resolved);
  } catch {
    throw new Error("npm lockfile resolved URL is missing or invalid");
  }
  if (resolved.origin !== NPM_REGISTRY) {
    throw new Error(`npm package resolved from unexpected origin ${resolved.origin}`);
  }

  const matches = auditReport.verified.filter(
    entry => entry.name === packageName && entry.version === version,
  );
  if (matches.length !== 1) {
    throw new Error(`npm signature audit verified ${matches.length} matching package entries`);
  }
  const target = matches[0];
  if (target.location !== lockPath || target.registry !== `${NPM_REGISTRY}/`) {
    throw new Error("npm signature audit target location or registry is unexpected");
  }
  if (target.attestations?.provenance?.predicateType !== PROVENANCE_PREDICATE) {
    throw new Error("npm signature audit target has no SLSA v1 provenance summary");
  }
  if (
    !Array.isArray(target.attestationBundles) ||
    target.attestationBundles.filter(bundle => bundle?.predicateType === PROVENANCE_PREDICATE)
      .length !== 1
  ) {
    throw new Error("npm signature audit target must have exactly one verified SLSA v1 bundle");
  }

  const provenanceBundle = target.attestationBundles.find(
    bundle => bundle?.predicateType === PROVENANCE_PREDICATE,
  );
  assertFulcioCertificateIdentity(provenanceBundle, commitSha);
  let statement;
  try {
    statement = JSON.parse(
      Buffer.from(provenanceBundle.bundle.dsseEnvelope.payload, "base64").toString("utf8"),
    );
  } catch {
    throw new Error("npm provenance bundle has no decodable DSSE statement");
  }

  const expectedPurl = `pkg:npm/${packageName.replace(/^@/, "%40")}@${version}`;
  const digestBytes = Buffer.from(integrity.replace(/^sha512-/, ""), "base64");
  if (!integrity.startsWith("sha512-") || digestBytes.length !== 64) {
    throw new Error("verified release artifact integrity is not a SHA-512 SRI value");
  }
  if (
    statement.predicateType !== PROVENANCE_PREDICATE ||
    !Array.isArray(statement.subject) ||
    statement.subject.length !== 1 ||
    statement.subject[0]?.name !== expectedPurl ||
    statement.subject[0]?.digest?.sha512 !== digestBytes.toString("hex")
  ) {
    throw new Error("npm provenance subject does not match the exact release artifact");
  }

  const build = statement.predicate?.buildDefinition;
  const workflow = build?.externalParameters?.workflow;
  if (
    build?.buildType !== GITHUB_WORKFLOW_BUILD_TYPE ||
    workflow?.repository !== REPOSITORY ||
    workflow?.path !== RELEASE_WORKFLOW ||
    workflow?.ref !== RELEASE_REF
  ) {
    throw new Error("npm provenance was not produced by the approved main-branch workflow");
  }
  if (build?.internalParameters?.github?.event_name !== "workflow_dispatch") {
    throw new Error("npm provenance was not produced by a manual release dispatch");
  }
  if (
    !Array.isArray(build?.resolvedDependencies) ||
    !build.resolvedDependencies.some(
      dependency =>
        dependency?.uri === `git+${REPOSITORY}@${RELEASE_REF}` &&
        dependency?.digest?.gitCommit === commitSha,
    )
  ) {
    throw new Error(`npm provenance is not bound to release commit ${commitSha}`);
  }
  if (statement.predicate?.runDetails?.builder?.id !== GITHUB_HOSTED_BUILDER) {
    throw new Error("npm provenance builder is not the GitHub-hosted Actions runner");
  }
}

async function main([command, ...args]) {
  if (command === "integrity" && args.length === 1) {
    process.stdout.write(`${await sha512Integrity(args[0])}\n`);
    return;
  }
  if (command === "audit" && args.length === 6) {
    const [auditPath, lockfilePath, packageName, version, integrity, commitSha] = args;
    assertNpmPublication({
      auditReport: JSON.parse(await readFile(auditPath, "utf8")),
      lockfile: JSON.parse(await readFile(lockfilePath, "utf8")),
      packageName,
      version,
      integrity,
      commitSha,
    });
    process.stdout.write(`npm signature, provenance, and artifact integrity verified: ${packageName}@${version}\n`);
    return;
  }

  throw new Error(
    "Usage: npm-release-verification.mjs integrity <tgz> | " +
      "audit <audit-json> <package-lock> <package-name> <version> <integrity> <commit-sha>",
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
