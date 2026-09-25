export interface LongTaskEntry {
  startTime: number;

  duration: number;
}

export interface LayoutShiftEntry {
  value: number;

  startTime: number;

  hadRecentInput: boolean;
}

export interface ResourceSummary {
  count: number;

  transferSize: number;

  encodedBodySize: number;

  decodedBodySize: number;
}

export interface PerformanceMetrics {
  /**
   * Document response latency measured from
   * requestStart to responseStart.
   */
  ttfbMs: number | null;

  /**
   * First Contentful Paint observed during
   * the synthetic browser scan.
   */
  fcpMs: number | null;

  /**
   * Largest Contentful Paint observed during
   * the synthetic browser scan.
   */
  lcpMs: number | null;

  /**
   * Synthetic CLS calculated using the
   * layout-shift session-window algorithm.
   *
   * This is not real-user/RUM CLS.
   */
  cls: number;

  /**
   * Individual layout-shift observations.
   *
   * These are retained as evidence so the
   * aggregate CLS value remains explainable.
   */
  layoutShifts: LayoutShiftEntry[];

  domContentLoadedMs: number | null;

  loadEventMs: number | null;

  navigationDurationMs: number | null;

  longTaskCount: number;

  longTaskDurationMs: number;

  /**
   * Blocking time derived from observed
   * long tasks during this synthetic scan.
   *
   * This must not be presented as Lighthouse TBT.
   */
  totalBlockingTimeMs: number;

  domNodes: number;

  /**
   * Resource Timing summary retained for
   * backward compatibility with Sprint 07.
   *
   * Network/RESOURCE metrics are now owned by
   * NetworkCollectorService and should not be
   * persisted as PERFORMANCE metrics.
   */
  resources: ResourceSummary;
}

export interface PerformanceObservation {
  metrics: PerformanceMetrics;

  longTasks: LongTaskEntry[];
}
