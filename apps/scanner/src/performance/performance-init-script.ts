export const PERFORMANCE_INIT_SCRIPT = `
(() => {
  window.__REACTPULSE_PERFORMANCE__ = {
    lcp: null,
    layoutShifts: [],
    longTasks: []
  };

  /*
   * Largest Contentful Paint
   *
   * Keep the latest observed LCP candidate.
   * PerformanceObserver with buffered=true also allows
   * us to receive entries that occurred before the
   * observer became active.
   */
  try {
    const lcpObserver = new PerformanceObserver(
      (list) => {
        const entries = list.getEntries();

        const lastEntry =
          entries[entries.length - 1];

        if (lastEntry) {
          window.__REACTPULSE_PERFORMANCE__.lcp =
            lastEntry.startTime;
        }
      }
    );

    lcpObserver.observe({
      type: 'largest-contentful-paint',
      buffered: true
    });
  } catch {}

  /*
   * Layout Shift
   *
   * Preserve every observed layout-shift entry.
   *
   * We intentionally DO NOT filter hadRecentInput here.
   * The tested CLS session-window implementation in the
   * scanner owns that decision.
   *
   * This keeps raw browser evidence separate from the
   * derived synthetic CLS metric.
   */
  try {
    const layoutShiftObserver =
      new PerformanceObserver(
        (list) => {
          for (const entry of list.getEntries()) {
            window.__REACTPULSE_PERFORMANCE__.layoutShifts.push({
              value: entry.value,
              startTime: entry.startTime,
              hadRecentInput: entry.hadRecentInput
            });
          }
        }
      );

    layoutShiftObserver.observe({
      type: 'layout-shift',
      buffered: true
    });
  } catch {}

  /*
   * Long Tasks
   *
   * Preserve start time and duration so ReactPulse can
   * calculate long-task totals and observed blocking time
   * outside the browser page.
   */
  try {
    const longTaskObserver =
      new PerformanceObserver(
        (list) => {
          for (const entry of list.getEntries()) {
            window.__REACTPULSE_PERFORMANCE__.longTasks.push({
              startTime: entry.startTime,
              duration: entry.duration
            });
          }
        }
      );

    longTaskObserver.observe({
      type: 'longtask',
      buffered: true
    });
  } catch {}
})();
`;
