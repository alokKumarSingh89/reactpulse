import { Activity, ScanSearch } from "lucide-react";

import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/features/auth/get-current-user";

import { getActiveOrganization } from "@/features/organizations/get-active-organization";

import {
  getOrganizationScan,
  getOrganizationScans,
} from "@/features/scans/scan-api";

import { ScanList } from "@/features/scans/scan-list";

import { ScanReportClient } from "@/features/scans/scan-report-client";

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

  if (!scanId) {
    return (
      <div className="space-y-6">
        <PageHeader />

        <ScanList scans={scans} />
      </div>
    );
  }

  let selectedScan;

  try {
    selectedScan = await getOrganizationScan(organizationId, scanId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }

  return (
    <div className="space-y-6">
      <PageHeader />

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div>
          <ScanList scans={scans} selectedScanId={selectedScan.id} />
        </div>

        <ScanReportClient
          organizationId={organizationId}
          initialScan={selectedScan}
        />
      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
          <Activity size={19} />
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            Scans
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Browser analysis across your React applications.
          </p>
        </div>
      </div>
    </div>
  );
}
