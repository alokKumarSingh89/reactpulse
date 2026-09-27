import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/features/auth/get-current-user";

import { getActiveOrganization } from "@/features/organizations/get-active-organization";

import {
  getOrganizationScan,
  getOrganizationScans,
} from "@/features/scans/scan-api";

import { ScansDashboard } from "@/features/scans/scans-dashboard";

import { ApiError } from "@/lib/api/api-error";

interface ScansPageProps {
  searchParams: Promise<{
    scanId?: string;
  }>;
}

export default async function ScansPage({ searchParams }: ScansPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const membership = getActiveOrganization(user);

  if (!membership) {
    notFound();
  }

  const organizationId = membership.organization.id;

  const { scanId } = await searchParams;

  const scans = await getOrganizationScans(organizationId);

  let selectedScan = null;

  if (scanId) {
    try {
      selectedScan = await getOrganizationScan(organizationId, scanId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        notFound();
      }

      throw error;
    }
  }

  const completed = scans
    .filter((scan) => scan.status === "COMPLETED")
    .slice(0, 12);
  const details = await Promise.allSettled(
    completed.map((scan) => getOrganizationScan(organizationId, scan.id)),
  );
  const metrics = Object.fromEntries(
    details.flatMap((result, index) =>
      result.status === "fulfilled"
        ? [[completed[index].id, result.value.metrics]]
        : [],
    ),
  );

  return (
    <div className="space-y-6">
      <ScansDashboard
        key={`${selectedScan?.id ?? "scan-list"}:${scans.map((scan) => `${scan.id}:${scan.status}`).join(",")}`}
        organizationId={organizationId}
        initialScans={scans}
        initialSelectedScan={selectedScan}
        initialMetrics={metrics}
      />
    </div>
  );
}
