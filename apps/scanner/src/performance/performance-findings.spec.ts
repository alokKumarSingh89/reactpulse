import { describe, expect, it } from 'vitest';
import { evaluatePerformanceFindings as evaluate } from './performance-findings';
import { findingFingerprint } from '../findings/finding-fingerprint';

describe('performance findings', () => {
  it.each([
    [2499, 0],
    [2500, 0],
    [2501, 1],
    [2500.1, 1],
  ])('LCP boundary %s', (lcpMs, count) => {
    expect(evaluate({ lcpMs })).toHaveLength(count);
  });
  it.each([
    [0.099, 0],
    [0.1, 0],
    [0.101, 1],
  ])('synthetic CLS boundary %s', (cls, count) => {
    expect(evaluate({ cls })).toHaveLength(count);
  });
  it.each([undefined, null, NaN, Infinity, -Infinity, -1])(
    'ignores invalid or missing metrics %s',
    (value) => {
      const input = Object.assign({}, { lcpMs: value, cls: value });
      // Exercise malformed JSON/runtime data through the public evaluation path.
      expect(
        evaluate({ lcpMs: input.lcpMs, cls: input.cls ?? undefined }),
      ).toEqual([]);
    },
  );
  it('emits only violating conditions in fixed order with exact policy and safe evidence', () => {
    expect(evaluate({ lcpMs: 2500, cls: 0.1 })).toEqual([]);
    const lcp = evaluate({ lcpMs: 3000, cls: 0.1 });
    const cls = evaluate({ lcpMs: 2500, cls: 0.2 });
    const both = evaluate({ lcpMs: 3000, cls: 0.2 });
    expect(both).toEqual([...lcp, ...cls]);
    expect(both).toEqual(evaluate({ cls: 0.2, lcpMs: 3000 }));
    expect(both.map((f) => f.ruleId)).toEqual([
      'performance.lcp.above-good-threshold',
      'performance.synthetic-cls.above-good-threshold',
    ]);
    for (const f of both) {
      expect(f).toMatchObject({
        category: 'PERFORMANCE',
        ruleVersion: 1,
        severity: 'MEDIUM',
        confidence: 'HIGH',
        affectedResource: { kind: 'MAIN_DOCUMENT' },
      });
      expect(f.description).toContain('synthetic scan');
      expect(f.recommendation).toContain('does not identify');
      expect(f).not.toHaveProperty('status');
    }
    expect(lcp[0].evidence).toEqual({
      version: 1,
      context: 'SYNTHETIC',
      metric: 'lcp',
      measuredValue: 3000,
      unit: 'ms',
      threshold: 2500,
      comparison: 'GT',
    });
    expect(cls[0].evidence).toEqual({
      version: 1,
      context: 'SYNTHETIC',
      metric: 'synthetic_cls',
      measuredValue: 0.2,
      unit: 'score',
      threshold: 0.1,
      comparison: 'GT',
    });
    expect(evaluate({ lcpMs: 9000, cls: 2 }).map((f) => f.severity)).toEqual([
      'MEDIUM',
      'MEDIUM',
    ]);
  });
  it('keeps logical identity independent of values and version-aware', () => {
    const a = evaluate({ lcpMs: 3000, cls: 0.2 });
    const b = evaluate({ lcpMs: 3500, cls: 0.3 });
    expect(a.map((f) => f.fingerprint)).toEqual(b.map((f) => f.fingerprint));
    expect(new Set(a.map((f) => f.fingerprint)).size).toBe(2);
    for (const f of a) {
      const reordered = {
        metric: f.fingerprintIdentity.metric,
        subject: f.fingerprintIdentity.subject,
        ruleVersion: 1,
        ruleId: f.ruleId,
        category: 'PERFORMANCE' as const,
      };
      expect(findingFingerprint(reordered)).toBe(f.fingerprint);
      expect(findingFingerprint({ ...reordered, ruleVersion: 2 })).not.toBe(
        f.fingerprint,
      );
    }
  });
  it('ignores deferred measurements and never reads unrelated hostile metadata', () => {
    const canaries = [
      'performance-email-canary@example.com',
      'performance-token-canary-9182',
      'performance-input-secret-7712',
      'performance-dom-secret-6631',
      'performance-url-secret-5520',
    ];
    const input = {
      lcpMs: 3000,
      cls: 0.2,
      ttfbMs: 99999,
      fcpMs: 99999,
      longTaskCount: 99999,
      domNodes: 99999,
      raw: canaries,
      get headers() {
        throw new Error('Do not read raw metadata');
      },
    };
    const actual = evaluate(input);
    expect(actual).toEqual(evaluate({ lcpMs: 3000, cls: 0.2 }));
    for (const c of canaries) expect(JSON.stringify(actual)).not.toContain(c);
  });
});
