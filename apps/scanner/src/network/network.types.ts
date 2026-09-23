export type NetworkResourceType =
  | 'document'
  | 'stylesheet'
  | 'image'
  | 'media'
  | 'font'
  | 'script'
  | 'xhr'
  | 'fetch'
  | 'websocket'
  | 'manifest'
  | 'other';

export interface NetworkRequestRecord {
  requestId: string;

  url: string;
  hostname: string;

  method: string;
  resourceType: string;

  firstParty: boolean;

  status: number | null;
  statusText: string | null;

  mimeType: string | null;

  startedAtMs: number | null;
  durationMs: number | null;

  transferSize: number | null;
  encodedBodySize: number | null;
  decodedBodySize: number | null;

  protocol: string | null;

  fromServiceWorker: boolean | null;

  failed: boolean;

  failureText: string | null;
}

export interface ResourceTypeSummary {
  resourceType: string;

  requestCount: number;

  transferSize: number;

  encodedBodySize: number;

  decodedBodySize: number;
}

export interface NetworkSummary {
  requestCount: number;

  successfulRequestCount: number;

  failedRequestCount: number;

  firstPartyRequestCount: number;

  thirdPartyRequestCount: number;

  totalTransferSize: number;

  totalEncodedBodySize: number;

  totalDecodedBodySize: number;

  slowRequestCount: number;

  resourceTypes: ResourceTypeSummary[];
}

export interface NetworkObservation {
  requests: NetworkRequestRecord[];

  summary: NetworkSummary;
}
