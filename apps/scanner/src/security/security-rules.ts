import type {
  PassiveSecurityAssessment,
  SecurityAssessmentCoverage,
  SecurityCoverageReason,
  SecurityHeaderObservation,
} from '@reactpulse/contracts';
// Erased imports: reuse the existing enums without loading Prisma/database code.
import type { FindingSeverity, FindingConfidence } from '@reactpulse/database';

export const SECURITY_RULE_VERSION = 1 as const;
/** Product posture policy, not exploitability, compliance, or a security score. */
export const SECURITY_RULE_POLICY = {
  'security.transport.insecure-final': ['MEDIUM', 'HIGH'],
  'security.transport.downgrade': ['MEDIUM', 'HIGH'],
  'security.transport.insecure-entry': ['LOW', 'HIGH'],
  'security.transport.https-final': ['INFO', 'HIGH'],
  'security.mixed-content.assessment': ['INFO', 'LOW'],
  'security.csp.missing': ['LOW', 'MEDIUM'],
  'security.csp.report-only': ['LOW', 'MEDIUM'],
  'security.hsts.missing': ['LOW', 'MEDIUM'],
  'security.hsts.invalid': ['LOW', 'LOW'],
  'security.hsts.disabled': ['LOW', 'MEDIUM'],
  'security.content-type-options.missing': ['LOW', 'MEDIUM'],
  'security.referrer-policy.missing': ['INFO', 'LOW'],
  'security.referrer-policy.permissive': ['LOW', 'MEDIUM'],
  'security.permissions-policy.missing': ['INFO', 'LOW'],
  'security.frame-protection.missing': ['LOW', 'LOW'],
  'security.cookie.assessment': ['INFO', 'LOW'],
  'security.cookie.secure-missing': ['LOW', 'MEDIUM'],
  'security.cookie.httponly-missing': ['INFO', 'LOW'],
  'security.cookie.samesite-missing': ['INFO', 'LOW'],
  'security.cookie.samesite-none-without-secure': ['MEDIUM', 'MEDIUM'],
} as const satisfies Record<
  string,
  readonly [FindingSeverity, FindingConfidence]
>;
export type SecurityRuleId = keyof typeof SECURITY_RULE_POLICY;
export type SecurityRuleOutcome =
  'POSTURE' | 'OBSERVED' | 'UNCERTAIN' | 'NOT_ASSESSED' | 'NOT_APPLICABLE';
export type SecurityRuleReason =
  | 'OBSERVATION_UNAVAILABLE'
  | 'OBSERVATION_PARTIAL'
  | 'OBSERVATION_UNSUPPORTED'
  | 'UNSUPPORTED_VERSION'
  | 'CONDITION_NOT_OBSERVED'
  | 'HTTP_FINAL_OBSERVED'
  | 'DOWNGRADE_OBSERVED'
  | 'HTTP_ENTRY_UPGRADED'
  | 'HTTPS_FINAL_OBSERVED'
  | 'PROVENANCE_UNAVAILABLE'
  | 'ENFORCED_CSP_ABSENT'
  | 'REPORT_ONLY_WITHOUT_ENFORCEMENT'
  | 'HTTPS_REQUIRED'
  | 'HSTS_ABSENT'
  | 'HSTS_INVALID'
  | 'HSTS_DISABLED'
  | 'NOSNIFF_ABSENT'
  | 'REFERRER_HEADER_ABSENT_BROWSER_DEFAULTS_APPLY'
  | 'PERMISSIVE_REFERRER_POLICY'
  | 'PERMISSIONS_HEADER_ABSENT_DEFAULTS_APPLY'
  | 'NO_RECOGNIZED_FRAME_RESTRICTION'
  | 'ENFORCED_FRAME_RESTRICTION_OBSERVED'
  | 'COOKIE_ATTRIBUTES_OBSERVED'
  | 'NO_COOKIES_OBSERVED'
  | 'COOKIE_SECURE_ABSENT'
  | 'COOKIE_HTTPONLY_ABSENT_INTENT_UNKNOWN'
  | 'COOKIE_SAMESITE_ABSENT_DEFAULTS_APPLY'
  | 'COOKIE_SAMESITE_NONE_WITHOUT_SECURE';
type EvidenceSource =
  | 'navigation'
  | 'mixedContent'
  | 'csp'
  | 'hsts'
  | 'contentTypeOptions'
  | 'referrerPolicy'
  | 'permissionsPolicy'
  | 'framing'
  | 'cookies';
export type SecurityRuleSubject =
  | { kind: 'MAIN_DOCUMENT' }
  | { kind: 'COOKIE_COLLECTION' }
  | { kind: 'COOKIE'; documentResponseOrdinal: number; cookieOrdinal: number };
export interface SecurityRuleResult {
  ruleId: SecurityRuleId;
  ruleVersion: typeof SECURITY_RULE_VERSION;
  outcome: SecurityRuleOutcome;
  /** Severity is meaningful only for POSTURE outcomes. */
  severity: FindingSeverity | null;
  confidence: FindingConfidence;
  reason: SecurityRuleReason;
  evidence: { source: EvidenceSource; subject: SecurityRuleSubject };
}
export interface SecurityRuleEvaluation {
  coverage: SecurityAssessmentCoverage;
  results: readonly SecurityRuleResult[];
}
const coverageReasons: readonly SecurityCoverageReason[] = [
  'MAIN_DOCUMENT_UNAVAILABLE',
  'HEADERS_UNAVAILABLE',
  'COOKIE_OBSERVATION_UNAVAILABLE',
  'NETWORK_OBSERVATION_UNAVAILABLE',
  'INITIATOR_UNKNOWN',
  'NAVIGATION_CHANGED',
  'UNSUPPORTED_SYNTAX',
  'OBSERVATION_LIMIT_REACHED',
  'COLLECTION_FAILED',
];
type Decision = { outcome: SecurityRuleOutcome; reason: SecurityRuleReason };
const uncertain: Decision = {
  outcome: 'UNCERTAIN',
  reason: 'OBSERVATION_PARTIAL',
};
const unavailable: Decision = {
  outcome: 'NOT_ASSESSED',
  reason: 'OBSERVATION_UNAVAILABLE',
};
const unsupported: Decision = {
  outcome: 'UNCERTAIN',
  reason: 'OBSERVATION_UNSUPPORTED',
};
const observed: Decision = {
  outcome: 'OBSERVED',
  reason: 'CONDITION_NOT_OBSERVED',
};
function condition(matches: boolean, reason: SecurityRuleReason): Decision {
  return matches ? { outcome: 'POSTURE', reason } : observed;
}
function headerGap<T>(
  header: SecurityHeaderObservation<T>,
): Decision | undefined {
  if (header.presence === 'UNAVAILABLE') return unavailable;
  if (header.presence === 'PRESENT' && header.parseState !== 'PARSED')
    return unsupported;
}
function reference(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * Pure evaluation of Task 4's assessment. No raw input is copied into results.
 * A satisfied condition is a posture observation, never a vulnerability verdict.
 * PARTIAL coverage is scoped: Task 4 always lacks mixed-content provenance, which
 * must not erase independently observed main-document facts. Unscoped partial
 * coverage and collection/navigation limits conservatively suppress conclusions.
 */
export function evaluateSecurityRules(
  input: PassiveSecurityAssessment,
): SecurityRuleEvaluation {
  const reasons = coverageReasons.filter((reason) =>
    input.coverage.reasons.includes(reason),
  );
  const coverage: SecurityAssessmentCoverage = {
    version: 1,
    rulesetVersion: SECURITY_RULE_VERSION,
    state:
      input.coverage.state === 'COMPLETE'
        ? 'COMPLETE'
        : input.coverage.state === 'PARTIAL'
          ? 'PARTIAL'
          : 'UNAVAILABLE',
    reasons,
  };
  const results: SecurityRuleResult[] = [];
  const globalGap: Decision | undefined =
    input.coverage.version !== 1 ||
    input.coverage.rulesetVersion !== SECURITY_RULE_VERSION
      ? { outcome: 'NOT_ASSESSED', reason: 'UNSUPPORTED_VERSION' }
      : coverage.state === 'UNAVAILABLE'
        ? unavailable
        : reasons.some((r) =>
              [
                'COLLECTION_FAILED',
                'NAVIGATION_CHANGED',
                'OBSERVATION_LIMIT_REACHED',
              ].includes(r),
            ) ||
            (coverage.state === 'PARTIAL' && reasons.length === 0)
          ? uncertain
          : undefined;
  const documentGap =
    globalGap ??
    (input.mainDocument.state === 'UNAVAILABLE'
      ? unavailable
      : input.mainDocument.state !== 'OBSERVED'
        ? uncertain
        : undefined);
  const headerCoverageGap =
    documentGap ??
    (reasons.includes('HEADERS_UNAVAILABLE') ? uncertain : undefined);
  function add(
    id: SecurityRuleId,
    source: EvidenceSource,
    decision: Decision,
    subject: SecurityRuleSubject = { kind: 'MAIN_DOCUMENT' },
  ) {
    const final = globalGap ?? decision;
    results.push({
      ruleId: id,
      ruleVersion: SECURITY_RULE_VERSION,
      outcome: final.outcome,
      reason: final.reason,
      severity:
        final.outcome === 'POSTURE' ? SECURITY_RULE_POLICY[id][0] : null,
      confidence:
        final.outcome === 'UNCERTAIN' || final.outcome === 'NOT_ASSESSED'
          ? 'LOW'
          : SECURITY_RULE_POLICY[id][1],
      evidence: { source, subject },
    });
  }
  const nav =
    input.navigation.state === 'OBSERVED' ? input.navigation.facts : null;
  const navigationGap =
    documentGap ??
    (input.navigation.state === 'UNAVAILABLE'
      ? unavailable
      : !nav ||
          nav.transportState === 'UNCERTAIN' ||
          !['HTTP', 'HTTPS'].includes(nav.finalScheme)
        ? uncertain
        : undefined);
  add(
    'security.transport.insecure-final',
    'navigation',
    navigationGap ??
      condition(nav?.finalScheme === 'HTTP', 'HTTP_FINAL_OBSERVED'),
  );
  add(
    'security.transport.downgrade',
    'navigation',
    navigationGap ??
      condition(
        nav?.transportState === 'HTTPS_TO_HTTP_OBSERVED',
        'DOWNGRADE_OBSERVED',
      ),
  );
  add(
    'security.transport.insecure-entry',
    'navigation',
    navigationGap ??
      condition(
        nav?.requestedScheme === 'HTTP' && nav.finalScheme === 'HTTPS',
        'HTTP_ENTRY_UPGRADED',
      ),
  );
  add(
    'security.transport.https-final',
    'navigation',
    navigationGap ??
      (nav?.finalScheme === 'HTTPS'
        ? { outcome: 'OBSERVED', reason: 'HTTPS_FINAL_OBSERVED' }
        : { outcome: 'NOT_APPLICABLE', reason: 'HTTPS_REQUIRED' }),
  );
  // Task 4 deliberately does not associate subrequests with an HTTPS initiator.
  // Do not infer provenance from a future caller supplying a nonempty array.
  add('security.mixed-content.assessment', 'mixedContent', {
    outcome:
      input.mixedContent.state === 'UNKNOWN' ? 'UNCERTAIN' : 'NOT_ASSESSED',
    reason: 'PROVENANCE_UNAVAILABLE',
  });

  const enforced = input.csp.enforced;
  const cspGap = headerCoverageGap ?? headerGap(enforced);
  add(
    'security.csp.missing',
    'csp',
    cspGap ?? condition(enforced.presence === 'ABSENT', 'ENFORCED_CSP_ABSENT'),
  );
  add(
    'security.csp.report-only',
    'csp',
    cspGap ??
      (enforced.presence === 'ABSENT'
        ? (headerGap(input.csp.reportOnly) ??
          condition(
            input.csp.reportOnly.presence === 'PRESENT',
            'REPORT_ONLY_WITHOUT_ENFORCEMENT',
          ))
        : observed),
  );

  const hsts = input.hsts;
  const hstsGap =
    navigationGap ??
    (nav?.finalScheme !== 'HTTPS'
      ? ({ outcome: 'NOT_APPLICABLE', reason: 'HTTPS_REQUIRED' } as const)
      : headerCoverageGap);
  // INVALID is a bounded parser fact, assessed only as low-confidence posture.
  const hstsInvalid =
    hsts.presence === 'PRESENT' && hsts.parseState === 'INVALID';
  const hstsFacts =
    hsts.presence === 'PRESENT' && hsts.parseState === 'PARSED'
      ? hsts.facts
      : null;
  const age = hstsFacts?.maxAgeSeconds;
  const hstsParseGap = hstsInvalid
    ? undefined
    : (headerGap(hsts) ??
      (hstsFacts && (age === null || age === undefined || !reference(age))
        ? unsupported
        : undefined));
  add(
    'security.hsts.missing',
    'hsts',
    hstsGap ??
      hstsParseGap ??
      condition(hsts.presence === 'ABSENT', 'HSTS_ABSENT'),
  );
  add(
    'security.hsts.invalid',
    'hsts',
    hstsGap ?? hstsParseGap ?? condition(hstsInvalid, 'HSTS_INVALID'),
  );
  add(
    'security.hsts.disabled',
    'hsts',
    hstsGap ??
      hstsParseGap ??
      (hstsInvalid ? unsupported : condition(age === 0, 'HSTS_DISABLED')),
  );

  const xcto = input.contentTypeOptions;
  add(
    'security.content-type-options.missing',
    'contentTypeOptions',
    headerCoverageGap ??
      headerGap(xcto) ??
      (xcto.presence === 'PRESENT' &&
      'facts' in xcto &&
      xcto.facts.nosniff !== true
        ? unsupported
        : condition(xcto.presence === 'ABSENT', 'NOSNIFF_ABSENT')),
  );
  const referrer = input.referrerPolicy;
  const referrerFacts =
    referrer.presence === 'PRESENT' && referrer.parseState === 'PARSED'
      ? referrer.facts
      : null;
  const recognized = [
    'no-referrer',
    'no-referrer-when-downgrade',
    'origin',
    'origin-when-cross-origin',
    'same-origin',
    'strict-origin',
    'strict-origin-when-cross-origin',
    'unsafe-url',
  ];
  const referrerGap =
    headerCoverageGap ??
    headerGap(referrer) ??
    (referrerFacts && !recognized.includes(referrerFacts.policy)
      ? unsupported
      : undefined);
  add(
    'security.referrer-policy.missing',
    'referrerPolicy',
    referrerGap ??
      condition(
        referrer.presence === 'ABSENT',
        'REFERRER_HEADER_ABSENT_BROWSER_DEFAULTS_APPLY',
      ),
  );
  add(
    'security.referrer-policy.permissive',
    'referrerPolicy',
    referrerGap ??
      condition(
        referrerFacts !== null &&
          ['unsafe-url', 'no-referrer-when-downgrade'].includes(
            referrerFacts.policy,
          ),
        'PERMISSIVE_REFERRER_POLICY',
      ),
  );
  const permissions = input.permissionsPolicy;
  const permissionsGap =
    headerCoverageGap ??
    headerGap(permissions) ??
    (permissions.presence === 'PRESENT' &&
    'facts' in permissions &&
    (permissions.facts.hasUnrecognizedFeatures ||
      permissions.facts.features.some((f) => f.allowlist === 'UNKNOWN'))
      ? unsupported
      : undefined);
  add(
    'security.permissions-policy.missing',
    'permissionsPolicy',
    permissionsGap ??
      condition(
        permissions.presence === 'ABSENT',
        'PERMISSIONS_HEADER_ABSENT_DEFAULTS_APPLY',
      ),
  );

  add(
    'security.frame-protection.missing',
    'framing',
    headerCoverageGap ?? framingDecision(input),
  );

  const cookies = input.cookies;
  const cookieGap =
    documentGap ??
    (reasons.includes('COOKIE_OBSERVATION_UNAVAILABLE')
      ? uncertain
      : cookies.state === 'UNAVAILABLE'
        ? unavailable
        : cookies.state !== 'OBSERVED'
          ? uncertain
          : undefined);
  const cookieFacts = cookies.state === 'OBSERVED' ? cookies.facts : [];
  const identities = new Set<string>();
  const malformedCookies =
    cookieFacts.length > 3200 ||
    cookieFacts.some((c) => {
      const key = `${c.documentResponseOrdinal}:${c.ordinal}`;
      const invalid =
        !reference(c.ordinal) ||
        !reference(c.documentResponseOrdinal) ||
        c.ordinal >= 100 ||
        c.documentResponseOrdinal >= 32 ||
        identities.has(key) ||
        typeof c.secure !== 'boolean' ||
        typeof c.httpOnly !== 'boolean' ||
        !['STRICT', 'LAX', 'NONE', 'ABSENT', 'INVALID'].includes(c.sameSite);
      identities.add(key);
      return invalid;
    });
  const cookieCoverageGap =
    cookieGap ?? (malformedCookies ? unsupported : undefined);
  add(
    'security.cookie.assessment',
    'cookies',
    cookieCoverageGap ?? {
      outcome: 'OBSERVED',
      reason: cookieFacts.length
        ? 'COOKIE_ATTRIBUTES_OBSERVED'
        : 'NO_COOKIES_OBSERVED',
    },
    { kind: 'COOKIE_COLLECTION' },
  );
  if (!globalGap && !cookieCoverageGap) {
    for (const cookie of [...cookieFacts].sort(
      (a, b) =>
        a.documentResponseOrdinal - b.documentResponseOrdinal ||
        a.ordinal - b.ordinal,
    )) {
      const subject: SecurityRuleSubject = {
        kind: 'COOKIE',
        documentResponseOrdinal: cookie.documentResponseOrdinal,
        cookieOrdinal: cookie.ordinal,
      };
      add(
        'security.cookie.secure-missing',
        'cookies',
        condition(!cookie.secure, 'COOKIE_SECURE_ABSENT'),
        subject,
      );
      add(
        'security.cookie.httponly-missing',
        'cookies',
        condition(!cookie.httpOnly, 'COOKIE_HTTPONLY_ABSENT_INTENT_UNKNOWN'),
        subject,
      );
      add(
        'security.cookie.samesite-missing',
        'cookies',
        cookie.sameSite === 'INVALID'
          ? unsupported
          : condition(
              cookie.sameSite === 'ABSENT',
              'COOKIE_SAMESITE_ABSENT_DEFAULTS_APPLY',
            ),
        subject,
      );
      add(
        'security.cookie.samesite-none-without-secure',
        'cookies',
        cookie.sameSite === 'INVALID'
          ? unsupported
          : condition(
              cookie.sameSite === 'NONE' && !cookie.secure,
              'COOKIE_SAMESITE_NONE_WITHOUT_SECURE',
            ),
        subject,
      );
    }
  }
  return { coverage, results };
}

function framingDecision(input: PassiveSecurityAssessment): Decision {
  const csp = input.csp.enforced;
  const frame = input.framing.frameAncestors;
  const xfo = input.framing.xFrameOptions;
  // Presence is not sufficient: Task 4 also represents wildcard/unknown sources.
  // Restrict the positive claim to clearly represented 'self' or 'none'. No full
  // CSP evaluator and no inheritance from default-src or report-only policies.
  const gap = headerGap(csp);
  if (gap) return gap;
  if (frame.state !== 'OBSERVED')
    return frame.state === 'UNAVAILABLE' ? unavailable : uncertain;
  if (frame.facts.state === 'PRESENT') {
    if (csp.presence !== 'PRESENT' || !('facts' in csp)) return unsupported;
    const ordinals = frame.facts.policyOrdinals;
    const sources = csp.facts
      .filter((p) => ordinals.includes(p.ordinal))
      .flatMap((p) =>
        p.directives
          .filter((d) => d.directive === 'frame-ancestors')
          .map((d) => d.sources),
      );
    if (
      sources.some(
        (s) => s.length === 1 && (s[0] === 'SELF' || s[0] === 'NONE'),
      )
    )
      return {
        outcome: 'OBSERVED',
        reason: 'ENFORCED_FRAME_RESTRICTION_OBSERVED',
      };
    // A present frame-ancestors directive can override XFO. Host/scheme lists
    // need fuller semantics before they can support a protection conclusion.
    return unsupported;
  }
  if (
    csp.presence === 'PRESENT' &&
    'facts' in csp &&
    csp.facts.some((p) =>
      p.directives.some((d) => d.directive === 'frame-ancestors'),
    )
  )
    return unsupported;
  const xfoGap = headerGap(xfo);
  if (xfoGap) return xfoGap;
  if (xfo.presence === 'PRESENT' && 'facts' in xfo) {
    return xfo.facts.policy === 'DENY' || xfo.facts.policy === 'SAMEORIGIN'
      ? { outcome: 'OBSERVED', reason: 'ENFORCED_FRAME_RESTRICTION_OBSERVED' }
      : unsupported;
  }
  return condition(true, 'NO_RECOGNIZED_FRAME_RESTRICTION');
}
