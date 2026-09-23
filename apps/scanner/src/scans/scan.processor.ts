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

import { DatabaseService } from '../database/database.service';
import { RedisService } from '../queue/redis.service';

@Injectable()
export class ScanProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScanProcessor.name);

  private worker?: Worker<ExecuteScanJob>;

  constructor(
    private readonly database: DatabaseService,
    private readonly redis: RedisService,
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
        concurrency: 2,
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

        failureCode: null,
        failureMessage: null,
      },
    });

    this.logger.log(
      `Executing placeholder scan ${scanId} for ${scan.targetUrl}`,
    );

    /*
     * Sprint 06:
     *
     * Chromium + Playwright execution will
     * replace this placeholder.
     */
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 2_000);
    });

    await this.database.client.scan.update({
      where: {
        id: scanId,
      },

      data: {
        status: ScanStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
