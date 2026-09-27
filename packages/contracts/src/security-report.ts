import type { SecurityAssessmentCoverage } from "./security";
// Version 1 presentation allowlist. Never copy persisted free-form prose.
export const SECURITY_FINDING_PRESENTATION = {
  "security.transport.insecure-final": [
    "HTTP_FINAL_OBSERVED",
    "navigation",
    "Final document used HTTP",
    "The observed final document used unencrypted HTTP transport.",
    "Serve the application over HTTPS and review entry-point redirects.",
  ],
  "security.transport.downgrade": [
    "DOWNGRADE_OBSERVED",
    "navigation",
    "HTTPS to HTTP transition observed",
    "The observed navigation included a transition from HTTPS to HTTP.",
    "Review navigation destinations and retain HTTPS throughout the navigation chain.",
  ],
  "security.transport.insecure-entry": [
    "HTTP_ENTRY_UPGRADED",
    "navigation",
    "HTTP entry upgraded to HTTPS",
    "Navigation began with HTTP before reaching an HTTPS final document.",
    "Use HTTPS entry URLs in links and configuration.",
  ],
  "security.csp.missing": [
    "ENFORCED_CSP_ABSENT",
    "csp",
    "Enforced CSP not observed",
    "No enforced Content-Security-Policy header was observed on the main document.",
    "Design and test an application-specific CSP before enforcing it.",
  ],
  "security.csp.report-only": [
    "REPORT_ONLY_WITHOUT_ENFORCEMENT",
    "csp",
    "CSP is report-only",
    "A report-only CSP was observed without an enforced CSP. Report-only policies do not enforce restrictions.",
    "Review policy reports and test an appropriate enforced policy.",
  ],
  "security.hsts.missing": [
    "HSTS_ABSENT",
    "hsts",
    "HSTS not observed on HTTPS",
    "The HTTPS main document did not include an observed HSTS header.",
    "Review HTTPS deployment readiness before configuring HSTS.",
  ],
  "security.hsts.invalid": [
    "HSTS_INVALID",
    "hsts",
    "HSTS could not be parsed",
    "The passive parser classified the observed HSTS header as invalid.",
    "Review HSTS syntax and provide a valid nonnegative max-age directive.",
  ],
  "security.hsts.disabled": [
    "HSTS_DISABLED",
    "hsts",
    "HSTS max-age is zero",
    "The observed HSTS policy had max-age zero, which removes the stored policy.",
    "Confirm whether disabling HSTS is intentional for this deployment.",
  ],
  "security.content-type-options.missing": [
    "NOSNIFF_ABSENT",
    "contentTypeOptions",
    "Content type options header not observed",
    "No X-Content-Type-Options header was observed on the main document.",
    "Consider nosniff alongside accurate response Content-Type values.",
  ],
  "security.referrer-policy.missing": [
    "REFERRER_HEADER_ABSENT_BROWSER_DEFAULTS_APPLY",
    "referrerPolicy",
    "Explicit Referrer-Policy not observed",
    "No Referrer-Policy header was observed. Browser defaults still apply.",
    "Choose an explicit referrer policy appropriate to the application.",
  ],
  "security.referrer-policy.permissive": [
    "PERMISSIVE_REFERRER_POLICY",
    "referrerPolicy",
    "Permissive referrer policy observed",
    "The normalized referrer policy matches the product policy for permissive referrer disclosure.",
    "Review referrer requirements and consider a more restrictive policy.",
  ],
  "security.permissions-policy.missing": [
    "PERMISSIONS_HEADER_ABSENT_DEFAULTS_APPLY",
    "permissionsPolicy",
    "Explicit Permissions-Policy not observed",
    "No Permissions-Policy header was observed. This does not imply that every browser feature is enabled.",
    "Review feature requirements and explicitly restrict capabilities where appropriate.",
  ],
  "security.frame-protection.missing": [
    "NO_RECOGNIZED_FRAME_RESTRICTION",
    "framing",
    "Recognized framing restriction not observed",
    "Neither a recognized enforced frame-ancestors restriction nor recognized X-Frame-Options protection was observed.",
    "Review embedding requirements and configure an appropriate framing policy.",
  ],
  "security.cookie.secure-missing": [
    "COOKIE_SECURE_ABSENT",
    "cookies",
    "Cookie Secure attribute not observed",
    "An observed response cookie lacked the Secure attribute.",
    "Review whether the cookie should be restricted to HTTPS transport.",
  ],
  "security.cookie.httponly-missing": [
    "COOKIE_HTTPONLY_ABSENT_INTENT_UNKNOWN",
    "cookies",
    "Cookie HttpOnly attribute not observed",
    "An observed response cookie lacked HttpOnly. Script access may be intentional; the cookie purpose is unknown.",
    "Use HttpOnly when application behavior does not require script access.",
  ],
  "security.cookie.samesite-missing": [
    "COOKIE_SAMESITE_ABSENT_DEFAULTS_APPLY",
    "cookies",
    "Explicit cookie SameSite attribute not observed",
    "An observed response cookie lacked an explicit SameSite attribute. Browser defaults may apply.",
    "Choose SameSite explicitly according to cross-site application requirements.",
  ],
  "security.cookie.samesite-none-without-secure": [
    "COOKIE_SAMESITE_NONE_WITHOUT_SECURE",
    "cookies",
    "SameSite=None observed without Secure",
    "An observed response cookie specified SameSite=None without Secure.",
    "Review cookie requirements and pair SameSite=None with Secure where needed.",
  ],
} as const;
export const SECURITY_COVERAGE_REASONS = [
  "MAIN_DOCUMENT_UNAVAILABLE",
  "HEADERS_UNAVAILABLE",
  "COOKIE_OBSERVATION_UNAVAILABLE",
  "NETWORK_OBSERVATION_UNAVAILABLE",
  "INITIATOR_UNKNOWN",
  "NAVIGATION_CHANGED",
  "UNSUPPORTED_SYNTAX",
  "OBSERVATION_LIMIT_REACHED",
  "COLLECTION_FAILED",
] as const;

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function ordinal(value: unknown, limit: number): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value < limit
  );
}
const severities = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const;
const confidences = ["HIGH", "MEDIUM", "LOW"] as const;
const statuses = [
  "OPEN",
  "ACKNOWLEDGED",
  "RESOLVED",
  "IGNORED",
  "REGRESSION",
] as const;
function member<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === "string" && values.includes(value as T);
}
export function projectSecurityFinding(value: unknown) {
  const row = record(value);
  if (
    row.category !== "SECURITY" ||
    typeof row.ruleId !== "string" ||
    !Object.hasOwn(SECURITY_FINDING_PRESENTATION, row.ruleId) ||
    !member(severities, row.severity) ||
    !member(confidences, row.confidence) ||
    !member(statuses, row.status)
  )
    return null;
  const ruleId = row.ruleId as keyof typeof SECURITY_FINDING_PRESENTATION;
  const [reason, source, title, description, recommendation] =
    SECURITY_FINDING_PRESENTATION[ruleId];
  const evidence = record(row.evidence);
  if (
    evidence.version !== 1 ||
    evidence.ruleVersion !== 1 ||
    evidence.outcome !== "POSTURE" ||
    evidence.reason !== reason ||
    evidence.source !== source
  )
    return null;
  const input = record(evidence.subject);
  let subject:
    | { kind: "MAIN_DOCUMENT" }
    | {
        kind: "COOKIE";
        documentResponseOrdinal: number;
        cookieOrdinal: number;
      };
  let affectedResource: string;
  if (source === "cookies") {
    if (
      input.kind !== "COOKIE" ||
      !ordinal(input.documentResponseOrdinal, 32) ||
      !ordinal(input.cookieOrdinal, 100)
    )
      return null;
    subject = {
      kind: "COOKIE",
      documentResponseOrdinal: input.documentResponseOrdinal,
      cookieOrdinal: input.cookieOrdinal,
    };
    affectedResource = `document:${subject.documentResponseOrdinal}:cookie:${subject.cookieOrdinal}`;
  } else {
    if (input.kind !== "MAIN_DOCUMENT") return null;
    subject = { kind: "MAIN_DOCUMENT" };
    affectedResource = "main-document";
  }
  return {
    ruleId,
    category: "SECURITY" as const,
    severity: row.severity,
    confidence: row.confidence,
    status: row.status,
    title,
    description,
    recommendation,
    affectedResource,
    evidence: {
      version: 1,
      ruleVersion: 1,
      outcome: "POSTURE" as const,
      reason,
      source,
      subject,
    },
  };
}

const reportLimitations = [
  "SCAN_NOT_COMPLETED",
  "ASSESSMENT_NOT_PERSISTED",
  "INVALID_ASSESSMENT",
  "FINDINGS_OMITTED",
  "OBSERVATIONS_NOT_PERSISTED",
] as const;
const assessmentStates = [
  "COMPLETE",
  "PARTIAL",
  "UNAVAILABLE",
  "NOT_ASSESSED",
] as const;
const scanStatuses = [
  "PENDING",
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;
/** Re-project transport JSON at BFF/client boundaries. Never pass raw nested JSON. */
export function projectSecurityReport(value: unknown) {
  const input = record(value),
    scan = record(input.scan),
    assessment = record(input.assessment);
  const observations = record(input.observations);
  if (
    typeof scan.id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scan.id) ||
    !member(scanStatuses, scan.status) ||
    !member(assessmentStates, assessment.state) ||
    !Array.isArray(assessment.limitations) ||
    assessment.limitations.length > reportLimitations.length ||
    !assessment.limitations.every((v) => member(reportLimitations, v)) ||
    !Array.isArray(input.findings) ||
    input.findings.length > 12816 ||
    observations.state !== "UNAVAILABLE" ||
    observations.reason !== "OBSERVATIONS_NOT_PERSISTED" ||
    (scan.completedAt !== null &&
      (typeof scan.completedAt !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(
          scan.completedAt,
        ) ||
        !Number.isFinite(Date.parse(scan.completedAt))))
  )
    return null;
  let coverage: SecurityAssessmentCoverage | null = null;
  if (assessment.coverage !== null) {
    const c = record(assessment.coverage);
    if (
      c.version !== 1 ||
      c.rulesetVersion !== 1 ||
      !member(["COMPLETE", "PARTIAL", "UNAVAILABLE"] as const, c.state) ||
      !Array.isArray(c.reasons) ||
      c.reasons.length > SECURITY_COVERAGE_REASONS.length ||
      !c.reasons.every((v) => member(SECURITY_COVERAGE_REASONS, v))
    )
      return null;
    coverage = {
      version: 1,
      rulesetVersion: 1,
      state: c.state,
      reasons: SECURITY_COVERAGE_REASONS.filter((r) =>
        (c.reasons as unknown[]).includes(r),
      ),
    };
  }
  if (
    (assessment.state === "COMPLETE" || assessment.state === "PARTIAL") &&
    (!coverage || scan.status !== "COMPLETED")
  )
    return null;
  if (
    (assessment.state === "NOT_ASSESSED" ||
      assessment.state === "UNAVAILABLE") &&
    input.findings.length
  )
    return null;
  if (assessment.state === 'NOT_ASSESSED' && (coverage !== null || scan.status !== 'COMPLETED')) return null;
  if (assessment.state === 'COMPLETE' && coverage?.state !== 'COMPLETE') return null;
  if (assessment.state === 'PARTIAL' && coverage?.state === 'UNAVAILABLE') return null;
  if (scan.status !== 'COMPLETED' && (assessment.state !== 'UNAVAILABLE' || coverage !== null)) return null;
  const findings = input.findings.map(projectSecurityFinding);
  if (findings.some((f) => !f)) return null;
  return {
    scan: {
      id: scan.id,
      status: scan.status,
      completedAt: scan.completedAt as string | null,
    },
    assessment: {
      state: assessment.state,
      coverage,
      limitations: reportLimitations.filter((r) =>
        (assessment.limitations as unknown[]).includes(r),
      ),
    },
    observations: {
      state: "UNAVAILABLE" as const,
      reason: "OBSERVATIONS_NOT_PERSISTED" as const,
    },
    findings: findings.filter((f): f is NonNullable<typeof f> => f !== null),
  };
}
export type SecurityReportResponse = NonNullable<
  ReturnType<typeof projectSecurityReport>
>;
