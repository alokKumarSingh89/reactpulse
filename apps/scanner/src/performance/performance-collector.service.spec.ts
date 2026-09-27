import type { Page } from 'playwright';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PerformanceCollectorService } from './performance-collector.service';

function setup(navigation: Record<string, number> | null) {
  vi.stubGlobal('performance', {
    getEntriesByType: (type: string) =>
      type === 'navigation' && navigation ? [navigation] : [],
  });
  vi.stubGlobal('document', { getElementsByTagName: () => [] });
  const state = {
    lcp: 400,
    layoutShifts: [
      { value: 0.1, startTime: 100, hadRecentInput: false },
      { value: 0.2, startTime: 500, hadRecentInput: false },
      { value: 0.9, startTime: 600, hadRecentInput: true },
    ],
    longTasks: [
      { startTime: 100, duration: 80 },
      { startTime: 200, duration: 120 },
    ],
  };
  vi.stubGlobal('window', { __REACTPULSE_PERFORMANCE__: state });
  // Execute the actual browser callback against controlled browser API values.
  const page = {
    evaluate: async (callback: () => unknown) => callback(),
  } as unknown as Page;
  return { page, state, service: new PerformanceCollectorService() };
}

afterEach(() => vi.unstubAllGlobals());

describe('PerformanceCollectorService', () => {
  it('measures request-to-first-byte latency and derives CLS and long-task metrics', async () => {
    const h = setup({
      requestStart: 100,
      responseStart: 250,
      domContentLoadedEventEnd: 300,
      loadEventEnd: 0,
      duration: 0,
    });
    const result = await h.service.collect(h.page);
    expect(result.metrics.ttfbMs).toBe(150);
    expect(result.metrics.lcpMs).toBe(400);
    expect(result.metrics.layoutShifts).toEqual(h.state.layoutShifts);
    expect(result.metrics.cls).toBeCloseTo(0.3);
    expect(result.longTasks).toEqual(h.state.longTasks);
    expect(result.metrics.longTaskCount).toBe(2);
    expect(result.metrics.longTaskDurationMs).toBe(200);
    expect(result.metrics.totalBlockingTimeMs).toBe(100);
    expect(result.metrics.loadEventMs).toBeNull();
    expect(result.metrics.navigationDurationMs).toBeNull();
  });

  it('returns null when navigation timing is missing', async () => {
    const h = setup(null);
    const { metrics } = await h.service.collect(h.page);
    expect(metrics.ttfbMs).toBeNull();
    expect(metrics.domContentLoadedMs).toBeNull();
    expect(metrics.loadEventMs).toBeNull();
    expect(metrics.navigationDurationMs).toBeNull();
  });
});
