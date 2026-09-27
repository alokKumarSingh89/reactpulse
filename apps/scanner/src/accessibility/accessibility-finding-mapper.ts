import { findingFingerprint } from '../findings/finding-fingerprint';
import {
  ACCESSIBILITY_RULE_IDS,
  projectAccessibilityAssessment,
  type AccessibilityAssessment,
  type AccessibilityRuleObservation,
} from '@reactpulse/contracts';
// Type-only enum reuse: no Prisma runtime or database access.
import type { FindingConfidence, FindingSeverity } from '@reactpulse/database';
import { ACCESSIBILITY_RULE_CATALOG } from './accessibility-rule-catalog';

export const ACCESSIBILITY_MAPPING_VERSION = 1 as const;
/** Impact is not a compliance verdict. Unknown impact must not be escalated.
 * Confidence describes the automated detection, never total WCAG coverage. */
export const ACCESSIBILITY_FINDING_POLICY = {
  CRITICAL: ['HIGH', 'MEDIUM'],
  SERIOUS: ['HIGH', 'MEDIUM'],
  MODERATE: ['MEDIUM', 'MEDIUM'],
  MINOR: ['LOW', 'MEDIUM'],
  UNKNOWN: ['INFO', 'LOW'],
} as const satisfies Record<
  AccessibilityRuleObservation['engineImpact'],
  readonly [FindingSeverity, FindingConfidence]
>;

export interface AccessibilityFindingCandidate {
  category: 'ACCESSIBILITY';
  ruleId: `accessibility.axe-core.${AccessibilityRuleObservation['ruleId']}`;
  fingerprint: string;
  severity: FindingSeverity;
  confidence: FindingConfidence;
  status: 'OPEN';
  title: string;
  description: string;
  recommendation: string;
  affectedUrl: null;
  affectedResource: 'main-document';
  evidence: {
    version: 1;
    mappingVersion: typeof ACCESSIBILITY_MAPPING_VERSION;
    engine: 'axe-core';
    engineVersion: string;
    rulesetVersion: number;
    profileId: 'main-document-v1';
    ruleId: AccessibilityRuleObservation['ruleId'];
    ruleVersion: number;
    engineImpact: AccessibilityRuleObservation['engineImpact'];
    outcome: 'VIOLATION';
    occurrenceCount: number;
    countPrecision: AccessibilityRuleObservation['countPrecision'];
    samplesTruncated: boolean;
    sampledReferences: AccessibilityRuleObservation['sampledReferences'];
    wcagTags: AccessibilityRuleObservation['wcagTags'];
    wcagCriteria: AccessibilityRuleObservation['wcagCriteria'];
  };
}

/** Accepts normalized observations only, never raw axe output. Reprojection
 * defends the runtime boundary and strips extra properties. Unsupported IDs or
 * malformed assessments fail closed as a whole; callers retain the assessment
 * separately and must never interpret an empty candidate list as compliance.
 */
export function mapAccessibilityFindings(
  input: AccessibilityAssessment,
): AccessibilityFindingCandidate[] {
  const assessment = projectAccessibilityAssessment(input);
  if (
    !assessment ||
    !assessment.engine ||
    !['COMPLETE', 'PARTIAL'].includes(assessment.state) ||
    assessment.engine.rulesetVersion !== 1
  )
    return [];
  const engine = assessment.engine;
  const candidates: AccessibilityFindingCandidate[] = [];
  // Contract order is stable across input permutations and locale settings.
  for (const id of ACCESSIBILITY_RULE_IDS) {
    const row = assessment.results.find((result) => result.ruleId === id);
    if (!row || row.outcome !== 'VIOLATION' || row.ruleVersion !== 1) continue;
    const [title, description, recommendation] = ACCESSIBILITY_RULE_CATALOG[id];
    const [severity, confidence] =
      ACCESSIBILITY_FINDING_POLICY[row.engineImpact];
    const ruleId = `accessibility.axe-core.${id}` as const;
    const fingerprint = findingFingerprint({
      category: 'ACCESSIBILITY',
      ruleId,
      ruleVersion: row.ruleVersion,
      subject: { kind: 'MAIN_DOCUMENT' },
      engine: engine.name,
      engineRuleId: id,
      rulesetVersion: engine.rulesetVersion,
      mappingVersion: ACCESSIBILITY_MAPPING_VERSION,
      profileId: engine.profileId,
    });
    candidates.push({
      category: 'ACCESSIBILITY',
      ruleId,
      fingerprint,
      severity,
      confidence,
      status: 'OPEN',
      title,
      description,
      recommendation,
      affectedUrl: null,
      affectedResource: 'main-document',
      evidence: {
        version: 1,
        mappingVersion: ACCESSIBILITY_MAPPING_VERSION,
        engine: engine.name,
        engineVersion: engine.version,
        rulesetVersion: engine.rulesetVersion,
        profileId: engine.profileId,
        ruleId: id,
        ruleVersion: row.ruleVersion,
        engineImpact: row.engineImpact,
        outcome: 'VIOLATION',
        occurrenceCount: row.occurrenceCount,
        countPrecision: row.countPrecision,
        samplesTruncated: row.samplesTruncated,
        sampledReferences: row.sampledReferences
          .slice()
          .sort((a, b) => a.ordinal - b.ordinal)
          .map((sample) => ({
            ordinal: sample.ordinal,
            tag: sample.tag,
            role: sample.role,
            path:
              sample.path?.map((segment) => ({
                tag: segment.tag,
                index: segment.index,
              })) ?? null,
          })),
        wcagTags: row.wcagTags.slice(),
        wcagCriteria: row.wcagCriteria.slice(),
      },
    });
  }
  return candidates;
}
