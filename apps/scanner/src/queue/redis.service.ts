import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: IORedis;

  constructor(config: ConfigService) {
    this.client = new IORedis({
      host: config.getOrThrow<string>('REDIS_HOST'),

      port: config.getOrThrow<number>('REDIS_PORT'),

      maxRetriesPerRequest: null,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
