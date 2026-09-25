import type { ScanMetric } from "@/features/scans/scan.types";

import type { NormalizedNetworkEvidence } from "./network-normalizer";
import type { NetworkResponseEvidence } from "./network.types";

export interface ResourceBreakdownItem {
  type: string;
  requests: number;
  transferSize: number | null;
}

export interface ThirdPartyDomainItem {
  domain: string;
  requests: number;
  transferSize: number | null;
}

export interface CacheObservation {
  url: string;
  domain: string | null;
  resourceType: string;
  cacheControl: string | null;
  fromServiceWorker: boolean;
}

export interface NetworkViewModel {
  requestCount: number | null;
  failedRequestCount: number | null;
  apiRequestCount: number | null;

  totalTransferSize: number | null;

  thirdPartyPercentage: number | null;
  thirdPartyTransferSize: number | null;

  javascriptTransferSize: number | null;
  stylesheetTransferSize: number | null;
  imageTransferSize: number | null;
  fontTransferSize: number | null;

  largestResources: NetworkResponseEvidence[];
  slowestRequests: NetworkResponseEvidence[];

  failedRequests: NormalizedNetworkEvidence["failures"];

  resourceBreakdown: ResourceBreakdownItem[];
  thirdPartyDomains: ThirdPartyDomainItem[];

  cacheObservations: CacheObservation[];

  serviceWorkerResponseCount: number;
  cacheControlResponseCount: number;
  missingCacheControlResponseCount: number;
}

export function createNetworkViewModel(
  metrics: ScanMetric[],
  evidence: NormalizedNetworkEvidence,
): NetworkViewModel {
  const serviceWorkerResponses = evidence.responses.filter(
    (response) => response.fromServiceWorker,
  );

  const cacheControlResponses = evidence.responses.filter((response) =>
    hasText(response.cacheControl),
  );

  const missingCacheControlResponses = evidence.responses.filter(
    (response) => !hasText(response.cacheControl),
  );

  return {
    requestCount: metricValue(metrics, "NETWORK", "request_count"),

    failedRequestCount: metricValue(metrics, "NETWORK", "failed_request_count"),

    apiRequestCount: metricValue(metrics, "NETWORK", "api_request_count"),

    totalTransferSize: metricValue(metrics, "RESOURCE", "transfer_size"),

    thirdPartyPercentage: metricValue(
      metrics,
      "NETWORK",
      "third_party_request_percentage",
    ),

    thirdPartyTransferSize: metricValue(
      metrics,
      "NETWORK",
      "third_party_transfer_size",
    ),

    javascriptTransferSize: metricValue(
      metrics,
      "RESOURCE",
      "javascript_transfer_size",
    ),

    stylesheetTransferSize: metricValue(
      metrics,
      "RESOURCE",
      "stylesheet_transfer_size",
    ),

    imageTransferSize: metricValue(metrics, "RESOURCE", "image_transfer_size"),

    fontTransferSize: metricValue(metrics, "RESOURCE", "font_transfer_size"),

    largestResources: evidence.responses
      .filter((response) => response.transferSize !== null)
      .sort(
        (left, right) => (right.transferSize ?? 0) - (left.transferSize ?? 0),
      )
      .slice(0, 10),

    slowestRequests: evidence.responses
      .filter((response) => response.durationMs !== null)
      .sort((left, right) => (right.durationMs ?? 0) - (left.durationMs ?? 0))
      .slice(0, 10),

    failedRequests: evidence.failures.slice(0, 20),

    resourceBreakdown: createResourceBreakdown(evidence.responses),

    thirdPartyDomains: createThirdPartyDomains(evidence.responses),

    cacheObservations: evidence.responses
      .filter(
        (response) =>
          hasText(response.cacheControl) || response.fromServiceWorker,
      )
      .map((response) => ({
        url: response.url,
        domain: response.domain,
        resourceType: response.resourceType,
        cacheControl: response.cacheControl,
        fromServiceWorker: response.fromServiceWorker,
      }))
      .slice(0, 20),

    serviceWorkerResponseCount: serviceWorkerResponses.length,

    cacheControlResponseCount: cacheControlResponses.length,

    missingCacheControlResponseCount: missingCacheControlResponses.length,
  };
}

function metricValue(
  metrics: ScanMetric[],
  category: string,
  key: string,
): number | null {
  const metric = metrics.find(
    (candidate) => candidate.category === category && candidate.key === key,
  );

  if (!metric || !Number.isFinite(metric.value)) {
    return null;
  }

  return metric.value;
}

function createResourceBreakdown(
  responses: NetworkResponseEvidence[],
): ResourceBreakdownItem[] {
  const groups = new Map<
    string,
    {
      requests: number;
      transferSize: number;
      hasTransferSize: boolean;
    }
  >();

  for (const response of responses) {
    const type = response.resourceType || "other";

    const current = groups.get(type) ?? {
      requests: 0,
      transferSize: 0,
      hasTransferSize: false,
    };

    current.requests += 1;

    if (response.transferSize !== null) {
      current.transferSize += response.transferSize;

      current.hasTransferSize = true;
    }

    groups.set(type, current);
  }

  return Array.from(groups.entries())
    .map(([type, group]) => ({
      type,
      requests: group.requests,
      transferSize: group.hasTransferSize ? group.transferSize : null,
    }))
    .sort(
      (left, right) => (right.transferSize ?? -1) - (left.transferSize ?? -1),
    );
}

function createThirdPartyDomains(
  responses: NetworkResponseEvidence[],
): ThirdPartyDomainItem[] {
  const groups = new Map<
    string,
    {
      requests: number;
      transferSize: number;
      hasTransferSize: boolean;
    }
  >();

  for (const response of responses) {
    if (response.party !== "THIRD_PARTY" || !response.domain) {
      continue;
    }

    const current = groups.get(response.domain) ?? {
      requests: 0,
      transferSize: 0,
      hasTransferSize: false,
    };

    current.requests += 1;

    if (response.transferSize !== null) {
      current.transferSize += response.transferSize;

      current.hasTransferSize = true;
    }

    groups.set(response.domain, current);
  }

  return Array.from(groups.entries())
    .map(([domain, group]) => ({
      domain,
      requests: group.requests,
      transferSize: group.hasTransferSize ? group.transferSize : null,
    }))
    .sort(
      (left, right) => (right.transferSize ?? -1) - (left.transferSize ?? -1),
    )
    .slice(0, 10);
}

function hasText(value: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
