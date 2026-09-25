import { Injectable } from '@nestjs/common';
import type { Prisma } from '@reactpulse/database';

import type { BrowserScanResult } from '../browser/browser.types';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ScanEvidenceService {
  constructor(private readonly database: DatabaseService) {}

  async replaceForScan(
    scanId: string,
    result: BrowserScanResult,
  ): Promise<void> {
    await this.database.client.$transaction(async (tx) => {
      /*
       * BullMQ can retry a scan.
       *
       * Evidence therefore uses replacement semantics:
       *
       * old attempt evidence
       *        ↓
       *      delete
       *        ↓
       * persist current attempt evidence
       *
       * This keeps the operation retry-safe and prevents
       * duplicate evidence from previous attempts.
       */
      await tx.scanEvidence.deleteMany({
        where: {
          scanId,
        },
      });

      /*
       * Browser information
       */
      await tx.scanEvidence.create({
        data: {
          scanId,
          type: 'BROWSER',
          sequence: 0,
          data: toJson(result.browser),
        },
      });

      /*
       * Navigation information
       */
      await tx.scanEvidence.create({
        data: {
          scanId,
          type: 'NAVIGATION',
          sequence: 0,
          data: toJson(result.navigation),
        },
      });

      /*
       * Main document response.
       *
       * This can legitimately be missing if navigation
       * failed before a document response was received.
       */
      if (result.documentResponse) {
        await tx.scanEvidence.create({
          data: {
            scanId,
            type: 'DOCUMENT_RESPONSE',
            sequence: 0,
            data: toJson(result.documentResponse),
          },
        });
      }

      /*
       * Sprint 11 authoritative network requests.
       *
       * IMPORTANT:
       *
       * Do not use result.requests here.
       *
       * BrowserScanResult.requests was the old Sprint 06
       * request collector and has now been removed.
       *
       * NetworkCollectorService is the only network
       * evidence source from this point forward.
       */
      if (result.network.requests.length > 0) {
        await tx.scanEvidence.createMany({
          data: result.network.requests.map((request) => ({
            scanId,

            type: 'NETWORK_REQUEST' as const,

            sequence: request.sequence,

            data: toJson(request),
          })),
        });
      }

      /*
       * Network responses.
       */
      if (result.network.responses.length > 0) {
        await tx.scanEvidence.createMany({
          data: result.network.responses.map((response) => ({
            scanId,

            type: 'NETWORK_RESPONSE' as const,

            sequence: response.sequence,

            data: toJson(response),
          })),
        });
      }

      /*
       * Requests that failed before receiving a normal
       * browser response.
       */
      if (result.network.failures.length > 0) {
        await tx.scanEvidence.createMany({
          data: result.network.failures.map((failure) => ({
            scanId,

            type: 'NETWORK_FAILURE' as const,

            sequence: failure.sequence,

            data: toJson(failure),
          })),
        });
      }

      /*
       * Browser console messages.
       */
      if (result.consoleMessages.length > 0) {
        await tx.scanEvidence.createMany({
          data: result.consoleMessages.map((message, index) => ({
            scanId,

            type: 'CONSOLE' as const,

            sequence: index,

            data: toJson(message),
          })),
        });
      }

      /*
       * Raw performance observation.
       */
      await tx.scanEvidence.create({
        data: {
          scanId,
          type: 'PERFORMANCE',
          sequence: 0,
          data: toJson(result.performance.metrics),
        },
      });

      /*
       * Individual long tasks.
       */
      if (result.performance.longTasks.length > 0) {
        await tx.scanEvidence.createMany({
          data: result.performance.longTasks.map((longTask, index) => ({
            scanId,

            type: 'LONG_TASK' as const,

            sequence: index,

            data: toJson(longTask),
          })),
        });
      }
    });
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
