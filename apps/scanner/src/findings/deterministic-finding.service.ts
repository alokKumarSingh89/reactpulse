import { Injectable } from '@nestjs/common';
import {
  projectDeterministicFindingCandidate,
  type DeterministicFindingCandidate,
} from '@reactpulse/contracts';
import { DatabaseService } from '../database/database.service';
import {
  reconcileFindings,
  type ProjectedFindingRow,
} from './reconcile-findings';

type Candidate = Extract<
  DeterministicFindingCandidate,
  { category: 'PERFORMANCE' | 'NETWORK' }
> & { fingerprint: string };
@Injectable()
export class DeterministicFindingService {
  constructor(private readonly database: DatabaseService) {}
  async replaceForScan(
    scanId: string,
    category: 'PERFORMANCE' | 'NETWORK',
    candidates: readonly Candidate[],
  ): Promise<void> {
    const rows: ProjectedFindingRow[] = [];
    try {
      if (!Array.isArray(candidates)) throw new Error();
      for (const input of candidates) {
        const safe = projectDeterministicFindingCandidate(input);
        if (
          !safe ||
          safe.category !== category ||
          !/^[a-f0-9]{64}$/.test(input.fingerprint)
        )
          throw new Error();
        rows.push({
          scanId,
          category,
          fingerprint: input.fingerprint,
          ruleId: safe.ruleId,
          severity: safe.severity,
          confidence: safe.confidence,
          title: safe.title,
          description: safe.description,
          recommendation: safe.recommendation,
          affectedUrl: null,
          affectedResource: 'main-document',
          evidence: { ...safe.evidence, ruleVersion: safe.ruleVersion },
        });
      }
    } catch {
      throw new Error('Invalid deterministic finding candidates');
    }
    await this.database.client.$transaction(
      (tx) => reconcileFindings(tx, scanId, category, rows),
      { isolationLevel: 'Serializable' },
    );
  }
}
