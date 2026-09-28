import { DeterministicFindingService } from '../findings/deterministic-finding.service';
import { evaluatePerformanceFindings } from '../performance/performance-findings';
import { evaluateNetworkFindings } from '../network/network-findings';
import { AccessibilityFindingService } from '../accessibility/accessibility-finding.service';
import { mapAccessibilityFindings } from '../accessibility/accessibility-finding-mapper';
import { projectAccessibilityObservation } from '../accessibility/accessibility-projector';
import { SecurityFindingService } from '../security/security-finding.service';
import { evaluateSecurityRules } from '../security/security-rules';
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
import { ScanExecutionError, normalizeFailure } from './scan-failure';

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

    private readonly securityFindingService: SecurityFindingService,

    private readonly accessibilityFindingService: AccessibilityFindingService,
    private readonly deterministicFindingService: DeterministicFindingService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<ExecuteScanJob>(
      SCAN_QUEUE,

      async (job) => {
        try {
          await this.processJob(job);
        } catch (error) {
          const failure = normalizeFailure(error);
          throw new ScanExecutionError(failure.code, failure.message);
        }
      },

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
        `Scan job failed: ${job?.id ?? 'unknown'} - ${normalizeFailure(error).code}`,
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
       * Persist explicitly projected evidence first.
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
      // Evaluate before any finding reconciliation. A thrown evaluation follows
      // the existing whole-scan failure/retry path, never successful empty data.
      const performanceFindings = evaluatePerformanceFindings(result.performance.metrics);
      const networkFindings = evaluateNetworkFindings(result.network, { throwOnInvalid: true });
      await this.scanEvidenceService.replaceForScan(scan.id, result);

      await this.performanceMetricService.replaceForScan(
        scan.id,
        result.performance.metrics,
      );

      await this.networkMetricService.replaceForScan(scan.id, result.network);

      const securityEvaluation = result.security
        ? evaluateSecurityRules(result.security.assessment)
        : null;
      await this.securityFindingService.replaceForScan(
        scan.id,
        securityEvaluation,
      );

      // Raw engine data stays in memory. Only projected facts reach mapping,
      // and only safe candidates cross the accessibility persistence boundary.
      const accessibilityAssessment = result.accessibility
        ? projectAccessibilityObservation(result.accessibility)
        : null;
      await this.accessibilityFindingService.replaceForScan(
        scan.id,
        accessibilityAssessment
          ? mapAccessibilityFindings(accessibilityAssessment)
          : [],
        accessibilityAssessment,
      );

      await this.deterministicFindingService.replaceForScan(scan.id, 'PERFORMANCE', performanceFindings);
      await this.deterministicFindingService.replaceForScan(scan.id, 'NETWORK', networkFindings);

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

      // BullMQ persists error messages/stacks; never propagate raw browser/DB errors.
      throw new ScanExecutionError(failure.code, failure.message);
    }
  }
}
