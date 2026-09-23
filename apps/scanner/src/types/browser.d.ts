export {};

declare global {
  interface Window {
    __REACTPULSE_PERFORMANCE__?: {
      lcp: number | null;
      cls: number;

      longTasks: Array<{
        startTime: number;
        duration: number;
      }>;
    };
  }
}
