import type { SecurityAssessmentCoverage } from '@reactpulse/contracts';

// Version 1 presentation allowlist. Never copy persisted free-form prose.
const templates = {
  'security.transport.insecure-final': [
    'HTTP_FINAL_OBSERVED',
    'navigation',
    'Final document used HTTP',
    'The observed final document used unencrypted HTTP transport.',
    'Serve the application over HTTPS and review entry-point redirects.',
  ],
  'security.transport.downgrade': [
    'DOWNGRADE_OBSERVED',
    'navigation',
    'HTTPS to HTTP transition observed',
    'The observed navigation included a transition from HTTPS to HTTP.',
    'Review navigation destinations and retain HTTPS throughout the navigation chain.',
  ],
  'security.transport.insecure-entry': [
    'HTTP_ENTRY_UPGRADED',
    'navigation',
    'HTTP entry upgraded to HTTPS',
    'Navigation began with HTTP before reaching an HTTPS final document.',
    'Use HTTPS entry URLs in links and configuration.',
  ],
  'security.csp.missing': [
    'ENFORCED_CSP_ABSENT',
    'csp',
    'Enforced CSP not observed',
    'No enforced Content-Security-Policy header was observed on the main document.',
    'Design and test an application-specific CSP before enforcing it.',
  ],
  'security.csp.report-only': [
    'REPORT_ONLY_WITHOUT_ENFORCEMENT',
    'csp',
    'CSP is report-only',
    'A report-only CSP was observed without an enforced CSP. Report-only policies do not enforce restrictions.',
    'Review policy reports and test an appropriate enforced policy.',
  ],
  'security.hsts.missing': [
    'HSTS_ABSENT',
    'hsts',
    'HSTS not observed on HTTPS',
    'The HTTPS main document did not include an observed HSTS header.',
    'Review HTTPS deployment readiness before configuring HSTS.',
  ],
  'security.hsts.invalid': [
    'HSTS_INVALID',
    'hsts',
    'HSTS could not be parsed',
    'The passive parser classified the observed HSTS header as invalid.',
    'Review HSTS syntax and provide a valid nonnegative max-age directive.',
  ],
  'security.hsts.disabled': [
    'HSTS_DISABLED',
    'hsts',
    'HSTS max-age is zero',
    'The observed HSTS policy had max-age zero, which removes the stored policy.',
    'Confirm whether disabling HSTS is intentional for this deployment.',
  ],
  'security.content-type-options.missing': [
    'NOSNIFF_ABSENT',
    'contentTypeOptions',
    'Content type options header not observed',
    'No X-Content-Type-Options header was observed on the main document.',
    'Consider nosniff alongside accurate response Content-Type values.',
  ],
  'security.referrer-policy.missing': [
    'REFERRER_HEADER_ABSENT_BROWSER_DEFAULTS_APPLY',
    'referrerPolicy',
    'Explicit Referrer-Policy not observed',
    'No Referrer-Policy header was observed. Browser defaults still apply.',
    'Choose an explicit referrer policy appropriate to the application.',
  ],
  'security.referrer-policy.permissive': [
    'PERMISSIVE_REFERRER_POLICY',
    'referrerPolicy',
    'Permissive referrer policy observed',
    'The normalized referrer policy matches the product policy for permissive referrer disclosure.',
    'Review referrer requirements and consider a more restrictive policy.',
  ],
  'security.permissions-policy.missing': [
    'PERMISSIONS_HEADER_ABSENT_DEFAULTS_APPLY',
    'permissionsPolicy',
    'Explicit Permissions-Policy not observed',
    'No Permissions-Policy header was observed. This does not imply that every browser feature is enabled.',
    'Review feature requirements and explicitly restrict capabilities where appropriate.',
  ],
  'security.frame-protection.missing': [
    'NO_RECOGNIZED_FRAME_RESTRICTION',
    'framing',
    'Recognized framing restriction not observed',
    'Neither a recognized enforced frame-ancestors restriction nor recognized X-Frame-Options protection was observed.',
    'Review embedding requirements and configure an appropriate framing policy.',
  ],
  'security.cookie.secure-missing': [
    'COOKIE_SECURE_ABSENT',
    'cookies',
    'Cookie Secure attribute not observed',
    'An observed response cookie lacked the Secure attribute.',
    'Review whether the cookie should be restricted to HTTPS transport.',
  ],
  'security.cookie.httponly-missing': [
    'COOKIE_HTTPONLY_ABSENT_INTENT_UNKNOWN',
    'cookies',
    'Cookie HttpOnly attribute not observed',
    'An observed response cookie lacked HttpOnly. Script access may be intentional; the cookie purpose is unknown.',
    'Use HttpOnly when application behavior does not require script access.',
  ],
  'security.cookie.samesite-missing': [
    'COOKIE_SAMESITE_ABSENT_DEFAULTS_APPLY',
    'cookies',
    'Explicit cookie SameSite attribute not observed',
    'An observed response cookie lacked an explicit SameSite attribute. Browser defaults may apply.',
    'Choose SameSite explicitly according to cross-site application requirements.',
  ],
  'security.cookie.samesite-none-without-secure': [
    'COOKIE_SAMESITE_NONE_WITHOUT_SECURE',
    'cookies',
    'SameSite=None observed without Secure',
    'An observed response cookie specified SameSite=None without Secure.',
    'Review cookie requirements and pair SameSite=None with Secure where needed.',
  ],
} as const;
const reasons = [
  'MAIN_DOCUMENT_UNAVAILABLE',
  'HEADERS_UNAVAILABLE',
  'COOKIE_OBSERVATION_UNAVAILABLE',
  'NETWORK_OBSERVATION_UNAVAILABLE',
  'INITIATOR_UNKNOWN',
  'NAVIGATION_CHANGED',
  'UNSUPPORTED_SYNTAX',
  'OBSERVATION_LIMIT_REACHED',
  'COLLECTION_FAILED',
] as const;

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function ordinal(value: unknown, limit: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value < limit
  );
}
const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const;
const confidences = ['HIGH', 'MEDIUM', 'LOW'] as const;
const statuses = [
  'OPEN',
  'ACKNOWLEDGED',
  'RESOLVED',
  'IGNORED',
  'REGRESSION',
] as const;
function member<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === 'string' && values.includes(value as T);
}
function projectFinding(value: unknown) {
  const row = record(value);
  if (
    row.category !== 'SECURITY' ||
    typeof row.ruleId !== 'string' ||
    !Object.hasOwn(templates, row.ruleId) ||
    !member(severities, row.severity) ||
    !member(confidences, row.confidence) ||
    !member(statuses, row.status)
  )
    return null;
  const ruleId = row.ruleId as keyof typeof templates;
  const [reason, source, title, description, recommendation] =
    templates[ruleId];
  const evidence = record(row.evidence);
  if (
    evidence.version !== 1 ||
    evidence.ruleVersion !== 1 ||
    evidence.outcome !== 'POSTURE' ||
    evidence.reason !== reason ||
    evidence.source !== source
  )
    return null;
  const input = record(evidence.subject);
  let subject:
    | { kind: 'MAIN_DOCUMENT' }
    | {
        kind: 'COOKIE';
        documentResponseOrdinal: number;
        cookieOrdinal: number;
      };
  let affectedResource: string;
  if (source === 'cookies') {
    if (
      input.kind !== 'COOKIE' ||
      !ordinal(input.documentResponseOrdinal, 32) ||
      !ordinal(input.cookieOrdinal, 100)
    )
      return null;
    subject = {
      kind: 'COOKIE',
      documentResponseOrdinal: input.documentResponseOrdinal,
      cookieOrdinal: input.cookieOrdinal,
    };
    affectedResource = `document:${subject.documentResponseOrdinal}:cookie:${subject.cookieOrdinal}`;
  } else {
    if (input.kind !== 'MAIN_DOCUMENT') return null;
    subject = { kind: 'MAIN_DOCUMENT' };
    affectedResource = 'main-document';
  }
  return {
    ruleId,
    category: 'SECURITY' as const,
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
      outcome: 'POSTURE' as const,
      reason,
      source,
      subject,
    },
  };
}

export interface SecurityReportInput {
  id: string;
  status: string;
  completedAt: Date | null;
  evidence: readonly { data: unknown }[];
  findings: readonly unknown[];
}
type Limitation =
  | 'SCAN_NOT_COMPLETED'
  | 'ASSESSMENT_NOT_PERSISTED'
  | 'INVALID_ASSESSMENT'
  | 'FINDINGS_OMITTED'
  | 'OBSERVATIONS_NOT_PERSISTED';

export function buildSecurityReport(scan: SecurityReportInput) {
  let state: SecurityAssessmentCoverage['state'] | 'NOT_ASSESSED' =
    'UNAVAILABLE';
  let coverage: SecurityAssessmentCoverage | null = null;
  const limitations: Limitation[] = ['OBSERVATIONS_NOT_PERSISTED'];
  let findings: NonNullable<ReturnType<typeof projectFinding>>[] = [];
  if (scan.status !== 'COMPLETED') limitations.push('SCAN_NOT_COMPLETED');
  else if (scan.evidence.length === 0) {
    state = 'NOT_ASSESSED';
    limitations.push('ASSESSMENT_NOT_PERSISTED');
  } else {
    const marker = record(scan.evidence[0]?.data);
    const raw = record(marker.coverage);
    if (
      marker.kind !== 'PASSIVE_SECURITY_ASSESSMENT' ||
      raw.version !== 1 ||
      raw.rulesetVersion !== 1 ||
      !member(['COMPLETE', 'PARTIAL', 'UNAVAILABLE'] as const, raw.state) ||
      !Array.isArray(raw.reasons) ||
      raw.reasons.length > reasons.length ||
      !raw.reasons.every((reason: unknown) => member(reasons, reason))
    ) {
      limitations.push('INVALID_ASSESSMENT');
    } else {
      coverage = {
        version: 1,
        rulesetVersion: 1,
        state: raw.state,
        reasons: reasons.filter((reason) =>
          (raw.reasons as unknown[]).includes(reason),
        ),
      };
      state = coverage.state;
      if (state !== 'UNAVAILABLE') {
        for (const row of scan.findings) {
          const finding = projectFinding(row);
          if (finding) findings.push(finding);
          else if (
            record(row).category === 'SECURITY' &&
            !limitations.includes('FINDINGS_OMITTED')
          )
            limitations.push('FINDINGS_OMITTED');
        }
        if (limitations.includes('FINDINGS_OMITTED')) state = 'PARTIAL';
      }
    }
  }
  const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  findings = findings.sort(
    (a, b) =>
      severities.indexOf(a.severity) - severities.indexOf(b.severity) ||
      compare(a.ruleId, b.ruleId) ||
      compare(a.affectedResource, b.affectedResource) ||
      compare(a.status, b.status) ||
      compare(a.confidence, b.confidence),
  );
  return {
    scan: { id: scan.id, status: scan.status, completedAt: scan.completedAt },
    assessment: { state, coverage, limitations },
    observations: {
      state: 'UNAVAILABLE' as const,
      reason: 'OBSERVATIONS_NOT_PERSISTED' as const,
    },
    findings,
  };
}
