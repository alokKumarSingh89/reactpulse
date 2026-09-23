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

  requests: NetworkRequestEvidence[];

  consoleMessages: ConsoleEvidence[];
}
