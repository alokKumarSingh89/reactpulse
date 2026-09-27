import {
  PERFORMANCE_FINDING_RULES,
  projectPerformanceFindingEvidence,
  type PerformanceFindingRuleId,
  type PerformanceFindingMetric,
  type PerformanceFindingEvidence,
} from "./performance-findings";
import {
  ACCESSIBILITY_RULE_IDS,
  type AccessibilityRuleId,
} from "./accessibility";
import {
  ACCESSIBILITY_REPORT_PRESENTATION,
  projectAccessibilityReportFinding,
  type AccessibilityReportFinding,
} from "./accessibility-report";
import {
  SECURITY_FINDING_PRESENTATION,
  projectSecurityFinding,
} from "./security-report";

// Exact Prisma vocabularies, without importing the database/runtime into shared
// contracts. Category support is narrower than the database vocabulary below.
export const FINDING_CATEGORIES = [
  "PERFORMANCE",
  "NETWORK",
  "RESOURCE",
  "BUNDLE",
  "REACT",
  "ACCESSIBILITY",
  "SECURITY",
  "DEPENDENCY",
  "MEMORY",
] as const;
export const FINDING_SEVERITIES = [
  "INFO",
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
] as const;
export const FINDING_CONFIDENCES = ["LOW", "MEDIUM", "HIGH"] as const;
export const FINDING_STATUSES = [
  "OPEN",
  "ACKNOWLEDGED",
  "RESOLVED",
  "IGNORED",
  "REGRESSION",
] as const;
export type FindingCategory = (typeof FINDING_CATEGORIES)[number];
/** Potential impact, never probability, confidence, or a numeric score. */
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];
/** Certainty supported by evidence, independent of severity; no percentages. */
export type FindingConfidence = (typeof FINDING_CONFIDENCES)[number];
/** Persisted lifecycle only. Never part of a deterministic rule/candidate. */
export type FindingStatus = (typeof FINDING_STATUSES)[number];
export type DeterministicFindingCategory = Extract<
  FindingCategory,
  "SECURITY" | "ACCESSIBILITY" | "PERFORMANCE" | "NETWORK" | "RESOURCE"
>;

/** Integer 1..65535, matching existing accessibility version bounds. Semantic
 * changes to thresholds, interpretation, impact, identity or recommendation
 * meaning require a new version. Package versions and cosmetic edits do not. */
export type FindingRuleVersion = number;
export const FINDING_RULE_VERSION_MAX = 65535;
export type SecurityFindingRuleId = keyof typeof SECURITY_FINDING_PRESENTATION;
export type AccessibilityFindingRuleId =
  `accessibility.axe-core.${AccessibilityRuleId}`;
export type DeterministicRuleIdentity =
  | {
      category: "PERFORMANCE";
      ruleId: PerformanceFindingRuleId;
      ruleVersion: FindingRuleVersion;
    }
  | {
      category: "SECURITY";
      ruleId: SecurityFindingRuleId;
      ruleVersion: FindingRuleVersion;
    }
  | {
      category: "ACCESSIBILITY";
      ruleId: AccessibilityFindingRuleId;
      ruleVersion: FindingRuleVersion;
    };

// Only reviewed, application-owned IDs are executable identities. Future
// NETWORK/RESOURCE rules must add their concrete registries and
// evidence union branches; a category name alone does not authorize a rule.
const accessibilityIds = ACCESSIBILITY_RULE_IDS.map(
  (id) => `accessibility.axe-core.${id}` as const,
);
const securityIds = Object.keys(
  SECURITY_FINDING_PRESENTATION,
) as SecurityFindingRuleId[];
const performanceIds = Object.keys(
  PERFORMANCE_FINDING_RULES,
) as PerformanceFindingRuleId[];
const prose = [
  ...Object.values(PERFORMANCE_FINDING_RULES).map((v) => [
    v.title,
    v.description,
    v.recommendation,
  ]),
  ...Object.values(SECURITY_FINDING_PRESENTATION).map((v) => [
    v[2],
    v[3],
    v[4],
  ]),
  ...Object.values(ACCESSIBILITY_REPORT_PRESENTATION),
];
/** Finite bounds derived from reviewed catalogs, not silent truncation or new
 * arbitrary per-category limits. Adding longer copy is a reviewed catalog edit. */
export const FINDING_CATALOG_LIMITS = {
  ruleId: Math.max(
    ...performanceIds.map((id) => id.length),
    ...securityIds.map((id) => id.length),
    ...accessibilityIds.map((id) => id.length),
  ),
  title: Math.max(...prose.map((v) => v[0].length)),
  description: Math.max(...prose.map((v) => v[1].length)),
  recommendation: Math.max(...prose.map((v) => v[2].length)),
} as const;
export type DeterministicRuleDefinition = DeterministicRuleIdentity & {
  title: string;
  description: string;
  recommendation: string;
};
// Severity/confidence belong to evaluated candidates: accessibility impact and
// security observation quality can select different policies for one category.
type SecurityEvidence = NonNullable<
  ReturnType<typeof projectSecurityFinding>
>["evidence"];
export type SafeFindingResource = SecurityEvidence["subject"];
export type MainDocumentFindingResource = Extract<
  SafeFindingResource,
  { kind: "MAIN_DOCUMENT" }
>;

/** No URLs, engine version strings, raw evidence, scan IDs, counts, DOM hashes,
 * timestamps or random values. Cookie ordinals are scan-local, not a claim of
 * stable cross-scan cookie identity. Future comparisons also need tenant/context. */
export type FindingFingerprintIdentity =
  | (Extract<DeterministicRuleIdentity, { category: "PERFORMANCE" }> & {
      subject: MainDocumentFindingResource;
      metric: PerformanceFindingMetric;
    })
  | (Extract<DeterministicRuleIdentity, { category: "SECURITY" }> & {
      subject: SafeFindingResource;
    })
  | (Extract<DeterministicRuleIdentity, { category: "ACCESSIBILITY" }> & {
      subject: MainDocumentFindingResource;
      engine: "axe-core";
      engineRuleId: AccessibilityRuleId;
      rulesetVersion: FindingRuleVersion;
      mappingVersion: FindingRuleVersion;
      profileId: "main-document-v1";
    });

export interface FindingEvidenceByCategory {
  PERFORMANCE: PerformanceFindingEvidence;
  SECURITY: SecurityEvidence;
  ACCESSIBILITY: AccessibilityReportFinding["evidence"];
}
// A mapped union, not a loose generic: category/evidence/identity cannot be
// independently widened into incompatible combinations.
export type DeterministicFindingCandidate = {
  [C in keyof FindingEvidenceByCategory]: Extract<
    DeterministicRuleIdentity,
    { category: C }
  > & {
    severity: FindingSeverity;
    confidence: FindingConfidence;
    title: string;
    description: string;
    recommendation: string;
    affectedResource: C extends "SECURITY"
      ? SafeFindingResource
      : MainDocumentFindingResource;
    fingerprintIdentity: Extract<FindingFingerprintIdentity, { category: C }>;
    evidence: FindingEvidenceByCategory[C];
  };
}[keyof FindingEvidenceByCategory];

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function version(value: unknown): value is FindingRuleVersion {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 1 &&
    value <= FINDING_RULE_VERSION_MAX
  );
}
export function projectDeterministicRuleIdentity(
  value: unknown,
): DeterministicRuleIdentity | null {
  try {
    const r = record(value);
    if (
      !version(r.ruleVersion) ||
      typeof r.ruleId !== "string" ||
      r.ruleId.length > FINDING_CATALOG_LIMITS.ruleId
    )
      return null;
    if (r.category === "PERFORMANCE") {
      const ruleId = performanceIds.find((id) => id === r.ruleId);
      return ruleId
        ? { category: "PERFORMANCE", ruleId, ruleVersion: r.ruleVersion }
        : null;
    }
    if (r.category === "SECURITY") {
      const ruleId = securityIds.find((id) => id === r.ruleId);
      return ruleId
        ? { category: "SECURITY", ruleId, ruleVersion: r.ruleVersion }
        : null;
    }
    if (r.category === "ACCESSIBILITY") {
      const ruleId = accessibilityIds.find((id) => id === r.ruleId);
      return ruleId
        ? { category: "ACCESSIBILITY", ruleId, ruleVersion: r.ruleVersion }
        : null;
    }
    return null;
  } catch {
    return null;
  }
}
/** Version-1 presentation comes from existing catalogs, never caller/engine
 * prose. Unsupported semantic versions fail closed until explicitly reviewed. */
export function projectDeterministicRuleDefinition(
  value: unknown,
): DeterministicRuleDefinition | null {
  const identity = projectDeterministicRuleIdentity(value);
  if (!identity || identity.ruleVersion !== 1) return null;
  if (identity.category === "PERFORMANCE") {
    const { title, description, recommendation } =
      PERFORMANCE_FINDING_RULES[identity.ruleId];
    return { ...identity, title, description, recommendation };
  }
  if (identity.category === "SECURITY") {
    const [, , title, description, recommendation] =
      SECURITY_FINDING_PRESENTATION[identity.ruleId];
    return {
      category: identity.category,
      ruleId: identity.ruleId,
      ruleVersion: identity.ruleVersion,
      title,
      description,
      recommendation,
    };
  }
  const engineRuleId = ACCESSIBILITY_RULE_IDS.find(
    (id) => `accessibility.axe-core.${id}` === identity.ruleId,
  );
  if (!engineRuleId) return null;
  const [title, description, recommendation] =
    ACCESSIBILITY_REPORT_PRESENTATION[engineRuleId];
  return {
    category: identity.category,
    ruleId: identity.ruleId,
    ruleVersion: identity.ruleVersion,
    title,
    description,
    recommendation,
  };
}
export function projectFindingFingerprintIdentity(
  value: unknown,
): FindingFingerprintIdentity | null {
  try {
    const r = record(value),
      identity = projectDeterministicRuleIdentity(r),
      subject = record(r.subject);
    if (!identity) return null;
    if (identity.category === "PERFORMANCE") {
      const metric = PERFORMANCE_FINDING_RULES[identity.ruleId].metric;
      if (subject.kind !== "MAIN_DOCUMENT" || r.metric !== metric) return null;
      return { ...identity, subject: { kind: "MAIN_DOCUMENT" }, metric };
    }
    if (identity.category === "SECURITY") {
      const cookie =
        SECURITY_FINDING_PRESENTATION[identity.ruleId][1] === "cookies";
      if (cookie) {
        const response = subject.documentResponseOrdinal,
          ordinal = subject.cookieOrdinal;
        if (
          subject.kind !== "COOKIE" ||
          typeof response !== "number" ||
          !Number.isSafeInteger(response) ||
          response < 0 ||
          response >= 32 ||
          typeof ordinal !== "number" ||
          !Number.isSafeInteger(ordinal) ||
          ordinal < 0 ||
          ordinal >= 100
        )
          return null;
        return {
          category: identity.category,
          ruleId: identity.ruleId,
          ruleVersion: identity.ruleVersion,
          subject: {
            kind: "COOKIE",
            documentResponseOrdinal: response,
            cookieOrdinal: ordinal,
          },
        };
      }
      if (subject.kind !== "MAIN_DOCUMENT") return null;
      return {
        category: identity.category,
        ruleId: identity.ruleId,
        ruleVersion: identity.ruleVersion,
        subject: { kind: "MAIN_DOCUMENT" },
      };
    }
    const engineRuleId = ACCESSIBILITY_RULE_IDS.find(
      (id) =>
        id === r.engineRuleId &&
        `accessibility.axe-core.${id}` === identity.ruleId,
    );
    if (
      !engineRuleId ||
      subject.kind !== "MAIN_DOCUMENT" ||
      r.engine !== "axe-core" ||
      r.profileId !== "main-document-v1" ||
      !version(r.rulesetVersion) ||
      !version(r.mappingVersion)
    )
      return null;
    return {
      category: identity.category,
      ruleId: identity.ruleId,
      ruleVersion: identity.ruleVersion,
      subject: { kind: "MAIN_DOCUMENT" },
      engine: "axe-core",
      engineRuleId,
      rulesetVersion: r.rulesetVersion,
      mappingVersion: r.mappingVersion,
      profileId: "main-document-v1",
    };
  } catch {
    return null;
  }
}
function sameResource(a: SafeFindingResource, b: SafeFindingResource): boolean {
  return (
    a.kind === b.kind &&
    (a.kind === "MAIN_DOCUMENT" ||
      (b.kind === "COOKIE" &&
        a.documentResponseOrdinal === b.documentResponseOrdinal &&
        a.cookieOrdinal === b.cookieOrdinal))
  );
}
/** Explicit privacy projection. Existing category validators retain ownership of
 * evidence.version (serialization), distinct from semantic ruleVersion and the
 * accessibility ruleset/mapping versions. No hashing, evaluation or persistence. */
export function projectDeterministicFindingCandidate(
  value: unknown,
): DeterministicFindingCandidate | null {
  try {
    const input = record(value),
      identity = projectDeterministicRuleIdentity(input);
    const fingerprint = projectFindingFingerprintIdentity(
      input.fingerprintIdentity,
    );
    if (
      !identity ||
      identity.ruleVersion !== 1 ||
      !fingerprint ||
      fingerprint.category !== identity.category ||
      fingerprint.ruleId !== identity.ruleId ||
      fingerprint.ruleVersion !== identity.ruleVersion
    )
      return null;
    // Validate resource through the same identity allowlist, not a raw URL parser.
    const resource = record(input.affectedResource);
    if (
      resource.kind !== fingerprint.subject.kind ||
      (fingerprint.subject.kind === "COOKIE" &&
        (resource.documentResponseOrdinal !==
          fingerprint.subject.documentResponseOrdinal ||
          resource.cookieOrdinal !== fingerprint.subject.cookieOrdinal))
    )
      return null;
    if (
      identity.category === "PERFORMANCE" &&
      fingerprint.category === "PERFORMANCE"
    ) {
      const evidence = projectPerformanceFindingEvidence(input.evidence);
      if (
        !evidence ||
        evidence.metric !== fingerprint.metric ||
        input.severity !== "MEDIUM" ||
        input.confidence !== "HIGH"
      )
        return null;
      const { title, description, recommendation } =
        PERFORMANCE_FINDING_RULES[identity.ruleId];
      return {
        ...identity,
        severity: "MEDIUM",
        confidence: "HIGH",
        title,
        description,
        recommendation,
        affectedResource: { kind: "MAIN_DOCUMENT" },
        fingerprintIdentity: fingerprint,
        evidence,
      };
    }
    const categoryInput = {
      category: identity.category,
      ruleId: identity.ruleId,
      severity: input.severity,
      confidence: input.confidence,
      status: "OPEN",
      evidence: input.evidence,
    };
    if (
      identity.category === "SECURITY" &&
      fingerprint.category === "SECURITY"
    ) {
      const safe = projectSecurityFinding(categoryInput);
      if (!safe || !sameResource(safe.evidence.subject, fingerprint.subject))
        return null;
      return {
        category: "SECURITY",
        ruleId: safe.ruleId,
        ruleVersion: identity.ruleVersion,
        severity: safe.severity,
        confidence: safe.confidence,
        title: safe.title,
        description: safe.description,
        recommendation: safe.recommendation,
        affectedResource: safe.evidence.subject,
        fingerprintIdentity: fingerprint,
        evidence: safe.evidence,
      };
    }
    if (
      identity.category === "ACCESSIBILITY" &&
      fingerprint.category === "ACCESSIBILITY"
    ) {
      const safe = projectAccessibilityReportFinding(categoryInput);
      if (
        !safe ||
        safe.evidence.rulesetVersion !== fingerprint.rulesetVersion ||
        safe.evidence.mappingVersion !== fingerprint.mappingVersion
      )
        return null;
      return {
        category: "ACCESSIBILITY",
        ruleId: safe.ruleId,
        ruleVersion: identity.ruleVersion,
        severity: safe.severity,
        confidence: safe.confidence,
        title: safe.title,
        description: safe.description,
        recommendation: safe.recommendation,
        affectedResource: { kind: "MAIN_DOCUMENT" },
        fingerprintIdentity: fingerprint,
        evidence: safe.evidence,
      };
    }
    return null;
  } catch {
    return null;
  }
}
