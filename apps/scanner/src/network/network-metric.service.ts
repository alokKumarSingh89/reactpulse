import { Injectable } from '@nestjs/common';

import type { Prisma } from '@reactpulse/database';

import { DatabaseService } from '../database/database.service';

import { mapNetworkMetrics } from './network-metric.mapper';

import type { NetworkObservation } from './network.types';

@Injectable()
export class NetworkMetricService {
  constructor(private readonly database: DatabaseService) {}

  async replaceForScan(
    scanId: string,
    observation: NetworkObservation,
  ): Promise<void> {
    const metrics = mapNetworkMetrics(observation);

    await this.database.client.$transaction(async (tx) => {
      /*
       * Network metrics are retry-safe.
       *
       * Every scan attempt replaces the previous
       * NETWORK and RESOURCE metrics.
       */
      await tx.scanMetric.deleteMany({
        where: {
          scanId,

          category: {
            in: ['NETWORK', 'RESOURCE'],
          },
        },
      });

      if (metrics.length === 0) {
        return;
      }

      await tx.scanMetric.createMany({
        data: metrics.map((metric) => ({
          scanId,

          category: metric.category,

          key: metric.key,

          value: metric.value,

          unit: metric.unit,

          metadata: toJson(metric.metadata ?? {}),
        })),
      });
    });
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
