import {
  buildAccessibilityReport,
  type AccessibilityReportInput,
} from './accessibility-report';
import {
  projectAccessibilityAssessment,
  projectAccessibilityCoverage,
} from '@reactpulse/contracts';
const canaries = [
  'accessibility-email-canary@example.com',
  'accessibility-token-canary-9182',
  'accessibility-input-secret-7712',
  'accessibility-dom-text-secret-6631',
  'accessibility-id-secret-5520',
];
const secret = canaries.join(' ');
function marker(state = 'COMPLETE') {
  return {
    kind: 'ACCESSIBILITY_ASSESSMENT',
    version: 1,
    raw: secret,
    assessment: {
      version: 1,
      state,
      scope: 'MAIN_DOCUMENT',
      engine: {
        name: 'axe-core',
        version: '4.13.0',
        rulesetVersion: 1,
        profileId: 'main-document-v1',
        error: secret,
      },
      mainDocumentEvaluated: state !== 'UNAVAILABLE',
      excludedFrameCount: 0,
      reasons:
        state === 'COMPLETE'
          ? []
          : [state === 'PARTIAL' ? 'REFERENCE_UNAVAILABLE' : 'ENGINE_TIMEOUT'],
      durationMs: 10,
      configuredRuleCount: 19,
      html: secret,
    },
  };
}
function finding(id = 'label') {
  return {
    category: 'ACCESSIBILITY',
    ruleId: `accessibility.axe-core.${id}`,
    severity: 'HIGH',
    confidence: 'MEDIUM',
    status: 'OPEN',
    title: secret,
    description: secret,
    recommendation: secret,
    affectedUrl: secret,
    affectedResource: secret,
    evidence: {
      version: 1,
      mappingVersion: 1,
      engine: 'axe-core',
      engineVersion: '4.13.0',
      rulesetVersion: 1,
      profileId: 'main-document-v1',
      ruleId: id,
      ruleVersion: 1,
      outcome: 'VIOLATION',
      engineImpact: 'SERIOUS',
      occurrenceCount: 1,
      countPrecision: 'EXACT',
      samplesTruncated: false,
      sampledReferences: [
        {
          ordinal: 0,
          tag: 'input',
          role: 'textbox',
          path: [{ tag: 'main', index: 0, id: secret }],
          html: secret,
          selector: secret,
        },
      ],
      wcagTags: ['wcag2a'],
      wcagCriteria: ['1.3.1'],
      raw: secret,
      debug: secret,
      metadata: secret,
      text: secret,
      value: secret,
      ariaLabel: secret,
      href: secret,
    },
  };
}

function scan(
  state = 'COMPLETE',
  findings: unknown[] = [],
): AccessibilityReportInput {
  return {
    id: 'scan',
    status: 'COMPLETED',
    completedAt: new Date(0),
    evidence: [{ data: marker(state) }],
    findings,
  };
}
describe('accessibility report', () => {
  it.each([
    ['COMPLETE', 2],
    ['COMPLETE', 0],
    ['PARTIAL', 1],
    ['PARTIAL', 0],
    ['UNAVAILABLE', 0],
  ] as const)('%s with %s findings preserves marker state', (state, count) => {
    const report = buildAccessibilityReport(
      scan(state, [finding(), finding('image-alt')].slice(0, count)),
    );
    expect(report.assessment.state).toBe(state);
    expect(report.summary.findingCount).toBe(count);
    expect(report.summary.countsBySeverity.HIGH).toBe(count);
    expect(report.summary.highestSeverity).toBe(count ? 'HIGH' : null);
    expect(report.assessment.coverage?.engine?.version).toBe('4.13.0');
  });
  it.each([{ findings: [] }, { findings: [finding()] }])(
    'legacy rows never establish an assessment',
    ({ findings }) => {
      const input = scan('COMPLETE', findings);
      input.evidence = [];
      expect(buildAccessibilityReport(input)).toMatchObject({
        assessment: { state: 'NOT_ASSESSED' },
        summary: { findingCount: 0 },
      });
    },
  );
  it('strips canaries and preserves only approved evidence', () => {
    const report = buildAccessibilityReport(scan('COMPLETE', [finding()]));
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0].evidence.sampledReferences).toEqual([
      {
        ordinal: 0,
        tag: 'input',
        role: 'textbox',
        path: [{ tag: 'main', index: 0 }],
      },
    ]);
    expect(report.findings[0].evidence.wcagCriteria).toEqual(['1.3.1']);
    for (const canary of canaries)
      expect(JSON.stringify(report)).not.toContain(canary);
  });
  it.each([
    null,
    {
      kind: 'ACCESSIBILITY_ASSESSMENT',
      version: 2,
      assessment: marker().assessment,
    },
    {
      kind: 'ACCESSIBILITY_ASSESSMENT',
      version: 1,
      assessment: { ...marker().assessment, reasons: [secret] },
    },
    {
      kind: 'ACCESSIBILITY_ASSESSMENT',
      version: 1,
      assessment: { ...marker().assessment, mainDocumentEvaluated: false },
    },
    {
      kind: 'ACCESSIBILITY_ASSESSMENT',
      version: 1,
      assessment: { ...marker().assessment, excludedFrameCount: 1 },
    },
    {
      kind: 'ACCESSIBILITY_ASSESSMENT',
      version: 1,
      assessment: { ...marker().assessment, durationMs: Infinity },
    },
  ])('fails closed on malformed markers', (data) => {
    const input = scan('COMPLETE', [finding()]);
    input.evidence = [{ data }];
    const report = buildAccessibilityReport(input);
    expect(report.assessment.state).toBe('NOT_ASSESSED');
    expect(report.findings).toEqual([]);
    for (const canary of canaries)
      expect(JSON.stringify(report)).not.toContain(canary);
  });
  it('omits invalid finding JSON without changing authoritative coverage', () => {
    const bad = finding();
    Object.assign(bad.evidence, {
      sampledReferences: [{ html: secret }],
      extra: secret,
    });
    const report = buildAccessibilityReport(
      scan('COMPLETE', [
        finding(),
        bad,
        { ...finding(), category: 'SECURITY' },
      ]),
    );
    expect(report.assessment.state).toBe('COMPLETE');
    expect(report.findings).toHaveLength(1);
    expect(report.assessment.limitations).toContain('FINDINGS_OMITTED');
  });
  it('orders findings deterministically and never exposes target URLs', () => {
    const input = scan('PARTIAL', [finding(), finding('image-alt')]);
    Object.assign(input, { targetUrl: secret });
    const first = buildAccessibilityReport(input);
    input.findings = [...input.findings].reverse();
    expect(buildAccessibilityReport(input)).toEqual(first);
    expect(first.scan).toEqual({
      id: 'scan',
      status: 'COMPLETED',
      completedAt: new Date(0).toISOString(),
    });
  });
  it('keeps full assessment validation strict while validating compact coverage', () => {
    const a = marker().assessment;
    expect(projectAccessibilityCoverage(a)).not.toBeNull();
    expect(projectAccessibilityAssessment({ ...a, results: [] })).toBeNull();
  });
  it('flags noncompleted scans without guessing assessment from status', () => {
    const input = scan('PARTIAL');
    input.status = 'RUNNING';
    expect(buildAccessibilityReport(input).assessment).toMatchObject({
      state: 'PARTIAL',
      limitations: ['SCAN_NOT_COMPLETED'],
    });
  });
});
