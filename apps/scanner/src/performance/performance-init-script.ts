export const PERFORMANCE_INIT_SCRIPT = `
(() => {
  window.__REACTPULSE_PERFORMANCE__ = {
    lcp: null,
    cls: 0,
    longTasks: []
  };

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

  try {
    const clsObserver = new PerformanceObserver(
      (list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) {
            window.__REACTPULSE_PERFORMANCE__.cls +=
              entry.value;
          }
        }
      }
    );

    clsObserver.observe({
      type: 'layout-shift',
      buffered: true
    });
  } catch {}

  try {
    const longTaskObserver =
      new PerformanceObserver(
        (list) => {
          for (
            const entry of list.getEntries()
          ) {
            window.__REACTPULSE_PERFORMANCE__.longTasks.push({
              startTime:
                entry.startTime,

              duration:
                entry.duration
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
