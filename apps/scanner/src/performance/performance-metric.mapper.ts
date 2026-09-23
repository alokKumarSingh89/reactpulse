import type { PerformanceMetrics } from './performance.types';

export interface PerformanceMetricValue {
  key: string;
  value: number;
  unit?: string;
}

export function mapPerformanceMetrics(
  metrics: PerformanceMetrics,
): PerformanceMetricValue[] {
  const result: PerformanceMetricValue[] = [];

  const add = (key: string, value: number | null, unit?: string): void => {
    if (value === null || !Number.isFinite(value)) {
      return;
    }

    result.push({
      key,
      value,
      unit,
    });
  };

  add('ttfb', metrics.ttfbMs, 'ms');

  add('fcp', metrics.fcpMs, 'ms');

  add('lcp', metrics.lcpMs, 'ms');

  add('synthetic_layout_shift', metrics.cls);

  add('dom_content_loaded', metrics.domContentLoadedMs, 'ms');

  add('load_event', metrics.loadEventMs, 'ms');

  add('navigation_duration', metrics.navigationDurationMs, 'ms');

  add('long_task_count', metrics.longTaskCount, 'count');

  add('long_task_duration', metrics.longTaskDurationMs, 'ms');

  add('observed_total_blocking_time', metrics.totalBlockingTimeMs, 'ms');

  add('dom_nodes', metrics.domNodes, 'count');

  add('resource_count', metrics.resources.count, 'count');

  add('transfer_size', metrics.resources.transferSize, 'bytes');

  add('encoded_body_size', metrics.resources.encodedBodySize, 'bytes');

  add('decoded_body_size', metrics.resources.decodedBodySize, 'bytes');

  return result;
}
