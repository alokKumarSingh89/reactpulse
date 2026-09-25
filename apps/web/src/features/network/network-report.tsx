import { FailedRequests } from "./failed-requests";

import { LargestResources } from "./largest-resources";

import { NetworkSummary } from "./network-summary";

import { ResourceBreakdown } from "./resource-breakdown";

import { ResourceSizeSummary } from "./resource-size-summary";

import { SlowestRequests } from "./slowest-requests";

import { ThirdPartyDomains } from "./third-party-domains";

import type { NetworkViewModel } from "./network-view-model";

interface NetworkReportProps {
  model: NetworkViewModel;
}

export function NetworkReport({ model }: NetworkReportProps) {
  return (
    <div className="space-y-6">
      <NetworkSummary model={model} />

      <ResourceSizeSummary model={model} />

      <div className="grid gap-6 xl:grid-cols-2">
        <ResourceBreakdown model={model} />

        <ThirdPartyDomains domains={model.thirdPartyDomains} />
      </div>

      <LargestResources responses={model.largestResources} />

      <SlowestRequests responses={model.slowestRequests} />

      <FailedRequests failures={model.failedRequests} />
    </div>
  );
}
