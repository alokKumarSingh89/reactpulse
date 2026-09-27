import { describe, expect, it } from 'vitest';
import type {
  CookieAttributeSecurityObservation,
  PassiveSecurityAssessment,
  SecurityHeaderObservation,
} from '@reactpulse/contracts';
import {
  evaluateSecurityRules,
  SECURITY_RULE_POLICY,
  type SecurityRuleId,
} from './security-rules';

const absent = { presence: 'ABSENT' } as const;
const unavailable = {
  presence: 'UNAVAILABLE',
  reason: 'HEADERS_UNAVAILABLE',
} as const;
const invalid = { presence: 'PRESENT', parseState: 'INVALID' } as const;
const unsupported = { presence: 'PRESENT', parseState: 'UNSUPPORTED' } as const;
function parsed<T>(facts: T): SecurityHeaderObservation<T> {
  return { presence: 'PRESENT', parseState: 'PARSED', facts };
}
function assessment(): PassiveSecurityAssessment {
  return {
    // The actual Task 4 baseline is partial because mixed content is unavailable.
    coverage: {
      version: 1,
      rulesetVersion: 1,
      state: 'PARTIAL',
      reasons: ['NETWORK_OBSERVATION_UNAVAILABLE'],
    },
    navigation: {
      state: 'OBSERVED',
      facts: {
        requestedScheme: 'HTTPS',
        finalScheme: 'HTTPS',
        requestedSite: { ordinal: 0 },
        finalSite: { ordinal: 0 },
        transportState: 'HTTPS_ONLY_OBSERVED',
      },
    },
    mainDocument: {
      state: 'OBSERVED',
      facts: { status: 200, mediaType: 'text/html', site: { ordinal: 0 } },
    },
    csp: { enforced: absent, reportOnly: absent },
    hsts: absent,
    contentTypeOptions: absent,
    referrerPolicy: absent,
    permissionsPolicy: absent,
    framing: {
      frameAncestors: { state: 'OBSERVED', facts: { state: 'ABSENT' } },
      xFrameOptions: absent,
    },
    cookies: { state: 'OBSERVED', facts: [] },
    mixedContent: {
      state: 'UNAVAILABLE',
      reason: 'NETWORK_OBSERVATION_UNAVAILABLE',
    },
  };
}
function rule(input: PassiveSecurityAssessment, id: SecurityRuleId) {
  const result = evaluateSecurityRules(input).results.find(
    (r) => r.ruleId === id,
  );
  expect(result).toBeDefined();
  return result!;
}
const cookie = (
  patch: Partial<CookieAttributeSecurityObservation> = {},
): CookieAttributeSecurityObservation => ({
  ordinal: 0,
  documentResponseOrdinal: 0,
  scope: 'MAIN_DOCUMENT_RESPONSE',
  secure: true,
  httpOnly: true,
  sameSite: 'LAX',
  partitioned: false,
  ...patch,
});

describe('transport and coverage', () => {
  it.each([
    [
      'HTTPS',
      'HTTPS',
      'HTTPS_ONLY_OBSERVED',
      'OBSERVED',
      'OBSERVED',
      'OBSERVED',
    ],
    ['HTTP', 'HTTP', 'HTTP_OBSERVED', 'POSTURE', 'OBSERVED', 'OBSERVED'],
    [
      'HTTP',
      'HTTPS',
      'HTTP_TO_HTTPS_OBSERVED',
      'OBSERVED',
      'OBSERVED',
      'POSTURE',
    ],
    [
      'HTTPS',
      'HTTP',
      'HTTPS_TO_HTTP_OBSERVED',
      'POSTURE',
      'POSTURE',
      'OBSERVED',
    ],
    [
      'HTTPS',
      'HTTPS',
      'HTTPS_TO_HTTP_OBSERVED',
      'OBSERVED',
      'POSTURE',
      'OBSERVED',
    ],
    ['HTTPS', 'HTTPS', 'UNCERTAIN', 'UNCERTAIN', 'UNCERTAIN', 'UNCERTAIN'],
  ] as const)(
    '%s → %s (%s) uses only observed transport',
    (
      requestedScheme,
      finalScheme,
      transportState,
      insecure,
      downgrade,
      entry,
    ) => {
      const a = assessment();
      a.navigation = {
        state: 'OBSERVED',
        facts: {
          requestedScheme,
          finalScheme,
          transportState,
          requestedSite: null,
          finalSite: null,
        },
      };
      expect(rule(a, 'security.transport.insecure-final').outcome).toBe(
        insecure,
      );
      expect(rule(a, 'security.transport.downgrade').outcome).toBe(downgrade);
      expect(rule(a, 'security.transport.insecure-entry').outcome).toBe(entry);
      if (finalScheme === 'HTTPS' && transportState !== 'UNCERTAIN')
        expect(rule(a, 'security.transport.https-final').reason).toBe(
          'HTTPS_FINAL_OBSERVED',
        );
    },
  );
  it.each(['UNKNOWN', 'UNAVAILABLE'] as const)(
    'preserves %s navigation',
    (state) => {
      const a = assessment();
      a.navigation = { state, reason: 'NAVIGATION_CHANGED' };
      expect(rule(a, 'security.transport.insecure-final').outcome).toBe(
        state === 'UNAVAILABLE' ? 'NOT_ASSESSED' : 'UNCERTAIN',
      );
    },
  );
  it.each([
    'COLLECTION_FAILED',
    'NAVIGATION_CHANGED',
    'OBSERVATION_LIMIT_REACHED',
  ] as const)('suppresses posture when coverage reports %s', (reason) => {
    const a = assessment();
    a.coverage.reasons = [reason];
    expect(
      evaluateSecurityRules(a).results.every(
        (r) => r.outcome === 'UNCERTAIN' && r.severity === null,
      ),
    ).toBe(true);
    expect(evaluateSecurityRules(a).coverage).toEqual(a.coverage);
  });
  it('preserves unavailable coverage and unscoped partial coverage', () => {
    const a = assessment();
    a.coverage.state = 'UNAVAILABLE';
    expect(
      evaluateSecurityRules(a).results.every(
        (r) => r.outcome === 'NOT_ASSESSED',
      ),
    ).toBe(true);
    a.coverage.state = 'PARTIAL';
    a.coverage.reasons = [];
    expect(
      evaluateSecurityRules(a).results.every((r) => r.outcome === 'UNCERTAIN'),
    ).toBe(true);
  });
  it('does not turn missing main-document evidence into missing headers', () => {
    const a = assessment();
    a.mainDocument = {
      state: 'UNAVAILABLE',
      reason: 'MAIN_DOCUMENT_UNAVAILABLE',
    };
    expect(rule(a, 'security.csp.missing').outcome).toBe('NOT_ASSESSED');
  });
  it('rejects unsupported versions without interpreting observations', () => {
    const a = assessment();
    a.coverage.rulesetVersion = 99;
    expect(
      evaluateSecurityRules(a).results.every(
        (r) => r.reason === 'UNSUPPORTED_VERSION' && r.severity === null,
      ),
    ).toBe(true);
  });
});

describe('CSP', () => {
  it.each([
    [absent, absent, 'POSTURE', 'OBSERVED'],
    [absent, parsed([]), 'POSTURE', 'POSTURE'],
    [parsed([]), parsed([]), 'OBSERVED', 'OBSERVED'],
    [invalid, absent, 'UNCERTAIN', 'UNCERTAIN'],
    [unsupported, absent, 'UNCERTAIN', 'UNCERTAIN'],
    [unavailable, absent, 'NOT_ASSESSED', 'NOT_ASSESSED'],
    [
      { presence: 'PRESENT', parseState: 'PARTIAL', facts: [] } as const,
      absent,
      'UNCERTAIN',
      'UNCERTAIN',
    ],
  ])(
    'distinguishes enforced/report-only presence and unknown parsing',
    (enforced, reportOnly, missing, report) => {
      const a = assessment();
      a.csp = {
        enforced: enforced as PassiveSecurityAssessment['csp']['enforced'],
        reportOnly:
          reportOnly as PassiveSecurityAssessment['csp']['reportOnly'],
      };
      expect(rule(a, 'security.csp.missing').outcome).toBe(missing);
      expect(rule(a, 'security.csp.report-only').outcome).toBe(report);
    },
  );
});

describe('HSTS', () => {
  it('does not assess missing HSTS on HTTP', () => {
    const a = assessment();
    a.navigation = {
      state: 'OBSERVED',
      facts: {
        requestedScheme: 'HTTP',
        finalScheme: 'HTTP',
        requestedSite: null,
        finalSite: null,
        transportState: 'HTTP_OBSERVED',
      },
    };
    for (const id of [
      'security.hsts.missing',
      'security.hsts.invalid',
      'security.hsts.disabled',
    ] as const)
      expect(rule(a, id).outcome).toBe('NOT_APPLICABLE');
  });
  it.each([
    [absent, 'security.hsts.missing', 'POSTURE'],
    [invalid, 'security.hsts.invalid', 'POSTURE'],
    [unavailable, 'security.hsts.missing', 'NOT_ASSESSED'],
    [unsupported, 'security.hsts.invalid', 'UNCERTAIN'],
    [
      parsed({ maxAgeSeconds: 0, includeSubDomains: false, preload: false }),
      'security.hsts.disabled',
      'POSTURE',
    ],
    [
      parsed({ maxAgeSeconds: 3600, includeSubDomains: true, preload: true }),
      'security.hsts.disabled',
      'OBSERVED',
    ],
    [
      parsed({ maxAgeSeconds: NaN, includeSubDomains: false, preload: false }),
      'security.hsts.disabled',
      'UNCERTAIN',
    ],
    [
      parsed({ maxAgeSeconds: null, includeSubDomains: false, preload: false }),
      'security.hsts.disabled',
      'UNCERTAIN',
    ],
  ] as const)(
    'handles missing, invalid, zero, positive and unavailable HSTS',
    (hsts, id, expected) => {
      const a = assessment();
      a.hsts = hsts;
      expect(rule(a, id).outcome).toBe(expected);
      if (hsts === invalid)
        expect(rule(a, id)).toMatchObject({
          severity: 'LOW',
          confidence: 'LOW',
        });
    },
  );
});

describe('normalized headers', () => {
  it.each([
    [parsed({ nosniff: true }), 'OBSERVED'],
    [absent, 'POSTURE'],
    [unavailable, 'NOT_ASSESSED'],
    [invalid, 'UNCERTAIN'],
    [
      {
        presence: 'PRESENT',
        parseState: 'PARTIAL',
        facts: { nosniff: false },
      } as const,
      'UNCERTAIN',
    ],
  ] as const)('assesses XCTO without inspecting headers', (value, outcome) => {
    const a = assessment();
    a.contentTypeOptions = value;
    expect(rule(a, 'security.content-type-options.missing').outcome).toBe(
      outcome,
    );
  });
  it.each([
    ['no-referrer', 'OBSERVED'],
    ['strict-origin-when-cross-origin', 'OBSERVED'],
    ['same-origin', 'OBSERVED'],
    ['unsafe-url', 'POSTURE'],
    ['no-referrer-when-downgrade', 'POSTURE'],
    ['UNKNOWN', 'UNCERTAIN'],
  ] as const)('normalizes referrer-policy %s', (policy, outcome) => {
    const a = assessment();
    a.referrerPolicy = parsed({ policy });
    expect(rule(a, 'security.referrer-policy.permissive').outcome).toBe(
      outcome,
    );
  });
  it('does not call missing referrer or permissions headers unrestricted', () => {
    const a = assessment();
    expect(rule(a, 'security.referrer-policy.missing')).toMatchObject({
      severity: 'INFO',
      reason: 'REFERRER_HEADER_ABSENT_BROWSER_DEFAULTS_APPLY',
    });
    expect(rule(a, 'security.permissions-policy.missing')).toMatchObject({
      severity: 'INFO',
      reason: 'PERMISSIONS_HEADER_ABSENT_DEFAULTS_APPLY',
    });
    a.referrerPolicy = unavailable;
    expect(rule(a, 'security.referrer-policy.missing').outcome).toBe(
      'NOT_ASSESSED',
    );
  });
  it.each([
    [absent, 'POSTURE'],
    [
      parsed({
        features: [{ feature: 'camera', allowlist: 'NONE' }],
        hasUnrecognizedFeatures: false,
      }),
      'OBSERVED',
    ],
    [invalid, 'UNCERTAIN'],
    [unavailable, 'NOT_ASSESSED'],
    [
      {
        presence: 'PRESENT',
        parseState: 'PARTIAL',
        facts: { features: [], hasUnrecognizedFeatures: true },
      },
      'UNCERTAIN',
    ],
    [
      parsed({
        features: [{ feature: 'camera', allowlist: 'UNKNOWN' }],
        hasUnrecognizedFeatures: false,
      }),
      'UNCERTAIN',
    ],
  ] as const)(
    'handles only represented Permissions-Policy facts',
    (value, outcome) => {
      const a = assessment();
      a.permissionsPolicy =
        value as PassiveSecurityAssessment['permissionsPolicy'];
      expect(rule(a, 'security.permissions-policy.missing').outcome).toBe(
        outcome,
      );
    },
  );
});

describe('frame protection', () => {
  it.each(['NONE', 'SELF'] as const)(
    'recognizes enforced frame-ancestors %s without requiring XFO',
    (source) => {
      const a = assessment();
      a.csp.enforced = parsed([
        {
          ordinal: 0,
          hasUnrecognizedDirectives: false,
          directives: [{ directive: 'frame-ancestors', sources: [source] }],
        },
      ]);
      a.framing.frameAncestors = {
        state: 'OBSERVED',
        facts: { state: 'PRESENT', policyOrdinals: [0] },
      };
      expect(rule(a, 'security.frame-protection.missing')).toMatchObject({
        outcome: 'OBSERVED',
        reason: 'ENFORCED_FRAME_RESTRICTION_OBSERVED',
        severity: null,
      });
    },
  );
  it('ignores report-only frame-ancestors and does not inherit default-src', () => {
    const a = assessment();
    a.csp.reportOnly = parsed([
      {
        ordinal: 0,
        hasUnrecognizedDirectives: false,
        directives: [{ directive: 'frame-ancestors', sources: ['NONE'] }],
      },
    ]);
    a.csp.enforced = parsed([
      {
        ordinal: 0,
        hasUnrecognizedDirectives: false,
        directives: [{ directive: 'default-src', sources: ['NONE'] }],
      },
    ]);
    expect(rule(a, 'security.frame-protection.missing').outcome).toBe(
      'POSTURE',
    );
  });
  it.each(['DENY', 'SAMEORIGIN', 'CONFLICTING', 'UNKNOWN'] as const)(
    'handles XFO %s',
    (policy) => {
      const a = assessment();
      a.framing.xFrameOptions = parsed({ policy });
      expect(rule(a, 'security.frame-protection.missing').outcome).toBe(
        ['DENY', 'SAMEORIGIN'].includes(policy) ? 'OBSERVED' : 'UNCERTAIN',
      );
    },
  );
  it('distinguishes neither from unavailable protection', () => {
    const a = assessment();
    expect(rule(a, 'security.frame-protection.missing').outcome).toBe(
      'POSTURE',
    );
    a.framing.frameAncestors = {
      state: 'UNAVAILABLE',
      reason: 'HEADERS_UNAVAILABLE',
    };
    expect(rule(a, 'security.frame-protection.missing').outcome).toBe(
      'NOT_ASSESSED',
    );
  });
  it.each(['WILDCARD', 'EXPLICIT_SOURCE_PRESENT', 'UNRECOGNIZED'] as const)(
    'does not call mere frame-ancestors presence protection (%s)',
    (source) => {
      const a = assessment();
      a.csp.enforced = parsed([
        {
          ordinal: 0,
          hasUnrecognizedDirectives: false,
          directives: [{ directive: 'frame-ancestors', sources: [source] }],
        },
      ]);
      a.framing.frameAncestors = {
        state: 'OBSERVED',
        facts: { state: 'PRESENT', policyOrdinals: [0] },
      };
      a.framing.xFrameOptions = parsed({ policy: 'DENY' });
      expect(rule(a, 'security.frame-protection.missing').outcome).toBe(
        'UNCERTAIN',
      );
    },
  );
});

describe('cookie attributes', () => {
  it.each([
    [{}, 'security.cookie.secure-missing', 'OBSERVED', null],
    [{ secure: false }, 'security.cookie.secure-missing', 'POSTURE', 'LOW'],
    [{}, 'security.cookie.httponly-missing', 'OBSERVED', null],
    [
      { httpOnly: false },
      'security.cookie.httponly-missing',
      'POSTURE',
      'INFO',
    ],
    [
      { sameSite: 'ABSENT' },
      'security.cookie.samesite-missing',
      'POSTURE',
      'INFO',
    ],
    [
      { sameSite: 'NONE' },
      'security.cookie.samesite-none-without-secure',
      'OBSERVED',
      null,
    ],
    [
      { sameSite: 'NONE', secure: false },
      'security.cookie.samesite-none-without-secure',
      'POSTURE',
      'MEDIUM',
    ],
    [
      { sameSite: 'INVALID' },
      'security.cookie.samesite-missing',
      'UNCERTAIN',
      null,
    ],
  ] as const)(
    'uses attributes only with conservative severity',
    (patch, id, outcome, severity) => {
      const a = assessment();
      a.cookies = { state: 'OBSERVED', facts: [cookie(patch)] };
      expect(rule(a, id)).toMatchObject({
        outcome,
        severity,
        evidence: {
          source: 'cookies',
          subject: {
            kind: 'COOKIE',
            documentResponseOrdinal: 0,
            cookieOrdinal: 0,
          },
        },
      });
    },
  );
  it.each(['UNKNOWN', 'UNAVAILABLE'] as const)(
    'preserves %s cookie coverage',
    (state) => {
      const a = assessment();
      a.cookies = { state, reason: 'COOKIE_OBSERVATION_UNAVAILABLE' };
      expect(rule(a, 'security.cookie.assessment').outcome).toBe(
        state === 'UNAVAILABLE' ? 'NOT_ASSESSED' : 'UNCERTAIN',
      );
      expect(
        evaluateSecurityRules(a).results.some(
          (r) => r.evidence.subject.kind === 'COOKIE',
        ),
      ).toBe(false);
    },
  );
  it('suppresses cookie conclusions when aggregate coverage says incomplete', () => {
    const a = assessment();
    a.cookies = { state: 'OBSERVED', facts: [cookie({ secure: false })] };
    a.coverage.reasons = ['COOKIE_OBSERVATION_UNAVAILABLE'];
    expect(rule(a, 'security.cookie.assessment').outcome).toBe('UNCERTAIN');
    expect(
      evaluateSecurityRules(a).results.some(
        (r) => r.evidence.subject.kind === 'COOKIE',
      ),
    ).toBe(false);
  });
  it('distinguishes no observed cookies from unavailable coverage', () => {
    expect(rule(assessment(), 'security.cookie.assessment').reason).toBe(
      'NO_COOKIES_OBSERVED',
    );
  });
  it('rejects duplicate/malformed cookie references rather than emitting duplicate conditions', () => {
    for (const facts of [
      [cookie(), cookie()],
      [cookie({ ordinal: Infinity })],
      [cookie({ documentResponseOrdinal: -1 })],
    ]) {
      const a = assessment();
      a.cookies = { state: 'OBSERVED', facts };
      expect(rule(a, 'security.cookie.assessment').outcome).toBe('UNCERTAIN');
      expect(
        evaluateSecurityRules(a).results.some(
          (r) => r.evidence.subject.kind === 'COOKIE',
        ),
      ).toBe(false);
    }
  });
});

describe('mixed content is deferred until provenance exists', () => {
  it.each(['UNAVAILABLE', 'UNKNOWN', 'OBSERVED'] as const)(
    'does not infer mixed content from %s coverage',
    (state) => {
      const a = assessment();
      a.mixedContent =
        state === 'OBSERVED'
          ? {
              state,
              facts: [
                {
                  resource: { requestSequence: 1 },
                  resourceType: 'script',
                  requestedScheme: 'HTTP',
                  initiatorScheme: 'HTTPS',
                  outcome: 'FAILED',
                },
              ],
            }
          : { state, reason: 'INITIATOR_UNKNOWN' };
      expect(rule(a, 'security.mixed-content.assessment')).toMatchObject({
        outcome: state === 'UNKNOWN' ? 'UNCERTAIN' : 'NOT_ASSESSED',
        severity: null,
        reason: 'PROVENANCE_UNAVAILABLE',
      });
    },
  );
});

describe('purity and bounded output', () => {
  it('is deterministic, leaves input unchanged and has one rule per subject/condition', () => {
    const a = assessment();
    a.cookies = {
      state: 'OBSERVED',
      facts: [
        cookie({ ordinal: 1, secure: false }),
        cookie({ documentResponseOrdinal: 1, ordinal: 0 }),
      ],
    };
    const before = JSON.stringify(a);
    const first = evaluateSecurityRules(a);
    expect(evaluateSecurityRules(a)).toEqual(first);
    expect(JSON.stringify(a)).toBe(before);
    const keys = first.results.map(
      (r) => `${r.ruleId}:${JSON.stringify(r.evidence.subject)}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
    expect(first.coverage).toEqual(a.coverage);
  });
  it('never copies unexpected secret text, policy text or unsafe references', () => {
    const secret = 'SECRET_CANARY';
    const a = assessment();
    Object.assign(a, {
      url: secret,
      headers: { authorization: secret },
      cookiesRaw: secret,
    });
    Object.assign(a.coverage, {
      extra: secret,
      reasons: [...a.coverage.reasons, secret],
    });
    Object.assign(a.navigation, { secret });
    Object.assign(a.csp, { nonce: secret, reportUri: secret });
    a.referrerPolicy = parsed({
      policy: secret,
    }) as PassiveSecurityAssessment['referrerPolicy'];
    a.cookies = {
      state: 'OBSERVED',
      facts: [
        Object.assign(cookie({ secure: false }), {
          name: secret,
          value: secret,
        }),
      ],
    };
    expect(JSON.stringify(evaluateSecurityRules(a))).not.toContain(secret);
    a.cookies = {
      state: 'OBSERVED',
      facts: [Object.assign(cookie(), { ordinal: secret })],
    };
    expect(JSON.stringify(evaluateSecurityRules(a))).not.toContain(secret);
  });
  it('uses fixed severity mappings and never assigns severity to uncertainty', () => {
    const a = assessment();
    a.cookies = {
      state: 'OBSERVED',
      facts: [cookie({ secure: false, httpOnly: false, sameSite: 'NONE' })],
    };
    for (const result of evaluateSecurityRules(a).results) {
      expect(result.ruleVersion).toBe(1);
      expect(result.severity).toBe(
        result.outcome === 'POSTURE'
          ? SECURITY_RULE_POLICY[result.ruleId][0]
          : null,
      );
    }
  });
});
