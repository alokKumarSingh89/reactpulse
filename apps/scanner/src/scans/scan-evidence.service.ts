import { Injectable } from '@nestjs/common';
import { Prisma, ScanEvidenceType } from '@reactpulse/database';

import type { BrowserScanResult } from '../browser/browser.types';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ScanEvidenceService {
  constructor(private readonly database: DatabaseService) {}

  async replaceBrowserEvidence(
    scanId: string,
    result: BrowserScanResult,
  ): Promise<void> {
    await this.database.client.$transaction(async (transaction) => {
      await transaction.scanEvidence.deleteMany({
        where: {
          scanId,
        },
      });

      await transaction.scanEvidence.create({
        data: {
          scanId,
          type: ScanEvidenceType.BROWSER,
          sequence: 0,
          data: this.toJson(result.browser),
        },
      });

      await transaction.scanEvidence.create({
        data: {
          scanId,
          type: ScanEvidenceType.NAVIGATION,
          sequence: 0,
          data: this.toJson(result.navigation),
        },
      });

      if (result.documentResponse) {
        await transaction.scanEvidence.create({
          data: {
            scanId,
            type: ScanEvidenceType.DOCUMENT_RESPONSE,
            sequence: 0,
            data: this.toJson(result.documentResponse),
          },
        });
      }

      if (result.requests.length > 0) {
        await transaction.scanEvidence.createMany({
          data: result.requests.map((request, index) => ({
            scanId,

            type: ScanEvidenceType.NETWORK_REQUEST,

            sequence: index,

            data: this.toJson(request),
          })),
        });
      }

      if (result.consoleMessages.length > 0) {
        await transaction.scanEvidence.createMany({
          data: result.consoleMessages.map((message, index) => ({
            scanId,

            type: ScanEvidenceType.CONSOLE,

            sequence: index,

            data: this.toJson(message),
          })),
        });
      }
    });
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
