import { Injectable, OnModuleDestroy } from '@nestjs/common';
import {
  SCAN_JOB,
  SCAN_QUEUE,
  type ExecuteScanJob,
} from '@reactpulse/contracts';
import { Queue } from 'bullmq';

import { RedisService } from './redis.service';

@Injectable()
export class ScanQueueService implements OnModuleDestroy {
  private readonly queue: Queue<ExecuteScanJob>;

  constructor(redis: RedisService) {
    this.queue = new Queue<ExecuteScanJob>(SCAN_QUEUE, {
      connection: redis.client,

      defaultJobOptions: {
        attempts: 3,

        backoff: {
          type: 'exponential',
          delay: 5_000,
        },

        removeOnComplete: {
          age: 3600,
          count: 1000,
        },

        removeOnFail: {
          age: 24 * 3600,
          count: 5000,
        },
      },
    });
  }

  async enqueue(scanId: string): Promise<void> {
    await this.queue.add(
      SCAN_JOB,
      {
        scanId,
      },
      {
        jobId: scanId,
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
