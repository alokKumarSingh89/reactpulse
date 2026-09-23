import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import {
  SCAN_JOB,
  SCAN_QUEUE,
  type ExecuteScanJob,
} from '@reactpulse/contracts';

import { ScanStatus } from '@reactpulse/database';

import { type Job, Worker } from 'bullmq';

import { BrowserScannerService } from '../browser/browser-scanner.service';

import { DatabaseService } from '../database/database.service';

import { PerformanceMetricService } from '../performance/performance-metric.service';

import { RedisService } from '../queue/redis.service';

import { ScanEvidenceService } from './scan-evidence.service';

import { ScanExecutionError, ScanFailureCode } from './scan-failure';

@Injectable()
export class ScanProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScanProcessor.name);

  private worker?: Worker<ExecuteScanJob>;

  constructor(
    private readonly database: DatabaseService,

    private readonly redis: RedisService,

    private readonly browserScanner: BrowserScannerService,

    private readonly evidence: ScanEvidenceService,

    private readonly performanceMetrics: PerformanceMetricService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<ExecuteScanJob>(
      SCAN_QUEUE,

      async (job) => {
        if (job.name !== SCAN_JOB) {
          throw new Error(`Unsupported job: ${job.name}`);
        }

        await this.process(job);
      },

      {
        connection: this.redis.client,

        /*
         * Keep browser concurrency low
         * until we have worker resource
         * measurements.
         */
        concurrency: 1,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Scan job completed: ${job.id}`);
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Scan job failed: ${job?.id}`, error.stack);
    });
  }

  private async process(job: Job<ExecuteScanJob>): Promise<void> {
    const { scanId } = job.data;

    const scan = await this.database.client.scan.findUnique({
      where: {
        id: scanId,
      },
    });

    if (!scan) {
      throw new Error(`Scan ${scanId} does not exist`);
    }

    /*
     * Terminal states must be idempotent.
     */
    if (
      scan.status === ScanStatus.COMPLETED ||
      scan.status === ScanStatus.CANCELLED
    ) {
      this.logger.warn(`Skipping terminal scan ${scanId}`);

      return;
    }

    await this.database.client.scan.update({
      where: {
        id: scanId,
      },

      data: {
        status: ScanStatus.RUNNING,

        startedAt: scan.startedAt ?? new Date(),

        completedAt: null,

        failureCode: null,
        failureMessage: null,
      },
    });

    try {
      /*
       * 1. Execute real browser scan.
       */
      const result = await this.browserScanner.scan(scan.targetUrl);

      /*
       * 2. Persist raw observations.
       */
      await this.evidence.replaceBrowserEvidence(scanId, result);

      /*
       * 3. Persist normalized metrics.
       */
      await this.performanceMetrics.replace(scanId, result.performance.metrics);

      /*
       * 4. Only now is the scan considered
       * completed.
       */
      await this.database.client.scan.update({
        where: {
          id: scanId,
        },

        data: {
          status: ScanStatus.COMPLETED,

          completedAt: new Date(),

          browserName: result.browser.name,

          browserVersion: result.browser.version,

          failureCode: null,
          failureMessage: null,
        },
      });
    } catch (error) {
      const failure = this.normalizeFailure(error);

      const configuredAttempts = job.opts.attempts ?? 1;

      const currentAttempt = job.attemptsMade + 1;

      const finalAttempt = currentAttempt >= configuredAttempts;

      if (finalAttempt) {
        await this.database.client.scan.update({
          where: {
            id: scanId,
          },

          data: {
            status: ScanStatus.FAILED,

            completedAt: new Date(),

            failureCode: failure.code,

            failureMessage: failure.message,
          },
        });
      } else {
        /*
         * BullMQ will retry the job.
         */
        await this.database.client.scan.update({
          where: {
            id: scanId,
          },

          data: {
            status: ScanStatus.QUEUED,

            completedAt: null,

            failureCode: failure.code,

            failureMessage: failure.message,
          },
        });
      }

      throw error;
    }
  }

  private normalizeFailure(error: unknown): {
    code: ScanFailureCode;
    message: string;
  } {
    if (error instanceof ScanExecutionError) {
      return {
        code: error.code,

        message: error.message,
      };
    }

    return {
      code: ScanFailureCode.SCAN_EXECUTION_FAILED,

      message: 'Scan execution failed',
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
