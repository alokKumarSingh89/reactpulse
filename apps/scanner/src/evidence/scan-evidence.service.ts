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
      // Replacement semantics preserve retry safety for the current attempt.
      await tx.scanEvidence.deleteMany({ where: { scanId } });
      await tx.scanEvidence.createMany({
        data: evidence.map((row) => ({ scanId, ...row })),
      });
    });
  }
}
