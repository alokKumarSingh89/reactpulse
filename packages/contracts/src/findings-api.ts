import {
  FINDING_CATEGORIES,
  FINDING_SEVERITIES,
  FINDING_CONFIDENCES,
  FINDING_STATUSES,
  projectDeterministicRuleIdentity,
  projectDeterministicFindingCandidate,
  type DeterministicFindingCandidate,
  type FindingCategory,
  type FindingSeverity,
  type FindingConfidence,
  type FindingStatus,
} from "./findings";
export const FINDINGS_PAGE_MAX = 100;
export const FINDINGS_PAGE_DEFAULT = 50;
export interface FindingListQuery {
  limit: number;
  cursor?: string;
  scanId?: string;
  category?: FindingCategory;
  severity?: FindingSeverity;
  confidence?: FindingConfidence;
  status?: FindingStatus;
  ruleId?: string;
}
export type PublicFinding = DeterministicFindingCandidate extends infer C
  ? C extends DeterministicFindingCandidate
    ? Omit<C, "fingerprintIdentity"> & {
        id: string;
        scanId: string;
        status: FindingStatus;
        firstDetectedAt: string;
        lastDetectedAt: string;
        createdAt: string;
        updatedAt: string;
      }
    : never
  : never;
export interface FindingListResponse {
  items: PublicFinding[];
  nextCursor: string | null;
}
export type FindingLifecycleAction = "acknowledge" | "ignore";
export function isFindingUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function projectFindingListQuery(
  value: unknown,
): FindingListQuery | null {
  try {
    const r = record(value);
    if (
      Object.keys(r).some(
        (k) =>
          ![
            "limit",
            "cursor",
            "scanId",
            "category",
            "severity",
            "confidence",
            "status",
            "ruleId",
          ].includes(k),
      )
    )
      return null;
    const limit =
      r.limit === undefined
        ? FINDINGS_PAGE_DEFAULT
        : typeof r.limit === "string" && /^\d{1,3}$/.test(r.limit)
          ? Number(r.limit)
          : r.limit;
    if (
      typeof limit !== "number" ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > FINDINGS_PAGE_MAX
    )
      return null;
    const result: FindingListQuery = { limit };
    if (r.scanId !== undefined) {
      if (!isFindingUuid(r.scanId)) return null;
      result.scanId = r.scanId;
    }
    if (r.cursor !== undefined) {
      if (
        typeof r.cursor !== "string" ||
        !/^[A-Za-z0-9_-]{1,256}$/.test(r.cursor)
      )
        return null;
      result.cursor = r.cursor;
    }
    const category = FINDING_CATEGORIES.find((v) => v === r.category);
    const severity = FINDING_SEVERITIES.find((v) => v === r.severity);
    const confidence = FINDING_CONFIDENCES.find((v) => v === r.confidence);
    const status = FINDING_STATUSES.find((v) => v === r.status);
    if (
      (r.category !== undefined && !category) ||
      (r.severity !== undefined && !severity) ||
      (r.confidence !== undefined && !confidence) ||
      (r.status !== undefined && !status)
    )
      return null;
    if (category) result.category = category;
    if (severity) result.severity = severity;
    if (confidence) result.confidence = confidence;
    if (status) result.status = status;
    if (r.ruleId !== undefined) {
      const identity = FINDING_CATEGORIES.map((c) =>
        projectDeterministicRuleIdentity({
          category: c,
          ruleId: r.ruleId,
          ruleVersion: 1,
        }),
      ).find(Boolean);
      if (!identity) return null;
      result.ruleId = identity.ruleId;
    }
    return result;
  } catch {
    return null;
  }
}
/** Durable rows are untrusted. Rebuild category identity from bounded contract
 * facts, then use the same category validators as scanner candidates. No stored
 * prose, URLs, source paths or internal fingerprint is returned. */
export function projectPublicFinding(value: unknown): PublicFinding | null {
  try {
    const r = record(value),
      e = record(r.evidence);
    const status = FINDING_STATUSES.find((v) => v === r.status);
    if (!isFindingUuid(r.id) || !isFindingUuid(r.scanId) || !status)
      return null;
    const identity = projectDeterministicRuleIdentity({
      category: r.category,
      ruleId: r.ruleId,
      ruleVersion: e.ruleVersion,
    });
    if (!identity) return null;
    const subject =
      identity.category === "SECURITY" ? e.subject : { kind: "MAIN_DOCUMENT" };
    const fingerprintIdentity = {
      ...identity,
      subject,
      ...(identity.category === "ACCESSIBILITY"
        ? {
            engine: e.engine,
            engineRuleId: e.ruleId,
            rulesetVersion: e.rulesetVersion,
            mappingVersion: e.mappingVersion,
            profileId: e.profileId,
          }
        : {}),
      ...(identity.category === "PERFORMANCE" ? { metric: e.metric } : {}),
    };
    const safe = projectDeterministicFindingCandidate({
      ...identity,
      severity: r.severity,
      confidence: r.confidence,
      evidence: e,
      affectedResource: subject,
      fingerprintIdentity,
    });
    if (!safe) return null;
    const date = (v: unknown): string | null => {
      if (
        typeof v !== "string" ||
        !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)
      )
        return null;
      const d = new Date(v);
      return Number.isFinite(d.getTime()) && d.toISOString() === v ? v : null;
    };
    const firstDetectedAt = date(r.firstDetectedAt),
      lastDetectedAt = date(r.lastDetectedAt),
      createdAt = date(r.createdAt),
      updatedAt = date(r.updatedAt);
    if (!firstDetectedAt || !lastDetectedAt || !createdAt || !updatedAt)
      return null;
    const { fingerprintIdentity: internal, ...publicCandidate } = safe;
    void internal;
    return {
      ...publicCandidate,
      id: r.id,
      scanId: r.scanId,
      status,
      firstDetectedAt,
      lastDetectedAt,
      createdAt,
      updatedAt,
    };
  } catch {
    return null;
  }
}
