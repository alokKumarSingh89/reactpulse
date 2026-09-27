const INVALID_URL = '[INVALID_URL]';
const MAX_INPUT_LENGTH = 16_384;
const MAX_PROJECTED_LENGTH = 4_096;

/**
 * Evidence/display projection only, never an execution URL or SSRF decision.
 * Omits paths as well as userinfo, query strings and fragments. Hostnames may
 * still contain identifying data; this is minimization, not anonymization.
 */
export function projectSafeUrlOrigin(rawUrl: string): string {
  const url = parseEvidenceUrl(rawUrl);
  return url ? boundedProjection(url.origin) : INVALID_URL;
}

/**
 * Preserve pathname visibility used by Sprint 11's resource/request tables.
 * Paths remain percent-encoded and may themselves contain secrets. Do not use
 * this compatibility projection for security references: use origin projection
 * or the contract's scan-local ordinal instead. No secret-detection claim is
 * made for arbitrary paths.
 */
export function sanitizeNetworkUrl(rawUrl: string): string {
  const url = parseEvidenceUrl(rawUrl);
  return url ? boundedProjection(`${url.origin}${url.pathname}`) : INVALID_URL;
}

function parseEvidenceUrl(rawUrl: string): URL | null {
  // Bound parsing work and reject unsupported inputs without echoing them.
  if (typeof rawUrl !== 'string' || rawUrl.length > MAX_INPUT_LENGTH) {
    return null;
  }

  try {
    const url = new URL(rawUrl);
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      !url.hostname
    ) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function boundedProjection(value: string): string {
  return value.length <= MAX_PROJECTED_LENGTH ? value : INVALID_URL;
}
