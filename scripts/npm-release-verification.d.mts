export function sha512Integrity(filePath: string): Promise<string>;

export function assertNpmPublication(options: {
  auditReport: Record<string, unknown>;
  lockfile: Record<string, unknown>;
  packageName: string;
  version: string;
  integrity: string;
  commitSha: string;
}): void;
