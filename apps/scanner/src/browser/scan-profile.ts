export interface ScanProfile {
  id: string;
  name: string;
  viewport: {
    width: number;
    height: number;
  };
  observationWindowMs: number;
}

export const DESKTOP_PROFILE: ScanProfile = {
  id: 'desktop-v1',
  name: 'Desktop Synthetic v1',
  viewport: {
    width: 1440,
    height: 900,
  },
  observationWindowMs: 2_000,
};
