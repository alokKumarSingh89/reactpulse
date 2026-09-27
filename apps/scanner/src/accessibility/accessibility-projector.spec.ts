import { describe, expect, it } from 'vitest';
import {
  ACCESSIBILITY_LIMITS as LIMITS,
  ACCESSIBILITY_RULE_IDS,
  projectAccessibilityAssessment,
} from '@reactpulse/contracts';
import {
  projectAccessibilityObservation as project,
  type AccessibilityStructuralFact,
} from './accessibility-projector';

const canaries = [
  'accessibility-email-canary@example.com',
  'accessibility-token-canary-9182',
  'accessibility-input-secret-7712',
  'accessibility-dom-text-secret-6631',
  'accessibility-id-secret-5520',
];
function fixture(nodes: unknown[] = [{}]) {
  return {
    engine: 'axe-core',
    engineVersion: '4.13.0',
    rulesetVersion: 1,
    scope: 'MAIN_DOCUMENT',
    state: 'SUCCEEDED',
    durationMs: 20,
    excludedFrameCount: 0,
    raw: {
      violations: [
        { id: 'label', impact: 'serious', tags: ['wcag2a', 'wcag131'], nodes },
      ],
      incomplete: [] as unknown[],
      passes: [] as unknown[],
      inapplicable: ACCESSIBILITY_RULE_IDS.filter((id) => id !== 'label').map(
        (id): { id: string; nodes: unknown[] } => ({ id, nodes: [] }),
      ),
    },
  };
}
function fact(nodeIndex = 0): AccessibilityStructuralFact {
  return {
    group: 'violations',
    ruleId: 'label',
    nodeIndex,
    tag: 'INPUT',
    role: 'textbox',
    path: [
      { tag: 'MAIN', index: 0 },
      { tag: 'input', index: nodeIndex },
    ],
  };
}
function assertSafe(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const canary of canaries) expect(serialized).not.toContain(canary);
  expect(serialized.length).toBeLessThanOrEqual(LIMITS.serializedBytes);
  expect(projectAccessibilityAssessment(value)).toEqual(value);
}

describe('accessibility safe projection', () => {
  it('explicitly excludes secret-bearing raw fields and projects structural facts only', () => {
    const secret = canaries.join(' ');
    const url = `https://user:${canaries[1]}@example.com/reset?token=${canaries[1]}#${canaries[3]}`;
    const node = {
      html: secret,
      target: [secret],
      failureSummary: secret,
      id: secret,
      class: secret,
      'aria-label': secret,
      value: secret,
      href: url,
      src: url,
      text: secret,
      'data-account': secret,
      metadata: { secret },
      error: new Error(secret),
    };
    const raw = fixture([node]);
    Object.assign(raw, { url, error: secret, debug: node });
    Object.assign(raw.raw.violations[0], {
      help: secret,
      description: secret,
      helpUrl: url,
    });
    const structure = Object.assign(fact(), { id: secret, html: secret });
    const result = project(raw, [structure]);
    assertSafe(result);
    expect(result.state).toBe('COMPLETE');
    expect(
      result.results.find((r) => r.ruleId === 'label')?.sampledReferences,
    ).toEqual([
      {
        ordinal: 0,
        tag: 'input',
        role: 'textbox',
        path: [
          { tag: 'main', index: 0 },
          { tag: 'input', index: 0 },
        ],
      },
    ]);
  });

  it('does not reconstruct references from HTML or selectors, including missing targets', () => {
    const result = project(
      fixture([{}, { target: ['#private'], html: '<input>' }]),
    );
    expect(result.state).toBe('PARTIAL');
    expect(result.reasons).toContain('REFERENCE_UNAVAILABLE');
    expect(
      result.results.find((r) => r.ruleId === 'label')?.sampledReferences,
    ).toEqual([]);
    assertSafe(result);
  });

  it('normalizes and deduplicates approved WCAG tags and impacts', () => {
    const raw = fixture();
    raw.raw.violations[0].tags = [
      'wcag131',
      'WCAG2A',
      'wcag2a',
      'unknown',
      canaries[0],
    ];
    raw.raw.violations[0].impact = 'SERIOUS';
    const row = project(raw).results.find((r) => r.ruleId === 'label');
    expect(row?.wcagTags).toEqual(['wcag2a']);
    expect(row?.wcagCriteria).toEqual(['1.3.1']);
    expect(row?.engineImpact).toBe('SERIOUS');
    raw.raw.violations[0].impact = canaries[1];
    const result = project(raw);
    expect(result.results.find((r) => r.ruleId === 'label')?.engineImpact).toBe(
      'UNKNOWN',
    );
    expect(result.reasons).toContain('NEEDS_REVIEW');
    assertSafe(result);
  });

  it.each(['', 'x'.repeat(10000), canaries[4]])(
    'rejects unknown or missing rule identity',
    (id) => {
      const raw = fixture();
      raw.raw.violations[0].id = id;
      const result = project(raw);
      expect(result.results.some((r) => r.outcome === 'VIOLATION')).toBe(false);
      expect(result.state).toBe('PARTIAL');
      expect(result.reasons).toContain('UNSUPPORTED_RULE');
      assertSafe(result);
    },
  );

  it('fails closed on malformed values and hostile getters', () => {
    for (const value of [
      null,
      [],
      {},
      {
        get engine() {
          throw new Error(canaries[0]);
        },
      },
    ]) {
      const result = project(value);
      expect(result.state).toBe('UNAVAILABLE');
      assertSafe(result);
    }
    const result = project(fixture([null, 42, []]));
    expect(result.reasons).toContain('INVALID_ENGINE_RESULT');
    assertSafe(result);
  });

  it('rejects invalid structural tags, indexes, roles, and excessive depth', () => {
    const variants = [
      { ...fact(), tag: canaries[4] },
      { ...fact(), role: canaries[0] },
      { ...fact(), path: [{ tag: 'input', index: -1 }] },
      {
        ...fact(),
        path: Array.from({ length: LIMITS.pathSegments + 1 }, () => ({
          tag: 'div',
          index: 0,
        })),
      },
    ];
    for (const structure of variants) {
      const result = project(fixture(), [structure]);
      expect(result.reasons).toContain('REFERENCE_UNAVAILABLE');
      expect(
        result.results.find((r) => r.ruleId === 'label')?.sampledReferences,
      ).toEqual([]);
      assertSafe(result);
    }
  });

  it('maps failures without retaining exceptions, URLs, or error messages', () => {
    for (const reason of [
      'ENGINE_TIMEOUT',
      'ENGINE_UNAVAILABLE',
      'PAGE_CONTEXT_UNAVAILABLE',
      'NODE_LIMIT_REACHED',
      'NAVIGATION_CHANGED',
    ]) {
      const result = project({
        ...fixture(),
        state: 'UNAVAILABLE',
        reason,
        error: { message: canaries.join(' '), stack: canaries[2] },
        url: '%%%bad-url',
      });
      expect(result.state).toBe('UNAVAILABLE');
      expect(result.reasons).toContain(reason);
      expect(result.results).toEqual([]);
      expect(result.mainDocumentEvaluated).toBe(false);
      assertSafe(result);
    }
  });

  it('represents excluded frames and incomplete results as partial coverage', () => {
    const raw = fixture();
    raw.excludedFrameCount = 2;
    raw.raw.incomplete = raw.raw.violations;
    raw.raw.violations = [];
    const result = project(raw);
    expect(result.state).toBe('PARTIAL');
    expect(result.reasons).toContain('FRAME_COVERAGE_PARTIAL');
    expect(result.reasons).toContain('NEEDS_REVIEW');
    assertSafe(result);
  });

  it('supports complete automated evaluation with zero violations', () => {
    const raw = fixture();
    raw.raw.violations = [];
    raw.raw.inapplicable = ACCESSIBILITY_RULE_IDS.map((id) => ({
      id,
      nodes: [],
    }));
    const result = project(raw);
    expect(result.state).toBe('COMPLETE');
    expect(result.mainDocumentEvaluated).toBe(true);
    expect(result.results.every((r) => r.outcome === 'INAPPLICABLE')).toBe(
      true,
    );
    assertSafe(result);
  });

  it('bounds huge node/rule arrays while retaining useful occurrence counts', () => {
    const raw = fixture(
      Array.from({ length: LIMITS.occurrences + 100 }, () => ({})),
    );
    const structures = Array.from({ length: LIMITS.samplesPerRule }, (_, i) =>
      fact(i),
    );
    const result = project(raw, structures);
    const row = result.results.find((r) => r.ruleId === 'label');
    expect(row?.occurrenceCount).toBe(LIMITS.occurrences);
    expect(row?.countPrecision).toBe('LOWER_BOUND');
    expect(row?.sampledReferences).toHaveLength(LIMITS.samplesPerRule);
    expect(row?.samplesTruncated).toBe(true);
    expect(result.reasons).toContain('RESULT_LIMIT_EXCEEDED');
    assertSafe(result);
    raw.raw.violations.push(
      ...Array.from({ length: 500 }, () => ({
        id: canaries[4],
        impact: 'unknown',
        tags: [],
        nodes: [],
      })),
    );
    const huge = project(raw);
    expect(huge.results.length).toBeLessThanOrEqual(LIMITS.rules);
    expect(huge.reasons).toContain('RESULT_LIMIT_EXCEEDED');
    assertSafe(huge);
  });

  it('bounds aggregate size even with maximum-depth samples across all rules', () => {
    const raw = fixture();
    raw.raw.inapplicable = [];
    raw.raw.violations = ACCESSIBILITY_RULE_IDS.map((id) => ({
      id,
      impact: 'serious',
      tags: [],
      nodes: Array.from({ length: LIMITS.samplesPerRule }, () => ({})),
    }));
    const facts = ACCESSIBILITY_RULE_IDS.flatMap((ruleId) =>
      Array.from({ length: LIMITS.samplesPerRule }, (_, nodeIndex) => ({
        ...fact(nodeIndex),
        ruleId,
        path: Array.from({ length: LIMITS.pathSegments }, () => ({
          tag: 'section',
          index: 19999,
        })),
      })),
    );
    const result = project(raw, facts);
    expect(result.state).toBe('PARTIAL');
    expect(result.reasons).toContain('RESULT_LIMIT_EXCEEDED');
    expect(result.results).toHaveLength(ACCESSIBILITY_RULE_IDS.length);
    assertSafe(result);
  });

  it('produces deterministic output without modifying raw inputs', () => {
    const raw = fixture();
    const before = JSON.stringify(raw);
    const first = project(raw, [fact()]);
    expect(project(raw, [fact()])).toEqual(first);
    raw.raw.inapplicable.reverse();
    expect(project(raw, [fact()])).toEqual(first);
    raw.raw.inapplicable.reverse();
    expect(JSON.stringify(raw)).toBe(before);
  });
});
