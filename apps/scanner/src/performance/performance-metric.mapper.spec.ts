import { describe, expect, it } from 'vitest';

import { mapPerformanceMetrics } from './performance-metric.mapper';

describe('mapPerformanceMetrics', () => {
  it('maps measured values', () => {
    const result = mapPerformanceMetrics({
      ttfbMs: 120,

      fcpMs: 350,

      lcpMs: 900,

      cls: 0.04,

      domContentLoadedMs: 500,

      loadEventMs: 1_000,

      navigationDurationMs: 1_000,

      longTaskCount: 2,

      longTaskDurationMs: 180,

      totalBlockingTimeMs: 80,

      domNodes: 250,

      resources: {
        count: 20,

        transferSize: 100_000,

        encodedBodySize: 90_000,

        decodedBodySize: 150_000,
      },
    });

    expect(result).toContainEqual({
      key: 'lcp',
      value: 900,
      unit: 'ms',
    });

    expect(result).toContainEqual({
      key: 'observed_total_blocking_time',

      value: 80,

      unit: 'ms',
    });

    expect(result).toContainEqual({
      key: 'synthetic_layout_shift',

      value: 0.04,

      unit: undefined,
    });
  });

  it('does not invent unavailable metrics', () => {
    const result = mapPerformanceMetrics({
      ttfbMs: null,
      fcpMs: null,
      lcpMs: null,

      cls: 0,

      domContentLoadedMs: null,

      loadEventMs: null,

      navigationDurationMs: null,

      longTaskCount: 0,
      longTaskDurationMs: 0,

      totalBlockingTimeMs: 0,

      domNodes: 0,

      resources: {
        count: 0,

        transferSize: 0,

        encodedBodySize: 0,

        decodedBodySize: 0,
      },
    });

    expect(result.some((metric) => metric.key === 'lcp')).toBe(false);

    expect(result.some((metric) => metric.key === 'fcp')).toBe(false);
  });

  it('keeps legitimate zero values', () => {
    const result = mapPerformanceMetrics({
      ttfbMs: null,
      fcpMs: null,
      lcpMs: null,

      cls: 0,

      domContentLoadedMs: null,

      loadEventMs: null,

      navigationDurationMs: null,

      longTaskCount: 0,
      longTaskDurationMs: 0,

      totalBlockingTimeMs: 0,
      domNodes: 0,

      resources: {
        count: 0,
        transferSize: 0,
        encodedBodySize: 0,
        decodedBodySize: 0,
      },
    });

    expect(result).toContainEqual({
      key: 'synthetic_layout_shift',

      value: 0,

      unit: undefined,
    });
  });
});
