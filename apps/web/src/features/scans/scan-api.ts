import "server-only";

import { authenticatedApiRequest } from "@/lib/api/authenticated-api";

import type { ScanDetail, ScanSummary } from "./scan.types";

export async function getOrganizationScans(
  organizationId: string,
): Promise<ScanSummary[]> {
  return authenticatedApiRequest<ScanSummary[]>(
    `/organizations/${organizationId}/scans`,
  );
}

export async function getOrganizationScan(
  organizationId: string,
  scanId: string,
): Promise<ScanDetail> {
  return authenticatedApiRequest<ScanDetail>(
    `/organizations/${organizationId}/scans/${scanId}`,
  );
}
