import { Activity } from "lucide-react";

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

  return (
    <div className="space-y-6">
      <PageHeader />

      <ScansDashboard
        key={selectedScan?.id ?? "scan-list"}
        organizationId={organizationId}
        initialScans={scans}
        initialSelectedScan={selectedScan}
      />
    </div>
  );
}

function PageHeader() {
  return (
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
  );
}
