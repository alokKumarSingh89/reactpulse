import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Prisma } from '@reactpulse/database';
import { DatabaseService } from '../database/database.service';
import {
  SECURITY_RULE_POLICY,
  SECURITY_RULE_VERSION,
  type SecurityRuleEvaluation,
  type SecurityRuleId,
  type SecurityRuleReason,
  type SecurityRuleResult,
} from './security-rules';

// DOCUMENT_RESPONSE sequence 0 is the existing document summary. Sequence 1 is
// reserved for passive-security coverage, even when no document was observable.
// This marker is not a Finding and must survive a zero-finding reconciliation.
const ASSESSMENT_SEQUENCE = 1;
type Template = readonly [
  SecurityRuleReason,
  SecurityRuleResult['evidence']['source'],
  string,
  string,
  string,
];
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
} as const satisfies Partial<Record<SecurityRuleId, Template>>;
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

function projectFinding(
  scanId: string,
  result: SecurityRuleResult,
): Prisma.FindingCreateManyInput | null {
  if (result.outcome !== 'POSTURE') return null;
  if (
    !Object.hasOwn(templates, result.ruleId) ||
    result.ruleVersion !== SECURITY_RULE_VERSION
  )
    throw new Error('Unsupported security finding result');
  const ruleId = result.ruleId as keyof typeof templates;
  const [reason, source, title, description, recommendation] =
    templates[ruleId];
  const [severity, confidence] = SECURITY_RULE_POLICY[ruleId];
  // Validate the evaluator's mapping, never upgrade/reinterpret an outcome.
  if (
    result.reason !== reason ||
    result.evidence.source !== source ||
    result.severity !== severity ||
    result.confidence !== confidence
  )
    throw new Error('Invalid security finding result');
  const subject = result.evidence.subject;
  let affectedResource: string;
  let safeSubject: Prisma.InputJsonObject;
  if (source === 'cookies') {
    if (
      subject.kind !== 'COOKIE' ||
      !Number.isSafeInteger(subject.documentResponseOrdinal) ||
      subject.documentResponseOrdinal < 0 ||
      subject.documentResponseOrdinal >= 32 ||
      !Number.isSafeInteger(subject.cookieOrdinal) ||
      subject.cookieOrdinal < 0 ||
      subject.cookieOrdinal >= 100
    )
      throw new Error('Invalid security finding subject');
    affectedResource = `document:${subject.documentResponseOrdinal}:cookie:${subject.cookieOrdinal}`;
    safeSubject = {
      kind: 'COOKIE',
      documentResponseOrdinal: subject.documentResponseOrdinal,
      cookieOrdinal: subject.cookieOrdinal,
    };
  } else {
    if (subject.kind !== 'MAIN_DOCUMENT')
      throw new Error('Invalid security finding subject');
    affectedResource = 'main-document';
    safeSubject = { kind: 'MAIN_DOCUMENT' };
  }
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify([
        'SECURITY',
        ruleId,
        SECURITY_RULE_VERSION,
        affectedResource,
      ]),
    )
    .digest('hex');
  return {
    scanId,
    category: 'SECURITY',
    ruleId,
    fingerprint,
    severity,
    confidence,
    status: 'OPEN',
    title,
    description,
    recommendation,
    affectedUrl: null,
    affectedResource,
    evidence: {
      version: 1,
      ruleVersion: SECURITY_RULE_VERSION,
      outcome: 'POSTURE',
      reason,
      source,
      subject: safeSubject,
    },
  };
}

@Injectable()
export class SecurityFindingService {
  constructor(private readonly database: DatabaseService) {}

  async replaceForScan(
    scanId: string,
    evaluation: SecurityRuleEvaluation | null,
  ): Promise<void> {
    if (
      evaluation &&
      (evaluation.results.length > 12816 ||
        evaluation.coverage.version !== 1 ||
        evaluation.coverage.rulesetVersion !== SECURITY_RULE_VERSION ||
        !['COMPLETE', 'PARTIAL', 'UNAVAILABLE'].includes(
          evaluation.coverage.state,
        ))
    )
      throw new Error('Invalid security assessment');
    const rows = new Map<string, Prisma.FindingCreateManyInput>();
    for (const result of evaluation?.results ?? []) {
      const row = projectFinding(scanId, result);
      if (row) rows.set(row.fingerprint, row);
    }
    const marker = evaluation
      ? {
          kind: 'PASSIVE_SECURITY_ASSESSMENT',
          coverage: {
            version: 1,
            rulesetVersion: SECURITY_RULE_VERSION,
            state: evaluation.coverage.state,
            reasons: reasons.filter((reason) =>
              evaluation.coverage.reasons.includes(reason),
            ),
          },
        }
      : null;
    await this.database.client.$transaction(async (tx) => {
      await tx.finding.deleteMany({ where: { scanId, category: 'SECURITY' } });
      if (rows.size) await tx.finding.createMany({ data: [...rows.values()] });
      if (marker) {
        await tx.scanEvidence.upsert({
          where: {
            scanId_type_sequence: {
              scanId,
              type: 'DOCUMENT_RESPONSE',
              sequence: ASSESSMENT_SEQUENCE,
            },
          },
          create: {
            scanId,
            type: 'DOCUMENT_RESPONSE',
            sequence: ASSESSMENT_SEQUENCE,
            data: marker,
          },
          update: { data: marker },
        });
      } else {
        // Absent browser assessment is distinct from assessed with zero findings.
        await tx.scanEvidence.deleteMany({
          where: {
            scanId,
            type: 'DOCUMENT_RESPONSE',
            sequence: ASSESSMENT_SEQUENCE,
          },
        });
      }
    });
  }
}
