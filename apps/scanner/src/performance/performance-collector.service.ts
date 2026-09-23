import { Injectable } from '@nestjs/common';
import type { Page } from 'playwright';

import type {
  PerformanceMetrics,
  PerformanceObservation,
} from './performance.types';

@Injectable()
export class PerformanceCollectorService {
  async collect(page: Page): Promise<PerformanceObservation> {
    return page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as
        PerformanceNavigationTiming | undefined;

      const paints = performance.getEntriesByType('paint');

      const fcp = paints.find(
        (entry) => entry.name === 'first-contentful-paint',
      );

      const state = window.__REACTPULSE_PERFORMANCE__;

      const resources = performance.getEntriesByType(
        'resource',
      ) as PerformanceResourceTiming[];

      const transferSize = resources.reduce(
        (total, resource) => total + resource.transferSize,
        0,
      );

      const encodedBodySize = resources.reduce(
        (total, resource) => total + resource.encodedBodySize,
        0,
      );

      const decodedBodySize = resources.reduce(
        (total, resource) => total + resource.decodedBodySize,
        0,
      );

      const longTasks = state?.longTasks ?? [];

      const longTaskDurationMs = longTasks.reduce(
        (total, task) => total + task.duration,
        0,
      );

      /*
       * TBT:
       *
       * For every long task (>50ms),
       * only the portion above 50ms
       * contributes to blocking time.
       */
      const totalBlockingTimeMs = longTasks.reduce(
        (total, task) => total + Math.max(task.duration - 50, 0),
        0,
      );

      const metrics: PerformanceMetrics = {
        ttfbMs: navigation ? navigation.responseStart : null,

        fcpMs: fcp?.startTime ?? null,

        lcpMs: state?.lcp ?? null,

        cls: state?.cls ?? 0,

        domContentLoadedMs: navigation
          ? navigation.domContentLoadedEventEnd
          : null,

        loadEventMs: navigation ? navigation.loadEventEnd : null,

        navigationDurationMs: navigation ? navigation.duration : null,

        longTaskCount: longTasks.length,

        longTaskDurationMs,

        totalBlockingTimeMs,

        domNodes: document.getElementsByTagName('*').length,

        resources: {
          count: resources.length,

          transferSize,

          encodedBodySize,

          decodedBodySize,
        },
      };

      return {
        metrics,
        longTasks,
      };
    });
  }
}
