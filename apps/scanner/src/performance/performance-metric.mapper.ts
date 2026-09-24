import type { PerformanceMetrics } from './performance.types';

export interface PerformanceMetricInput {
  category: 'PERFORMANCE';

  key: string;

  value: number;

  unit: string;

  metadata?: Record<string, unknown>;
}

export function mapPerformanceMetrics(
  metrics: PerformanceMetrics,
): PerformanceMetricInput[] {
  const result: PerformanceMetricInput[] = [];

  addMetric(result, 'ttfb', metrics.ttfbMs, 'ms');

  addMetric(result, 'fcp', metrics.fcpMs, 'ms');

  addMetric(result, 'lcp', metrics.lcpMs, 'ms');

  /*
   * This is currently our synthetic accumulated
   * layout-shift measurement.
   *
   * We will implement the proper CLS session-window
   * algorithm separately.
   */
  addMetric(result, 'synthetic_layout_shift', metrics.cls, 'score');

  addMetric(
    result,
    'dom_content_loaded',
    normalizePositiveTiming(metrics.domContentLoadedMs),
    'ms',
  );

  addMetric(
    result,
    'load_event',
    normalizePositiveTiming(metrics.loadEventMs),
    'ms',
  );

  addMetric(
    result,
    'navigation_duration',
    normalizePositiveTiming(metrics.navigationDurationMs),
    'ms',
  );

  addMetric(result, 'long_task_count', metrics.longTaskCount, 'count');

  addMetric(result, 'long_task_duration', metrics.longTaskDurationMs, 'ms');

  /*
   * This is ReactPulse's observed blocking value,
   * not Lighthouse Total Blocking Time.
   */
  addMetric(
    result,
    'observed_total_blocking_time',
    metrics.totalBlockingTimeMs,
    'ms',
  );

  addMetric(result, 'dom_nodes', metrics.domNodes, 'count');

  /*
   * Resource metrics intentionally DO NOT belong here
   * anymore.
   *
   * Sprint 11 NetworkMetricService owns:
   *
   * transfer_size
   * javascript_transfer_size
   * stylesheet_transfer_size
   * image_transfer_size
   * font_transfer_size
   */
  return result;
}

function addMetric(
  result: PerformanceMetricInput[],

  key: string,

  value: number | null | undefined,

  unit: string,
): void {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return;
  }

  result.push({
    category: 'PERFORMANCE',

    key,

    value,

    unit,
  });
}

function normalizePositiveTiming(
  value: number | null | undefined,
): number | null {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return null;
  }

  return value;
}
