import { SECURITY_FINDING_PRESENTATION as templates } from '@reactpulse/contracts';
import { Injectable } from '@nestjs/common';
import { findingFingerprint } from '../findings/finding-fingerprint';
import type { SafeFindingResource } from '@reactpulse/contracts';
import type { Prisma } from '@reactpulse/database';
import { DatabaseService } from '../database/database.service';
import {
  SECURITY_RULE_POLICY,
  SECURITY_RULE_VERSION,
  type SecurityRuleEvaluation,
  type SecurityRuleResult,
} from './security-rules';

// DOCUMENT_RESPONSE sequence 0 is the existing document summary. Sequence 1 is
// reserved for passive-security coverage, even when no document was observable.
// This marker is not a Finding and must survive a zero-finding reconciliation.
const ASSESSMENT_SEQUENCE = 1;
const reasons = [
  'MAIN_DOCUMENT_UNAVAILABLE',
  'HEADERS_UNAVAILABLE',
  'COOKIE_OBSERVATION_UNAVAILABLE',
  'NETWORK_OBSERVATION_UNAVAILABLE',
  'INITIATOR_UNKNOWN',
  'NAVIGATION_CHANGED',
  'UNSUPPORTED_SYNTAX',
  'OBSERVATION_LIMIT_REACHED',
  'COLLECTION_FAILED',
] as const;

function projectFinding(
  scanId: string,
  result: SecurityRuleResult,
): Prisma.FindingCreateManyInput | null {
  if (result.outcome !== 'POSTURE') return null;
  if (
    !Object.hasOwn(templates, result.ruleId) ||
    result.ruleVersion !== SECURITY_RULE_VERSION
  )
    throw new Error('Unsupported security finding result');
  const ruleId = result.ruleId as keyof typeof templates;
  const [reason, source, title, description, recommendation] =
    templates[ruleId];
  const [severity, confidence] = SECURITY_RULE_POLICY[ruleId];
  // Validate the evaluator's mapping, never upgrade/reinterpret an outcome.
  if (
    result.reason !== reason ||
    result.evidence.source !== source ||
    result.severity !== severity ||
    result.confidence !== confidence
  )
    throw new Error('Invalid security finding result');
  const subject = result.evidence.subject;
  let affectedResource: string;
  let safeSubject: SafeFindingResource;
  if (source === 'cookies') {
    if (
      subject.kind !== 'COOKIE' ||
      !Number.isSafeInteger(subject.documentResponseOrdinal) ||
      subject.documentResponseOrdinal < 0 ||
      subject.documentResponseOrdinal >= 32 ||
      !Number.isSafeInteger(subject.cookieOrdinal) ||
      subject.cookieOrdinal < 0 ||
      subject.cookieOrdinal >= 100
    )
      throw new Error('Invalid security finding subject');
    affectedResource = `document:${subject.documentResponseOrdinal}:cookie:${subject.cookieOrdinal}`;
    safeSubject = {
      kind: 'COOKIE',
      documentResponseOrdinal: subject.documentResponseOrdinal,
      cookieOrdinal: subject.cookieOrdinal,
    };
  } else {
    if (subject.kind !== 'MAIN_DOCUMENT')
      throw new Error('Invalid security finding subject');
    affectedResource = 'main-document';
    safeSubject = { kind: 'MAIN_DOCUMENT' };
  }
  const fingerprint = findingFingerprint({
    category: 'SECURITY',
    ruleId,
    ruleVersion: SECURITY_RULE_VERSION,
    subject: safeSubject,
  });
  return {
    scanId,
    category: 'SECURITY',
    ruleId,
    fingerprint,
    severity,
    confidence,
    status: 'OPEN',
    title,
    description,
    recommendation,
    affectedUrl: null,
    affectedResource,
    evidence: {
      version: 1,
      ruleVersion: SECURITY_RULE_VERSION,
      outcome: 'POSTURE',
      reason,
      source,
      subject: safeSubject,
    },
  };
}

@Injectable()
export class SecurityFindingService {
  constructor(private readonly database: DatabaseService) {}

  async replaceForScan(
    scanId: string,
    evaluation: SecurityRuleEvaluation | null,
  ): Promise<void> {
    if (
      evaluation &&
      (evaluation.results.length > 12816 ||
        evaluation.coverage.version !== 1 ||
        evaluation.coverage.rulesetVersion !== SECURITY_RULE_VERSION ||
        !['COMPLETE', 'PARTIAL', 'UNAVAILABLE'].includes(
          evaluation.coverage.state,
        ))
    )
      throw new Error('Invalid security assessment');
    const rows = new Map<string, Prisma.FindingCreateManyInput>();
    for (const result of evaluation?.results ?? []) {
      const row = projectFinding(scanId, result);
      if (row) rows.set(row.fingerprint, row);
    }
    const marker = evaluation
      ? {
          kind: 'PASSIVE_SECURITY_ASSESSMENT',
          coverage: {
            version: 1,
            rulesetVersion: SECURITY_RULE_VERSION,
            state: evaluation.coverage.state,
            reasons: reasons.filter((reason) =>
              evaluation.coverage.reasons.includes(reason),
            ),
          },
        }
      : null;
    await this.database.client.$transaction(async (tx) => {
      await tx.finding.deleteMany({ where: { scanId, category: 'SECURITY' } });
      if (rows.size) await tx.finding.createMany({ data: [...rows.values()] });
      if (marker) {
        await tx.scanEvidence.upsert({
          where: {
            scanId_type_sequence: {
              scanId,
              type: 'DOCUMENT_RESPONSE',
              sequence: ASSESSMENT_SEQUENCE,
            },
          },
          create: {
            scanId,
            type: 'DOCUMENT_RESPONSE',
            sequence: ASSESSMENT_SEQUENCE,
            data: marker,
          },
          update: { data: marker },
        });
      } else {
        // Absent browser assessment is distinct from assessed with zero findings.
        await tx.scanEvidence.deleteMany({
          where: {
            scanId,
            type: 'DOCUMENT_RESPONSE',
            sequence: ASSESSMENT_SEQUENCE,
          },
        });
      }
    });
  }
}
