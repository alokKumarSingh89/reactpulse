export const NETWORK_FINDING_RULE_ID =
  "network.request-failure-observed" as const;
export const NETWORK_FINDING_PRESENTATION = {
  title: "Network request failures observed",
  description:
    "One or more network requests failed during this synthetic scan.",
  recommendation:
    "Investigate the observed request failures and browser/network conditions; this observation does not establish a root cause or user impact.",
} as const;
/** Aggregate evidence only. No URLs, raw errors, or per-request payloads are
 * needed to explain this condition; sample count is deliberately zero. */
export interface NetworkFindingEvidence {
  version: 1;
  context: "SYNTHETIC";
  failureKind: "REQUEST_FAILED";
  observedFailureCount: number;
}
export function projectNetworkFindingEvidence(
  value: unknown,
): NetworkFindingEvidence | null {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const r = value as Record<string, unknown>;
    const count = r.observedFailureCount;
    if (
      r.version !== 1 ||
      r.context !== "SYNTHETIC" ||
      r.failureKind !== "REQUEST_FAILED" ||
      typeof count !== "number" ||
      !Number.isSafeInteger(count) ||
      count <= 0
    )
      return null;
    return {
      version: 1,
      context: "SYNTHETIC",
      failureKind: "REQUEST_FAILED",
      observedFailureCount: count,
    };
  } catch {
    return null;
  }
}
