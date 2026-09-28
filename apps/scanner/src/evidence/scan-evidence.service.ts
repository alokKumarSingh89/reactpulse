import { SECURITY_ASSESSMENT_SEQUENCE } from '../security/security-finding.service';
import { ACCESSIBILITY_ASSESSMENT_SEQUENCE } from '../accessibility/accessibility-finding.service';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { BrowserScanResult } from '../browser/browser.types';
import { projectSafeEvidence } from './safe-evidence';

@Injectable()
export class ScanEvidenceService {
  constructor(private readonly database: DatabaseService) {}

  async replaceForScan(
    scanId: string,
    result: BrowserScanResult,
  ): Promise<void> {
    // Project before opening the transaction: no raw result reaches Prisma.
    const evidence = projectSafeEvidence(result);
    await this.database.client.$transaction(async (tx) => {
      // Category services own their markers and reconcile them atomically with findings.
      // Preserve it here so a later failed reconciliation keeps the old pair.
      await tx.scanEvidence.deleteMany({
        where: {
          scanId,
          NOT: {
            type: 'DOCUMENT_RESPONSE',
            sequence: { in: [SECURITY_ASSESSMENT_SEQUENCE, ACCESSIBILITY_ASSESSMENT_SEQUENCE] },
          },
        },
      });
      await tx.scanEvidence.createMany({
        data: evidence.map((row) => ({ scanId, ...row })),
      });
    });
  }
}
