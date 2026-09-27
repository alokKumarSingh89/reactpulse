import {
  PERFORMANCE_FINDING_RULES,
  projectDeterministicFindingCandidate,
  type DeterministicFindingCandidate,
  type PerformanceFindingRuleId,
} from '@reactpulse/contracts';
import { findingFingerprint } from '../findings/finding-fingerprint';
import type { PerformanceMetrics } from './performance.types';

type Candidate = Extract<
  DeterministicFindingCandidate,
  { category: 'PERFORMANCE' }
>;
// Explicit product order, independent of input property ordering. Rules consume
// normalized collector values, not database rows or raw browser observations.
const rules: readonly PerformanceFindingRuleId[] = [
  'performance.lcp.above-good-threshold',
  'performance.synthetic-cls.above-good-threshold',
];
export function evaluatePerformanceFindings(
  metrics: Partial<Pick<PerformanceMetrics, 'lcpMs' | 'cls'>>,
): (Candidate & { fingerprint: string })[] {
  const findings: (Candidate & { fingerprint: string })[] = [];
  for (const ruleId of rules) {
    const rule = PERFORMANCE_FINDING_RULES[ruleId];
    const value = rule.metric === 'lcp' ? metrics.lcpMs : metrics.cls;
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < 0 ||
      value <= rule.threshold
    )
      continue;
    const candidate = projectDeterministicFindingCandidate({
      category: 'PERFORMANCE',
      ruleId,
      ruleVersion: 1,
      severity: 'MEDIUM',
      confidence: 'HIGH',
      affectedResource: { kind: 'MAIN_DOCUMENT' },
      fingerprintIdentity: {
        category: 'PERFORMANCE',
        ruleId,
        ruleVersion: 1,
        subject: { kind: 'MAIN_DOCUMENT' },
        metric: rule.metric,
      },
      evidence: {
        version: 1,
        context: 'SYNTHETIC',
        metric: rule.metric,
        measuredValue: value,
        unit: rule.unit,
        threshold: rule.threshold,
        comparison: 'GT',
      },
    });
    if (candidate?.category === 'PERFORMANCE')
      findings.push({
        ...candidate,
        fingerprint: findingFingerprint(candidate.fingerprintIdentity),
      });
  }
  return findings;
}
