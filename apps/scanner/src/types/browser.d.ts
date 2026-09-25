export {};

declare global {
  interface Window {
    __REACTPULSE_PERFORMANCE__?: {
      lcp: number | null;
      layoutShifts: Array<{
        value: number;
        startTime: number;
        hadRecentInput: boolean;
      }>;

      longTasks: Array<{
        startTime: number;
        duration: number;
      }>;
    };
  }
}
