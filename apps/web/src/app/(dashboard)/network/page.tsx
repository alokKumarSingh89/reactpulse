import { Activity } from "lucide-react";

import { getNetworkAnalysis } from "@/features/network/network-api";

import { normalizeNetworkEvidence } from "@/features/network/network-normalizer";

import { NetworkReport } from "@/features/network/network-report";

import { NetworkScanSelector } from "@/features/network/network-scan-selector";

import { createNetworkViewModel } from "@/features/network/network-view-model";

import { getOrganizationScans } from "@/features/scans/scan-api";
import { getCurrentUser } from "@/features/auth/get-current-user";

interface NetworkPageProps {
  searchParams: Promise<{
    scanId?: string;
  }>;
}

export default async function NetworkPage({ searchParams }: NetworkPageProps) {
  const user = await getCurrentUser();

  const organization = user?.memberships[0]?.organization;

  if (!organization) {
    return (
      <div className="space-y-6">
        <PageHeader />

        <EmptyState
          title="No organization"
          description="Create or join an organization before running network analysis."
        />
      </div>
    );
  }

  const { scanId: requestedScanId } = await searchParams;

  const allScans = await getOrganizationScans(organization.id);

  /*
   * Network analysis is currently available only
   * after scanner evidence has been persisted.
   */
  const completedScans = allScans.filter((scan) => scan.status === "COMPLETED");

  if (completedScans.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader />

        <EmptyState
          title="No completed scan"
          description="Run a scan against your project environment to generate network intelligence."
        />
      </div>
    );
  }

  /*
   * Prefer the requested completed scan.
   *
   * Otherwise automatically select the newest
   * completed scan returned by the API.
   */
  const selectedScan =
    completedScans.find((scan) => scan.id === requestedScanId) ??
    completedScans[0];

  const analysis = await getNetworkAnalysis(organization.id, selectedScan.id);

  const evidence = normalizeNetworkEvidence(analysis.evidence);

  const model = createNetworkViewModel(analysis.metrics, evidence);

  return (
    <div className="space-y-6">
      <PageHeader />

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <NetworkScanSelector
            scans={completedScans}
            selectedScanId={selectedScan.id}
          />

          <div className="min-w-0 lg:text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Target
            </p>

            <p
              title={selectedScan.targetUrl}
              className="mt-1 max-w-xl truncate text-sm text-slate-600"
            >
              {selectedScan.targetUrl}
            </p>
          </div>
        </div>
      </section>

      <NetworkReport model={model} />
    </div>
  );
}

function PageHeader() {
  return (
    <div>
      <div className="flex items-center gap-2">
        <Activity size={22} className="text-slate-500" />

        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
          Network
        </h1>
      </div>

      <p className="mt-2 text-sm text-slate-500">
        Inspect requests, transferred resources, third-party dependencies, and
        network failures.
      </p>
    </div>
  );
}

interface EmptyStateProps {
  title: string;

  description: string;
}

function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <Activity size={26} className="mx-auto text-slate-400" />

      <h2 className="mt-4 font-semibold text-slate-950">{title}</h2>

      <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
        {description}
      </p>
    </div>
  );
}
