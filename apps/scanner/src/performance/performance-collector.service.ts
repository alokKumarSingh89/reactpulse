import { Injectable } from '@nestjs/common';
import type { Page } from 'playwright';

import { calculateClsSessionWindow } from './cls-session-window';
import type {
  LongTaskEntry,
  PerformanceMetrics,
  PerformanceObservation,
} from './performance.types';

type RawPerformanceMetrics = Omit<PerformanceMetrics, 'cls'>;

interface RawPerformanceCollection {
  metrics: RawPerformanceMetrics;

  longTasks: LongTaskEntry[];
}

@Injectable()
export class PerformanceCollectorService {
  async collect(page: Page): Promise<PerformanceObservation> {
    const raw = await page.evaluate<RawPerformanceCollection>(() => {
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
       * Observed blocking time.
       *
       * Only the portion of an observed long task above
       * 50ms contributes to this value.
       *
       * ReactPulse deliberately does not call this
       * Lighthouse TBT.
       */
      const totalBlockingTimeMs = longTasks.reduce(
        (total, task) => total + Math.max(task.duration - 50, 0),
        0,
      );

      /*
       * Document TTFB.
       *
       * Navigation Timing timestamps share the same
       * time origin, therefore:
       *
       * responseStart - requestStart
       *
       * represents the observed document response
       * latency after the request started.
       */
      const ttfbMs =
        navigation &&
        navigation.responseStart > 0 &&
        navigation.requestStart >= 0
          ? navigation.responseStart - navigation.requestStart
          : null;

      const metrics: RawPerformanceMetrics = {
        ttfbMs,

        fcpMs: fcp?.startTime ?? null,

        lcpMs: state?.lcp ?? null,

        /*
         * Preserve individual layout shifts.
         *
         * CLS is calculated after page.evaluate() by
         * calculateClsSessionWindow().
         */
        layoutShifts: state?.layoutShifts ?? [],

        /*
         * Navigation timing fields may legitimately still
         * be zero when the relevant event has not occurred.
         *
         * Missing measurement must be null, not zero.
         */
        domContentLoadedMs:
          navigation && navigation.domContentLoadedEventEnd > 0
            ? navigation.domContentLoadedEventEnd
            : null,

        loadEventMs:
          navigation && navigation.loadEventEnd > 0
            ? navigation.loadEventEnd
            : null,

        navigationDurationMs:
          navigation && navigation.duration > 0 ? navigation.duration : null,

        longTaskCount: longTasks.length,

        longTaskDurationMs,

        totalBlockingTimeMs,

        domNodes: document.getElementsByTagName('*').length,

        /*
         * Retained temporarily for Sprint 07 evidence
         * compatibility.
         *
         * Network/resource metric persistence is now owned
         * by NetworkCollectorService.
         */
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

    /*
     * Calculate CLS using the tested session-window
     * algorithm rather than summing every layout shift.
     */
    const cls = calculateClsSessionWindow(raw.metrics.layoutShifts);

    return {
      metrics: {
        ...raw.metrics,

        cls,
      },

      longTasks: raw.longTasks,
    };
  }
}
