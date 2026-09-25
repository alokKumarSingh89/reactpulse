import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { SCAN_JOB, SCAN_QUEUE } from '@reactpulse/contracts';

import type { ExecuteScanJob } from '@reactpulse/contracts';

import { Job, Worker } from 'bullmq';

import { BrowserScannerService } from '../browser/browser-scanner.service';

import { DatabaseService } from '../database/database.service';

import { ScanEvidenceService } from '../evidence/scan-evidence.service';

import { NetworkMetricService } from '../network/network-metric.service';

import { PerformanceMetricService } from '../performance/performance-metric.service';

import { RedisService } from '../queue/redis.service';
import { ScanExecutionError } from './scan-failure';

@Injectable()
export class ScanProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScanProcessor.name);

  private worker: Worker<ExecuteScanJob> | null = null;

  constructor(
    private readonly database: DatabaseService,

    private readonly redis: RedisService,

    private readonly browserScanner: BrowserScannerService,

    private readonly scanEvidenceService: ScanEvidenceService,

    private readonly performanceMetricService: PerformanceMetricService,

    private readonly networkMetricService: NetworkMetricService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<ExecuteScanJob>(
      SCAN_QUEUE,

      async (job) => this.processJob(job),

      {
        connection: this.redis.client,

        /*
         * Browser scans are expensive.
         *
         * Keep one Chromium scan per worker process
         * until we add explicit CPU/memory isolation.
         */
        concurrency: 1,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Scan job completed: ${job.id ?? 'unknown'}`);
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Scan job failed: ${job?.id ?? 'unknown'} - ${error.message}`,
      );
    });

    this.logger.log(`Listening to scan queue "${SCAN_QUEUE}"`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();

      this.worker = null;
    }
  }

  private async processJob(job: Job<ExecuteScanJob>): Promise<void> {
    if (job.name !== SCAN_JOB) {
      this.logger.warn(`Ignoring unsupported job "${job.name}"`);

      return;
    }

    const { scanId } = job.data;

    const scan = await this.database.client.scan.findUnique({
      where: {
        id: scanId,
      },

      select: {
        id: true,

        status: true,

        targetUrl: true,

        startedAt: true,
      },
    });

    if (!scan) {
      throw new Error(`Scan ${scanId} was not found`);
    }

    if (scan.status === 'COMPLETED' || scan.status === 'CANCELLED') {
      this.logger.log(
        `Skipping terminal scan ${scan.id} with status ${scan.status}`,
      );

      return;
    }

    await this.database.client.scan.update({
      where: {
        id: scan.id,
      },

      data: {
        status: 'RUNNING',

        startedAt: scan.startedAt ?? new Date(),

        completedAt: null,

        failureCode: null,

        failureMessage: null,
      },
    });

    try {
      const result = await this.browserScanner.scan(scan.targetUrl);

      /*
       * Persist raw evidence first.
       *
       * This includes:
       *
       * BROWSER
       * NAVIGATION
       * DOCUMENT_RESPONSE
       * NETWORK_REQUEST
       * NETWORK_RESPONSE
       * NETWORK_FAILURE
       * CONSOLE
       * PERFORMANCE
       * LONG_TASK
       */
      await this.scanEvidenceService.replaceForScan(scan.id, result);

      await this.performanceMetricService.replaceForScan(
        scan.id,
        result.performance.metrics,
      );

      await this.networkMetricService.replaceForScan(scan.id, result.network);

      await this.database.client.scan.update({
        where: {
          id: scan.id,
        },

        data: {
          status: 'COMPLETED',

          browserName: result.browser.name,

          browserVersion: result.browser.version,

          completedAt: new Date(),

          failureCode: null,

          failureMessage: null,
        },
      });
    } catch (error) {
      const failure = normalizeFailure(error);

      const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);

      await this.database.client.scan.update({
        where: {
          id: scan.id,
        },

        data: finalAttempt
          ? {
              status: 'FAILED',

              completedAt: new Date(),

              failureCode: failure.code,

              failureMessage: failure.message,
            }
          : {
              /*
               * BullMQ will retry this job.
               *
               * Return the scan to QUEUED so the UI
               * accurately represents the retry state.
               */
              status: 'QUEUED',

              completedAt: null,

              failureCode: failure.code,

              failureMessage: failure.message,
            },
      });

      throw error;
    }
  }
}

interface NormalizedFailure {
  code: string;

  message: string;
}

function normalizeFailure(error: unknown): NormalizedFailure {
  if (error instanceof ScanExecutionError) {
    return {
      code: error.code,

      message: sanitizeFailureMessage(error.message),
    };
  }

  return {
    code: 'SCAN_EXECUTION_FAILED',

    message: 'ReactPulse could not complete the browser scan.',
  };
}

function sanitizeFailureMessage(message: string): string {
  /*
   * Scanner-specific errors should already contain
   * customer-safe messages.
   *
   * Bound their size before persisting them.
   */
  return message.replace(/\s+/g, ' ').trim().slice(0, 500);
}
