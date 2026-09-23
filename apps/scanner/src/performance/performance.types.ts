export interface LongTaskEntry {
  startTime: number;
  duration: number;
}

export interface ResourceSummary {
  count: number;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
}

export interface PerformanceMetrics {
  ttfbMs: number | null;

  fcpMs: number | null;
  lcpMs: number | null;

  cls: number;

  domContentLoadedMs: number | null;
  loadEventMs: number | null;

  navigationDurationMs: number | null;

  longTaskCount: number;
  longTaskDurationMs: number;

  totalBlockingTimeMs: number;

  domNodes: number;

  resources: ResourceSummary;
}

export interface PerformanceObservation {
  metrics: PerformanceMetrics;
  longTasks: LongTaskEntry[];
}
