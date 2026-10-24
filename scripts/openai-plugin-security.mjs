export const forbiddenCredentialPatterns = Object.freeze([
  /Bearer\s+[A-Za-z0-9._~+/=-]{12,}/i,
  /"Authorization"\s*:/i,
  /\$\{[^}]*(?:TOKEN|SECRET|PASSWORD|API[_-]?KEY)[^}]*\}/i,
  /(?:^|[^A-Za-z0-9_])sk-[A-Za-z0-9_-]{20,}(?![A-Za-z0-9_-])/m,
  /(?:^|[^A-Za-z0-9_])gh[pousr]_[A-Za-z0-9]{30,}(?![A-Za-z0-9])/m,
  /(?:^|[^A-Za-z0-9_])github_pat_[A-Za-z0-9_]{20,}(?![A-Za-z0-9_])/m,
  /(?:^|[^A-Z0-9])(?:AKIA|ASIA)[A-Z0-9]{16}(?![A-Z0-9])/m,
  /https?:\/\/[^/\s]+:[^@/\s]+@/,
]);

export function containsCredentialShapedContent(source) {
  return forbiddenCredentialPatterns.some(pattern => pattern.test(source));
}
