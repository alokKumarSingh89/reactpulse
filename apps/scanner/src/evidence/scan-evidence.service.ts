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
      // Accessibility owns its marker and replaces it atomically with findings.
      // Preserve it here so a later failed reconciliation keeps the old pair.
      await tx.scanEvidence.deleteMany({
        where: {
          scanId,
          NOT: {
            type: 'DOCUMENT_RESPONSE',
            sequence: ACCESSIBILITY_ASSESSMENT_SEQUENCE,
          },
        },
      });
      await tx.scanEvidence.createMany({
        data: evidence.map((row) => ({ scanId, ...row })),
      });
    });
  }
}
