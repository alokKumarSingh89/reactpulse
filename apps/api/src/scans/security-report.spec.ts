import {
  buildSecurityReport,
  type SecurityReportInput,
} from './security-report';

const canaries = [
  'authorization-secret-canary',
  'cookie-secret-canary',
  'query-secret-canary',
  'nonce-secret-canary',
  'console-secret-canary',
];
const secret = canaries.join(' ');
function scan(state = 'COMPLETE'): SecurityReportInput {
  return {
    id: 'scan',
    status: 'COMPLETED',
    completedAt: new Date(0),
    findings: [],
    evidence: [
      {
        data: {
          kind: 'PASSIVE_SECURITY_ASSESSMENT',
          coverage: {
            version: 1,
            rulesetVersion: 1,
            state,
            reasons: [],
            extra: secret,
          },
          raw: secret,
        },
      },
    ],
  };
}
function finding() {
  return {
    category: 'SECURITY',
    ruleId: 'security.csp.missing',
    severity: 'MEDIUM',
    confidence: 'HIGH',
    status: 'OPEN',
    title: secret,
    description: secret,
    recommendation: secret,
    affectedUrl: secret,
    affectedResource: secret,
    evidence: {
      version: 1,
      ruleVersion: 1,
      outcome: 'POSTURE',
      reason: 'ENFORCED_CSP_ABSENT',
      source: 'csp',
      subject: { kind: 'MAIN_DOCUMENT', extra: secret },
      extra: secret,
    },
  };
}
describe('security report projection', () => {
  it.each(['COMPLETE', 'PARTIAL', 'UNAVAILABLE'])(
    'preserves %s coverage including zero findings',
    (state) => {
      const report = buildSecurityReport(scan(state));
      expect(report.assessment.state).toBe(state);
      expect(report.findings).toEqual([]);
      expect(report.observations.state).toBe('UNAVAILABLE');
    },
  );
  it('distinguishes legacy scans', () => {
    expect(
      buildSecurityReport({ ...scan(), evidence: [] }).assessment.state,
    ).toBe('NOT_ASSESSED');
  });
  it.each(['PENDING', 'QUEUED', 'RUNNING', 'FAILED', 'CANCELLED'])(
    'hides intermediate persistence for %s',
    (status) => {
      const report = buildSecurityReport({
        ...scan(),
        status,
        findings: [finding()],
      });
      expect(report.assessment.state).toBe('UNAVAILABLE');
      expect(report.assessment.coverage).toBeNull();
      expect(report.findings).toEqual([]);
    },
  );
  it('excludes all free-form fields and other finding categories', () => {
    const report = buildSecurityReport({
      ...scan(),
      findings: [finding(), { ...finding(), category: 'NETWORK' }],
    });
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]?.title).toBe('Enforced CSP not observed');
    for (const canary of canaries)
      expect(JSON.stringify(report)).not.toContain(canary);
  });
  it.each([
    null,
    {},
    { kind: 'PASSIVE_SECURITY_ASSESSMENT', coverage: { version: 99 } },
    {
      kind: 'PASSIVE_SECURITY_ASSESSMENT',
      coverage: {
        version: 1,
        rulesetVersion: 1,
        state: 'COMPLETE',
        reasons: [secret],
      },
    },
  ])('fails closed for malformed markers', (data) => {
    const report = buildSecurityReport({
      ...scan(),
      evidence: [{ data }],
      findings: [finding()],
    });
    expect(report.assessment.state).toBe('UNAVAILABLE');
    expect(report.findings).toEqual([]);
    expect(JSON.stringify(report)).not.toContain(secret);
  });
  it('omits malformed findings and reports partial delivery', () => {
    const report = buildSecurityReport({
      ...scan(),
      findings: [{ ...finding(), evidence: { raw: secret } }],
    });
    expect(report.assessment.state).toBe('PARTIAL');
    expect(report.assessment.limitations).toContain('FINDINGS_OMITTED');
    expect(report.findings).toEqual([]);
  });
  it('sorts severity, rule ID and safe subject deterministically', () => {
    const cookie = {
      ...finding(),
      ruleId: 'security.cookie.secure-missing',
      evidence: {
        ...finding().evidence,
        reason: 'COOKIE_SECURE_ABSENT',
        source: 'cookies',
        subject: {
          kind: 'COOKIE',
          documentResponseOrdinal: 0,
          cookieOrdinal: 2,
        },
      },
    };
    const rows = [
      finding(),
      cookie,
      { ...finding(), severity: 'HIGH' },
      {
        ...cookie,
        evidence: {
          ...cookie.evidence,
          subject: { ...cookie.evidence.subject, cookieOrdinal: 1 },
        },
      },
    ];
    const first = buildSecurityReport({ ...scan(), findings: rows });
    expect(first.findings).toEqual(
      buildSecurityReport({ ...scan(), findings: [...rows].reverse() })
        .findings,
    );
    expect(first.findings.map((row) => row.affectedResource)).toEqual([
      'main-document',
      'document:0:cookie:1',
      'document:0:cookie:2',
      'main-document',
    ]);
  });
});
