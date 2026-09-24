import "server-only";

import { authenticatedApiRequest } from "@/lib/api/authenticated-api";

import type { NetworkAnalysisResponse } from "./network.types";

export async function getNetworkAnalysis(
  organizationId: string,
  scanId: string,
): Promise<NetworkAnalysisResponse> {
  return authenticatedApiRequest<NetworkAnalysisResponse>(
    `/organizations/${organizationId}/scans/${scanId}/network`,
  );
}
