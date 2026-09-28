import { reconcileFindings } from '../findings/reconcile-findings';
import { Injectable } from '@nestjs/common';
import {
  ACCESSIBILITY_RULE_IDS,
  type AccessibilityAssessment,
  projectAccessibilityAssessment,
} from '@reactpulse/contracts';
import type { Prisma } from '@reactpulse/database';
import { DatabaseService } from '../database/database.service';
import {
  ACCESSIBILITY_FINDING_POLICY,
  ACCESSIBILITY_MAPPING_VERSION,
  type AccessibilityFindingCandidate,
} from './accessibility-finding-mapper';
import { ACCESSIBILITY_RULE_CATALOG } from './accessibility-rule-catalog';

function projectCandidate(
  scanId: string,
  candidate: AccessibilityFindingCandidate,
): Prisma.FindingCreateManyInput {
  const evidence = candidate.evidence;
  // Reuse the safe contract validator for bounded numeric/vocabulary/structural
  // fields. This envelope is validation-only, never an assessment or DB row.
  const normalized = projectAccessibilityAssessment({
    version: 1,
    state: 'PARTIAL',
    scope: 'MAIN_DOCUMENT',
    mainDocumentEvaluated: true,
    engine: {
      name: evidence.engine,
      version: evidence.engineVersion,
      rulesetVersion: evidence.rulesetVersion,
      profileId: evidence.profileId,
    },
    excludedFrameCount: 0,
    reasons: ['REFERENCE_UNAVAILABLE', 'RESULT_LIMIT_EXCEEDED'],
    durationMs: 0,
    configuredRuleCount: 1,
    results: [
      {
        ruleId: evidence.ruleId,
        ruleVersion: evidence.ruleVersion,
        outcome: evidence.outcome,
        engineImpact: evidence.engineImpact,
        occurrenceCount: evidence.occurrenceCount,
        countPrecision: evidence.countPrecision,
        samplesTruncated: evidence.samplesTruncated,
        sampledReferences: evidence.sampledReferences,
        wcagTags: evidence.wcagTags,
        wcagCriteria: evidence.wcagCriteria,
      },
    ],
  });
  const row = normalized?.results[0];
  if (
    !row ||
    !normalized?.engine ||
    evidence.version !== 1 ||
    evidence.mappingVersion !== ACCESSIBILITY_MAPPING_VERSION ||
    evidence.rulesetVersion !== 1 ||
    row.ruleVersion !== 1 ||
    row.outcome !== 'VIOLATION' ||
    candidate.category !== 'ACCESSIBILITY' ||
    candidate.status !== 'OPEN' ||
    candidate.ruleId !== `accessibility.axe-core.${row.ruleId}` ||
    typeof candidate.fingerprint !== 'string' ||
    !/^[a-f0-9]{64}$/.test(candidate.fingerprint) ||
    candidate.affectedUrl !== null ||
    candidate.affectedResource !== 'main-document'
  ) {
    throw new Error('Invalid accessibility finding candidate');
  }
  const [title, description, recommendation] =
    ACCESSIBILITY_RULE_CATALOG[row.ruleId];
  const [severity, confidence] = ACCESSIBILITY_FINDING_POLICY[row.engineImpact];
  if (
    candidate.severity !== severity ||
    candidate.confidence !== confidence ||
    candidate.title !== title ||
    candidate.description !== description ||
    candidate.recommendation !== recommendation
  ) {
    throw new Error('Invalid accessibility finding candidate');
  }
  return {
    scanId,
    category: 'ACCESSIBILITY',
    status: 'OPEN',
    ruleId: candidate.ruleId,
    fingerprint: candidate.fingerprint,
    severity,
    confidence,
    title,
    description,
    recommendation,
    affectedUrl: null,
    affectedResource: 'main-document',
    evidence: {
      version: 1,
      mappingVersion: ACCESSIBILITY_MAPPING_VERSION,
      engine: normalized.engine.name,
      engineVersion: normalized.engine.version,
      rulesetVersion: 1,
      profileId: normalized.engine.profileId,
      ruleId: row.ruleId,
      ruleVersion: 1,
      outcome: 'VIOLATION',
      engineImpact: row.engineImpact,
      occurrenceCount: row.occurrenceCount,
      countPrecision: row.countPrecision,
      samplesTruncated: row.samplesTruncated,
      wcagTags: row.wcagTags.slice(),
      wcagCriteria: row.wcagCriteria.slice(),
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
    },
  };
}

// DOCUMENT_RESPONSE 0 is document evidence; 1 belongs to security.
export const ACCESSIBILITY_ASSESSMENT_SEQUENCE = 2;

@Injectable()
export class AccessibilityFindingService {
  constructor(private readonly database: DatabaseService) {}

  /** Authoritative per-scan replacement, including empty/unavailable evaluations.
   * Matches security reconciliation; timestamps/IDs follow database defaults.
   * No assessment is inferred from an empty candidate list.
   */
  async replaceForScan(
    scanId: string,
    candidates: readonly AccessibilityFindingCandidate[],
    assessment: AccessibilityAssessment | null,
  ): Promise<void> {
    const safe =
      assessment === null ? null : projectAccessibilityAssessment(assessment);
    if (
      (assessment !== null && !safe) ||
      ((!safe ||
        safe.state === 'NOT_ASSESSED' ||
        safe.state === 'UNAVAILABLE') &&
        candidates.length)
    ) {
      throw new Error('Invalid accessibility assessment');
    }
    // Coverage only: rule observations remain in the safe finding evidence.
    const marker =
      safe && safe.state !== 'NOT_ASSESSED'
        ? {
            kind: 'ACCESSIBILITY_ASSESSMENT',
            version: 1,
            assessment: {
              version: safe.version,
              state: safe.state,
              scope: safe.scope,
              engine: safe.engine
                ? {
                    name: safe.engine.name,
                    version: safe.engine.version,
                    rulesetVersion: safe.engine.rulesetVersion,
                    profileId: safe.engine.profileId,
                  }
                : null,
              mainDocumentEvaluated: safe.mainDocumentEvaluated,
              excludedFrameCount: safe.excludedFrameCount,
              reasons: safe.reasons.slice(),
              durationMs: safe.durationMs,
              configuredRuleCount: safe.configuredRuleCount,
            },
          }
        : null;
    const rows = new Map<string, Prisma.FindingCreateManyInput>();
    try {
      if (
        !Array.isArray(candidates) ||
        candidates.length > ACCESSIBILITY_RULE_IDS.length * 2
      ) {
        throw new Error('Invalid accessibility finding candidate');
      }
      const rules = new Map<string, string>();
      for (const candidate of candidates) {
        const row = projectCandidate(scanId, candidate);
        const previous = rows.get(row.fingerprint);
        if (
          (previous && JSON.stringify(previous) !== JSON.stringify(row)) ||
          (rules.has(row.ruleId) && rules.get(row.ruleId) !== row.fingerprint)
        ) {
          throw new Error('Invalid accessibility finding candidate');
        }
        rows.set(row.fingerprint, row);
        rules.set(row.ruleId, row.fingerprint);
      }
    } catch {
      // Never include candidate values or getter exceptions in operational errors.
      throw new Error('Invalid accessibility finding candidate');
    }
    await this.database.client.$transaction(async (tx) => {
      if (marker) {
        await tx.scanEvidence.upsert({
          where: {
            scanId_type_sequence: {
              scanId,
              type: 'DOCUMENT_RESPONSE',
              sequence: ACCESSIBILITY_ASSESSMENT_SEQUENCE,
            },
          },
          create: {
            scanId,
            type: 'DOCUMENT_RESPONSE',
            sequence: ACCESSIBILITY_ASSESSMENT_SEQUENCE,
            data: marker,
          },
          update: { data: marker },
        });
      } else {
        await tx.scanEvidence.deleteMany({
          where: {
            scanId,
            type: 'DOCUMENT_RESPONSE',
            sequence: ACCESSIBILITY_ASSESSMENT_SEQUENCE,
          },
        });
      }
      await reconcileFindings(tx, scanId, 'ACCESSIBILITY', [...rows.values()]);
    }, { isolationLevel: 'Serializable' });
  }
}
