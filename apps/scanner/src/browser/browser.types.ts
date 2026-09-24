import type { NetworkObservation } from '../network/network.types';

import type { PerformanceObservation } from '../performance/performance.types';

export interface BrowserEvidence {
  name: string;

  version: string;

  userAgent: string;
}

export interface NavigationEvidence {
  requestedUrl: string;

  finalUrl: string;

  status: number | null;

  durationMs: number;
}

export interface DocumentResponseEvidence {
  url: string;

  status: number;

  statusText: string;

  headers: Record<string, string>;
}

export interface NetworkRequestEvidence {
  url: string;

  method: string;

  resourceType: string;
}

export interface ConsoleEvidence {
  type: string;

  text: string;
}

export interface BrowserScanResult {
  browser: BrowserEvidence;

  navigation: NavigationEvidence;

  documentResponse: DocumentResponseEvidence | null;

  /*
   * Legacy request collection.
   *
   * Keep temporarily until the new NetworkCollector
   * has been fully validated.
   *
   * Do NOT persist this as NETWORK_REQUEST anymore.
   */
  requests: NetworkRequestEvidence[];

  consoleMessages: ConsoleEvidence[];

  performance: PerformanceObservation;

  /*
   * Authoritative Sprint 11 network observation.
   */
  network: NetworkObservation;
}
