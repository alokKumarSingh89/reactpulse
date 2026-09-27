import { describe, expect, it } from 'vitest';
import {
  ACCESSIBILITY_RULE_IDS,
  type AccessibilityAssessment,
  type AccessibilityRuleObservation,
} from '@reactpulse/contracts';
import { mapAccessibilityFindings as map } from './accessibility-finding-mapper';
import { ACCESSIBILITY_RULE_CATALOG as catalog } from './accessibility-rule-catalog';
import { projectAccessibilityObservation } from './accessibility-projector';

function fixture(
  ids: readonly AccessibilityRuleObservation['ruleId'][] = ['label'],
): AccessibilityAssessment {
  return {
    version: 1,
    state: 'COMPLETE',
    scope: 'MAIN_DOCUMENT',
    mainDocumentEvaluated: true,
    engine: {
      name: 'axe-core',
      version: '4.13.0',
      rulesetVersion: 1,
      profileId: 'main-document-v1',
    },
    excludedFrameCount: 0,
    reasons: [],
    durationMs: 10,
    configuredRuleCount: ids.length,
    results: ids.map((ruleId) => ({
      ruleId,
      ruleVersion: 1,
      outcome: 'VIOLATION',
      engineImpact: 'SERIOUS',
      occurrenceCount: 2,
      countPrecision: 'EXACT',
      samplesTruncated: false,
      sampledReferences: [0, 1].map((ordinal) => ({
        ordinal,
        tag: 'input',
        role: 'textbox',
        path: [{ tag: 'input', index: ordinal }],
      })),
      wcagTags: ['wcag2a'],
      wcagCriteria: ['1.3.1'],
    })),
  };
}

describe('accessibility finding mapper', () => {
  it.each(ACCESSIBILITY_RULE_IDS)(
    'maps reviewed catalog rule %s using application prose',
    (id) => {
      const [finding] = map(fixture([id]));
      expect(finding).toMatchObject({
        category: 'ACCESSIBILITY',
        ruleId: `accessibility.axe-core.${id}`,
        status: 'OPEN',
        title: catalog[id][0],
        description: catalog[id][1],
        recommendation: catalog[id][2],
        severity: 'HIGH',
        confidence: 'MEDIUM',
        affectedUrl: null,
        affectedResource: 'main-document',
        evidence: {
          ruleId: id,
          engine: 'axe-core',
          engineVersion: '4.13.0',
          mappingVersion: 1,
          wcagTags: ['wcag2a'],
          wcagCriteria: ['1.3.1'],
          occurrenceCount: 2,
        },
      });
      expect(finding.evidence.sampledReferences).toEqual(
        fixture([id]).results[0].sampledReferences,
      );
      expect(finding.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    },
  );

  it.each([
    ['CRITICAL', 'HIGH', 'MEDIUM'],
    ['SERIOUS', 'HIGH', 'MEDIUM'],
    ['MODERATE', 'MEDIUM', 'MEDIUM'],
    ['MINOR', 'LOW', 'MEDIUM'],
    ['UNKNOWN', 'INFO', 'LOW'],
  ] as const)(
    'maps %s impact conservatively',
    (impact, severity, confidence) => {
      const input = fixture();
      input.results[0].engineImpact = impact;
      expect(map(input)[0]).toMatchObject({ severity, confidence });
    },
  );

  it('keeps identity stable across counts, sample order, and engine patch versions', () => {
    const input = fixture(['label', 'image-alt']);
    const original = map(input);
    input.results = input.results.slice().reverse();
    input.results[0].sampledReferences = input.results[0].sampledReferences
      .slice()
      .reverse();
    expect(map(input)).toEqual(original);
    input.state = 'PARTIAL';
    input.reasons = ['REFERENCE_UNAVAILABLE'];
    input.results[0].occurrenceCount = 3;
    if (input.engine) input.engine.version = '4.13.1';
    expect(map(input).map((f) => f.fingerprint)).toEqual(
      original.map((f) => f.fingerprint),
    );
    expect(new Set(original.map((f) => f.fingerprint)).size).toBe(2);
  });

  it('does not generate coverage, pass, inapplicable, or review-only findings', () => {
    for (const outcome of ['PASS', 'INAPPLICABLE', 'NEEDS_REVIEW'] as const) {
      const input = fixture();
      input.results[0].outcome = outcome;
      if (outcome === 'INAPPLICABLE') {
        input.results[0].occurrenceCount = 0;
        input.results[0].sampledReferences = [];
      }
      if (outcome === 'NEEDS_REVIEW') {
        input.state = 'PARTIAL';
        input.reasons = ['NEEDS_REVIEW'];
      }
      expect(map(input)).toEqual([]);
    }
    const input = fixture();
    input.state = 'PARTIAL';
    input.reasons = ['FRAME_COVERAGE_PARTIAL'];
    input.excludedFrameCount = 2;
    const before = JSON.stringify(input);
    expect(map(input)).toHaveLength(1);
    expect(JSON.stringify(input)).toBe(before);
    for (const state of ['UNAVAILABLE', 'NOT_ASSESSED'] as const) {
      input.state = state;
      input.engine = null;
      input.mainDocumentEvaluated = false;
      input.results = [];
      input.durationMs = null;
      input.configuredRuleCount = 0;
      input.excludedFrameCount = 0;
      input.reasons = [
        state === 'UNAVAILABLE' ? 'ENGINE_TIMEOUT' : 'ANALYSIS_NOT_RUN',
      ];
      expect(map(input)).toEqual([]);
    }
  });

  it('fails closed on future rules, malformed input and unsupported rule versions', () => {
    const input = fixture();
    Object.assign(input.results[0], {
      ruleId: 'future-rule',
      help: 'private engine prose',
    });
    expect(map(input)).toEqual([]);
    expect(map(Object.assign(fixture(), { version: 99 }))).toEqual([]);
    const future = fixture();
    future.results[0].ruleVersion = 2;
    expect(map(future)).toEqual([]);
  });

  it('excludes privacy canaries from projected hostile engine data and extra safe-object properties', () => {
    const canaries = [
      'accessibility-email-canary@example.com',
      'accessibility-token-canary-9182',
      'accessibility-input-secret-7712',
      'accessibility-dom-text-secret-6631',
      'accessibility-id-secret-5520',
    ];
    const secret = canaries.join(' ');
    const safe = projectAccessibilityObservation({
      engine: 'axe-core',
      engineVersion: '4.13.0',
      rulesetVersion: 1,
      scope: 'MAIN_DOCUMENT',
      state: 'SUCCEEDED',
      durationMs: 10,
      excludedFrameCount: 0,
      raw: {
        violations: [
          {
            id: 'label',
            impact: 'serious',
            tags: ['wcag2a'],
            help: secret,
            nodes: [
              {
                html: secret,
                target: [secret],
                failureSummary: secret,
                value: secret,
                href: secret,
              },
            ],
          },
        ],
        passes: [],
        incomplete: [],
        inapplicable: [],
        url: secret,
        error: secret,
      },
    });
    Object.assign(safe.results[0], {
      help: secret,
      description: secret,
      metadata: { secret },
    });
    const findings = map(safe);
    expect(findings).toHaveLength(1);
    for (const canary of canaries)
      expect(JSON.stringify(findings)).not.toContain(canary);
    expect(findings[0].description).toBe(catalog.label[1]);
    expect(findings[0].recommendation).toBe(catalog.label[2]);
    expect(map(safe)).toEqual(findings);
  });
});
