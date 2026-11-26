import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertNpmPublication } from "../scripts/npm-release-verification.mjs";

const workflow = readFileSync(
  new URL("../.github/workflows/publish-npm.yml", import.meta.url),
  "utf8",
);

describe("npm trusted publishing workflow", () => {
  it("is a manual, main-only, protected OIDC release with no token fallback", () => {
    expect(workflow).toMatch(/^\s{2}workflow_dispatch:/m);
    expect(workflow).toMatch(/^\s{6}version:/m);
    expect(workflow).toMatch(/^\s{2}contents: read$/m);
    expect(workflow.match(/if: github\.ref == 'refs\/heads\/main'/g)).toHaveLength(2);
    expect(workflow).toMatch(/^\s{4}environment: npm$/m);
    expect(workflow.match(/runs-on: ubuntu-latest/g)).toHaveLength(2);
    expect(workflow).not.toMatch(/NODE_AUTH_TOKEN|NPM_TOKEN|_authToken|secrets\./i);
    expect(workflow).not.toContain("registry-url:");

    const verifyJob = workflow.slice(workflow.indexOf("  verify:"), workflow.indexOf("  publish:"));
    const publishJob = workflow.slice(workflow.indexOf("  publish:"));
    expect(verifyJob).not.toContain("id-token: write");
    expect(publishJob).toContain("needs: verify");
    expect(publishJob).toMatch(/^\s{6}id-token: write$/m);
  });

  it("verifies without OIDC, then publishes only the exact hashed artifact", () => {
    expect(workflow).toContain("npm install --global npm@11.19.1");
    expect(workflow).toContain("npm ci");
    expect(workflow).toContain("npm run build");
    expect(workflow).toContain("npx tsc --noEmit");
    expect(workflow).toContain("npm test");
    expect(workflow).toContain("npm run verify:public-agent");
    expect(workflow).toContain("npm audit --omit=dev");
    expect(workflow).toContain("npm pack --ignore-scripts --json");
    expect(workflow).toContain("Smoke-test the exact packed bridge against the full MCP endpoint");
    expect(workflow).toContain("scripts/smoke-packed-bridge.mjs");
    expect(workflow).toContain('"${smoke_dir}/node_modules/.bin/mcp-server"');
    expect(workflow).toContain("sha256sum -c npm-package.sha256");
    expect(workflow).toContain('npm publish "./${package_file}" --access public --ignore-scripts');
    expect(workflow.match(/npm view "\$\{package_name\}" versions --json/g)).toHaveLength(2);
    expect(workflow).not.toContain('npm view "${package_name}@${package_version}" version >/dev/null');
    expect(workflow).toContain("actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9");
    expect(workflow).toContain("actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333");
    expect(workflow).toContain('npm view "${package_name}@${EXPECTED_VERSION}" version');
    expect(workflow).toContain('npm view "${package_name}@latest" version');
    expect(workflow).toContain('dist.integrity');
    expect(workflow).toContain('[ "${registry_integrity}" = "${local_integrity}" ]');
    expect(workflow).toContain('dist.attestations.provenance.predicateType');
    expect(workflow).toContain('dist.attestations.url');
    expect(workflow).toContain("https://slsa.dev/provenance/v1");
    expect(workflow).toContain("https://registry.npmjs.org/-/npm/v1/attestations/*");
    expect(workflow.match(/for attempt in \{1\.\.12\}; do/g)).toHaveLength(2);
    expect(workflow).toContain("npm --prefix \"${audit_dir}\" audit signatures");
    expect(workflow).toContain("--include-attestations");
    expect(workflow).toContain('"${GITHUB_SHA}"');
    expect(workflow).toContain("scripts/npm-release-verification.mjs");
  });
});

describe("npm publication verifier", () => {
  const packageName = "@tickadoo/mcp-server";
  const version = "2.2.0";
  const commitSha = "a".repeat(40);
  const repository = "https://github.com/tickadoo/tickadoo-mcp";
  const releaseRef = "refs/heads/main";
  const workflowIdentity =
    "https://github.com/tickadoo/tickadoo-mcp/.github/workflows/publish-npm.yml@refs/heads/main";
  const digest = Buffer.alloc(64, 7);
  const integrity = `sha512-${digest.toString("base64")}`;
  const statement = {
    _type: "https://in-toto.io/Statement/v1",
    subject: [
      {
        name: "pkg:npm/%40tickadoo/mcp-server@2.2.0",
        digest: { sha512: digest.toString("hex") },
      },
    ],
    predicateType: "https://slsa.dev/provenance/v1",
    predicate: {
      buildDefinition: {
        buildType: "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1",
        externalParameters: {
          workflow: {
            ref: "refs/heads/main",
            repository: "https://github.com/tickadoo/tickadoo-mcp",
            path: ".github/workflows/publish-npm.yml",
          },
        },
        internalParameters: { github: { event_name: "workflow_dispatch" } },
        resolvedDependencies: [
          {
            uri: "git+https://github.com/tickadoo/tickadoo-mcp@refs/heads/main",
            digest: { gitCommit: commitSha },
          },
        ],
      },
      runDetails: { builder: { id: "https://github.com/actions/runner/github-hosted" } },
    },
  };

  function derLength(length: number) {
    if (length < 128) return Buffer.from([length]);
    const bytes: number[] = [];
    for (let remaining = length; remaining > 0; remaining = Math.floor(remaining / 256)) {
      bytes.unshift(remaining & 0xff);
    }
    return Buffer.from([0x80 | bytes.length, ...bytes]);
  }

  function der(tag: number, ...parts: Buffer[]) {
    const content = Buffer.concat(parts);
    return Buffer.concat([Buffer.from([tag]), derLength(content.length), content]);
  }

  function base128(value: number) {
    const bytes = [value & 0x7f];
    for (let remaining = Math.floor(value / 128); remaining > 0; remaining = Math.floor(remaining / 128)) {
      bytes.unshift((remaining & 0x7f) | 0x80);
    }
    return bytes;
  }

  function oid(value: string) {
    const arcs = value.split(".").map(Number);
    const components = [arcs[0] * 40 + arcs[1], ...arcs.slice(2)];
    return der(0x06, Buffer.from(components.flatMap(base128)));
  }

  function extension(identifier: string, encoded: Buffer) {
    return der(0x30, oid(identifier), der(0x04, encoded));
  }

  function certificate({
    identity = workflowIdentity,
    commit = commitSha,
    deploymentEnvironment = "npm",
    tokenSubject = "repo:tickadoo/tickadoo-mcp:environment:npm",
    identityBytes = Buffer.from(identity, "ascii"),
  }: {
    identity?: string;
    commit?: string;
    deploymentEnvironment?: string;
    tokenSubject?: string;
    identityBytes?: Buffer;
  } = {}) {
    const utf8 = (value: string) => der(0x0c, Buffer.from(value, "utf8"));
    const extensions = [
      extension("2.5.29.17", der(0x30, der(0x86, identityBytes))),
      extension("1.3.6.1.4.1.57264.1.8", utf8("https://token.actions.githubusercontent.com")),
      extension("1.3.6.1.4.1.57264.1.9", utf8(identity)),
      extension("1.3.6.1.4.1.57264.1.10", utf8(commit)),
      extension("1.3.6.1.4.1.57264.1.11", utf8("github-hosted")),
      extension("1.3.6.1.4.1.57264.1.12", utf8(repository)),
      extension("1.3.6.1.4.1.57264.1.13", utf8(commit)),
      extension("1.3.6.1.4.1.57264.1.14", utf8(releaseRef)),
      extension("1.3.6.1.4.1.57264.1.18", utf8(identity)),
      extension("1.3.6.1.4.1.57264.1.19", utf8(commit)),
      extension("1.3.6.1.4.1.57264.1.20", utf8("workflow_dispatch")),
      extension("1.3.6.1.4.1.57264.1.22", utf8("public")),
      extension("1.3.6.1.4.1.57264.1.23", utf8(deploymentEnvironment)),
      extension("1.3.6.1.4.1.57264.1.24", utf8(tokenSubject)),
    ];
    return der(0x30, der(0x30, der(0xa3, der(0x30, ...extensions)))).toString("base64");
  }

  function fixtures() {
    return {
      auditReport: {
        invalid: [] as unknown[],
        missing: [] as unknown[],
        verified: [
          {
            name: packageName,
            version,
            location: "node_modules/@tickadoo/mcp-server",
            registry: "https://registry.npmjs.org/",
            attestations: {
              provenance: { predicateType: "https://slsa.dev/provenance/v1" },
            },
            attestationBundles: [
              {
                predicateType: "https://slsa.dev/provenance/v1",
                bundle: {
                  verificationMaterial: {
                    certificate: { rawBytes: certificate() },
                  },
                  dsseEnvelope: {
                    payload: Buffer.from(JSON.stringify(statement)).toString("base64"),
                  },
                },
              },
            ],
          },
        ],
      },
      lockfile: {
        packages: {
          "node_modules/@tickadoo/mcp-server": {
            version,
            integrity,
            resolved: "https://registry.npmjs.org/@tickadoo/mcp-server/-/mcp-server-2.2.0.tgz",
          },
        },
      },
      packageName,
      version,
      integrity,
      commitSha,
    };
  }

  it("binds the verified registry package to the exact artifact, workflow, and commit", () => {
    expect(() => assertNpmPublication(fixtures())).not.toThrow();
  });

  it.each([
    ["artifact integrity", (value: ReturnType<typeof fixtures>) => { value.lockfile.packages["node_modules/@tickadoo/mcp-server"].integrity = `sha512-${Buffer.alloc(64, 8).toString("base64")}`; }],
    ["signature audit", (value: ReturnType<typeof fixtures>) => { value.auditReport.invalid.push({ name: packageName }); }],
    ["exact commit", (value: ReturnType<typeof fixtures>) => { value.commitSha = "b".repeat(40); }],
    ["certificate identity", (value: ReturnType<typeof fixtures>) => { value.auditReport.verified[0].attestationBundles[0].bundle.verificationMaterial.certificate.rawBytes = certificate({ identity: "https://github.com/other/repo/.github/workflows/publish.yml@refs/heads/main" }); }],
    ["deployment environment", (value: ReturnType<typeof fixtures>) => { value.auditReport.verified[0].attestationBundles[0].bundle.verificationMaterial.certificate.rawBytes = certificate({ deploymentEnvironment: "production" }); }],
    ["token subject", (value: ReturnType<typeof fixtures>) => { value.auditReport.verified[0].attestationBundles[0].bundle.verificationMaterial.certificate.rawBytes = certificate({ tokenSubject: "repo:tickadoo/tickadoo-mcp:ref:refs/heads/main" }); }],
    ["non-ASCII certificate identity", (value: ReturnType<typeof fixtures>) => { value.auditReport.verified[0].attestationBundles[0].bundle.verificationMaterial.certificate.rawBytes = certificate({ identityBytes: Buffer.concat([Buffer.from(workflowIdentity, "ascii"), Buffer.from([0xff])]) }); }],
    ["trusted workflow", (value: ReturnType<typeof fixtures>) => { statement.predicate.buildDefinition.externalParameters.workflow.path = ".github/workflows/other.yml"; value.auditReport.verified[0].attestationBundles[0].bundle.dsseEnvelope.payload = Buffer.from(JSON.stringify(statement)).toString("base64"); }],
  ])("rejects mismatched %s", (_label, mutate) => {
    const value = fixtures();
    const originalPath = statement.predicate.buildDefinition.externalParameters.workflow.path;
    try {
      mutate(value);
      expect(() => assertNpmPublication(value)).toThrow();
    } finally {
      statement.predicate.buildDefinition.externalParameters.workflow.path = originalPath;
    }
  });
});
