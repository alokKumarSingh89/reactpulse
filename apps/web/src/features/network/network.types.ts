import type { ScanMetric, ScanStatus } from "@/features/scans/scan.types";

export type NetworkParty = "FIRST_PARTY" | "THIRD_PARTY";

export interface NetworkRequestEvidence {
  sequence: number;

  url: string;

  method: string;

  resourceType: string;

  domain: string | null;

  party: NetworkParty;

  startedAtMs: number;
}

export interface NetworkResponseEvidence {
  sequence: number;

  requestSequence: number;

  url: string;

  status: number;

  statusText: string;

  domain: string | null;

  party: NetworkParty;

  resourceType: string;

  durationMs: number | null;

  transferSize: number | null;

  encodedBodySize: number | null;

  decodedBodySize: number | null;

  fromServiceWorker: boolean;

  cacheControl: string | null;

  contentType: string | null;
}

export interface NetworkFailureEvidence {
  sequence: number;

  requestSequence: number;

  url: string;

  method: string;

  resourceType: string;

  domain: string | null;

  party: NetworkParty;

  failureText: string | null;
}

export type NetworkEvidenceType =
  "NETWORK_REQUEST" | "NETWORK_RESPONSE" | "NETWORK_FAILURE";

export interface RawNetworkEvidence {
  id: string;

  type: NetworkEvidenceType;

  sequence: number;

  data: unknown;
}

export interface NetworkAnalysisResponse {
  id: string;

  status: ScanStatus;

  metrics: ScanMetric[];

  evidence: RawNetworkEvidence[];
}
