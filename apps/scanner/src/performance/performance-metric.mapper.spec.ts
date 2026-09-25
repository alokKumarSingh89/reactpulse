import { describe, expect, it } from 'vitest';

import { mapPerformanceMetrics } from './performance-metric.mapper';

import type { PerformanceMetrics } from './performance.types';

describe('mapPerformanceMetrics', () => {
  it('maps supported performance metrics', () => {
    const metrics: PerformanceMetrics = {
      ttfbMs: 120,

      fcpMs: 300,

      lcpMs: 500,

      cls: 0,

      layoutShifts: [],

      domContentLoadedMs: 400,

      loadEventMs: 600,

      navigationDurationMs: 650,

      longTaskCount: 0,

      longTaskDurationMs: 0,

      totalBlockingTimeMs: 0,

      domNodes: 120,

      resources: {
        count: 10,

        transferSize: 1000,

        encodedBodySize: 900,

        decodedBodySize: 2000,
      },
    };

    const result = mapPerformanceMetrics(metrics);

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'ttfb',

          value: 120,
        }),

        expect.objectContaining({
          key: 'fcp',

          value: 300,
        }),

        expect.objectContaining({
          key: 'lcp',

          value: 500,
        }),

        /*
         * Zero CLS is a valid measurement and must
         * not be treated as missing data.
         */
        expect.objectContaining({
          key: 'synthetic_cls',

          value: 0,
        }),

        expect.objectContaining({
          key: 'long_task_count',

          value: 0,
        }),

        expect.objectContaining({
          key: 'observed_total_blocking_time',

          value: 0,
        }),
      ]),
    );
  });

  it('does not persist resource metrics', () => {
    const metrics: PerformanceMetrics = {
      ttfbMs: 100,

      fcpMs: null,

      lcpMs: null,

      cls: 0,

      layoutShifts: [],

      domContentLoadedMs: 200,

      loadEventMs: 300,

      navigationDurationMs: 350,

      longTaskCount: 0,

      longTaskDurationMs: 0,

      totalBlockingTimeMs: 0,

      domNodes: 10,

      resources: {
        count: 50,

        transferSize: 500000,

        encodedBodySize: 400000,

        decodedBodySize: 900000,
      },
    };

    const keys = mapPerformanceMetrics(metrics).map((metric) => metric.key);

    expect(keys).not.toContain('resource_count');

    expect(keys).not.toContain('transfer_size');

    expect(keys).not.toContain('encoded_body_size');

    expect(keys).not.toContain('decoded_body_size');
  });

  it('omits unavailable zero navigation timings but preserves valid zero measurements', () => {
    const metrics: PerformanceMetrics = {
      ttfbMs: null,

      fcpMs: null,

      lcpMs: null,

      cls: 0,

      layoutShifts: [],

      domContentLoadedMs: 0,

      loadEventMs: 0,

      navigationDurationMs: 0,

      longTaskCount: 0,

      longTaskDurationMs: 0,

      totalBlockingTimeMs: 0,

      domNodes: 10,

      resources: {
        count: 0,

        transferSize: 0,

        encodedBodySize: 0,

        decodedBodySize: 0,
      },
    };

    const keys = mapPerformanceMetrics(metrics).map((metric) => metric.key);

    /*
     * A zero navigation lifecycle timing means the
     * browser did not expose a completed measurement.
     */
    expect(keys).not.toContain('dom_content_loaded');

    expect(keys).not.toContain('load_event');

    expect(keys).not.toContain('navigation_duration');

    /*
     * These zero values are real measurements.
     */
    expect(keys).toContain('synthetic_cls');

    expect(keys).toContain('long_task_count');

    expect(keys).toContain('observed_total_blocking_time');
  });

  it('persists calculated CLS but not individual layout-shift evidence as metrics', () => {
    const metrics: PerformanceMetrics = {
      ttfbMs: null,

      fcpMs: null,

      lcpMs: null,

      cls: 0.15,

      layoutShifts: [
        {
          value: 0.1,

          startTime: 100,

          hadRecentInput: false,
        },

        {
          value: 0.05,

          startTime: 500,

          hadRecentInput: false,
        },
      ],

      domContentLoadedMs: null,

      loadEventMs: null,

      navigationDurationMs: null,

      longTaskCount: 0,

      longTaskDurationMs: 0,

      totalBlockingTimeMs: 0,

      domNodes: 20,

      resources: {
        count: 0,

        transferSize: 0,

        encodedBodySize: 0,

        decodedBodySize: 0,
      },
    };

    const result = mapPerformanceMetrics(metrics);

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'synthetic_cls',

          value: 0.15,

          unit: 'score',
        }),
      ]),
    );

    const keys = result.map((metric) => metric.key);

    expect(keys).not.toContain('synthetic_layout_shift');

    expect(keys).not.toContain('layout_shifts');
  });
});
