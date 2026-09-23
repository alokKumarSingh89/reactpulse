import { Injectable } from '@nestjs/common';
import {
  HealthIndicatorService,
  type HealthIndicatorResult,
} from '@nestjs/terminus';

import { RedisService } from '../queue/redis.service';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly redis: RedisService,
    private readonly healthIndicator: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicator.check(key);

    try {
      const result = await this.redis.client.ping();

      if (result !== 'PONG') {
        return indicator.down();
      }

      return indicator.up();
    } catch {
      return indicator.down({
        reason: 'redis unavailable',
      });
    }
  }
}
