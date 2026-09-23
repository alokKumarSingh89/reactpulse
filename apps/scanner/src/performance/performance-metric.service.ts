import { Injectable } from '@nestjs/common';

import { MetricCategory } from '@reactpulse/database';

import { DESKTOP_PROFILE } from '../browser/scan-profile';

import { DatabaseService } from '../database/database.service';

import { mapPerformanceMetrics } from './performance-metric.mapper';

import type { PerformanceMetrics } from './performance.types';

@Injectable()
export class PerformanceMetricService {
  constructor(private readonly database: DatabaseService) {}

  async replace(scanId: string, metrics: PerformanceMetrics): Promise<void> {
    const values = mapPerformanceMetrics(metrics);

    const metadata = {
      profileId: DESKTOP_PROFILE.id,

      profileName: DESKTOP_PROFILE.name,

      viewport: DESKTOP_PROFILE.viewport,

      observationWindowMs: DESKTOP_PROFILE.observationWindowMs,
    };

    await this.database.client.$transaction(async (transaction) => {
      /*
       * Makes processing idempotent.
       *
       * A BullMQ retry replaces the
       * previous performance metrics.
       */
      await transaction.scanMetric.deleteMany({
        where: {
          scanId,

          category: MetricCategory.PERFORMANCE,
        },
      });

      if (values.length === 0) {
        return;
      }

      await transaction.scanMetric.createMany({
        data: values.map((metric) => ({
          scanId,

          category: MetricCategory.PERFORMANCE,

          key: metric.key,

          value: metric.value,

          unit: metric.unit,

          metadata,
        })),
      });
    });
  }
}
