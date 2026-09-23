import { Injectable } from '@nestjs/common';

import { ScanEvidenceType } from '@reactpulse/database';

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
      /*
       * Evidence belongs to one execution
       * of this scan.
       *
       * BullMQ retries therefore replace
       * the previous attempt.
       */
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

          data: result.browser,
        },
      });

      await transaction.scanEvidence.create({
        data: {
          scanId,

          type: ScanEvidenceType.NAVIGATION,

          sequence: 0,

          data: result.navigation,
        },
      });

      if (result.documentResponse) {
        await transaction.scanEvidence.create({
          data: {
            scanId,

            type: ScanEvidenceType.DOCUMENT_RESPONSE,

            sequence: 0,

            data: result.documentResponse,
          },
        });
      }

      if (result.requests.length > 0) {
        await transaction.scanEvidence.createMany({
          data: result.requests.map((request, index) => ({
            scanId,

            type: ScanEvidenceType.NETWORK_REQUEST,

            sequence: index,

            data: request,
          })),
        });
      }

      if (result.consoleMessages.length > 0) {
        await transaction.scanEvidence.createMany({
          data: result.consoleMessages.map((message, index) => ({
            scanId,

            type: ScanEvidenceType.CONSOLE,

            sequence: index,

            data: message,
          })),
        });
      }

      /*
       * Performance summary.
       */
      await transaction.scanEvidence.create({
        data: {
          scanId,

          type: ScanEvidenceType.PERFORMANCE,

          sequence: 0,

          data: result.performance.metrics,
        },
      });

      /*
       * Individual long tasks are retained
       * because later findings/source
       * correlation can use them.
       */
      if (result.performance.longTasks.length > 0) {
        await transaction.scanEvidence.createMany({
          data: result.performance.longTasks.map((task, index) => ({
            scanId,

            type: ScanEvidenceType.LONG_TASK,

            sequence: index,

            data: task,
          })),
        });
      }
    });
  }
}
