import { Global, Module } from '@nestjs/common';

import { RedisService } from './redis.service';
import { ScanQueueService } from './scan-queue.service';

@Global()
@Module({
  providers: [RedisService, ScanQueueService],

  exports: [RedisService, ScanQueueService],
})
export class QueueModule {}
