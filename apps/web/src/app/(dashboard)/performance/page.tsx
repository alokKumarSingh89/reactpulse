import Link from "next/link";
import { getCurrentUser } from "@/features/auth/get-current-user";
import {
  getOrganizationScan,
  getOrganizationScans,
} from "@/features/scans/scan-api";
import { PerformanceReport } from "@/features/performance/performance-report";
import { ScanStatusBadge } from "@/features/scans/scan-status-badge";

// Reuse the existing report at its top-level destination; no new API or metrics.
export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ scanId?: string }>;
}) {
  const user = await getCurrentUser();
  const organization = user?.memberships[0]?.organization;
  const { scanId } = await searchParams;
  const scans = organization ? await getOrganizationScans(organization.id) : [];
  const selected = scanId
    ? scans.find((s) => s.id === scanId)
    : scans.find((s) => s.status === "COMPLETED");
  const detail =
    selected && organization && selected.status === "COMPLETED"
      ? await getOrganizationScan(organization.id, selected.id)
      : null;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Performance</h1>
        <p className="mt-2 text-sm text-slate-500">
          Synthetic browser measurements from your selected scan.
        </p>
      </div>
      {selected && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-5">
          <div>
            <p className="text-sm font-medium">
              {selected.environment.project.name} / {selected.environment.name}
            </p>
            <Link
              href={`/scans?scanId=${encodeURIComponent(selected.id)}`}
              className="mt-1 inline-block text-sm text-blue-700"
            >
              View scan details →
            </Link>
          </div>
          <ScanStatusBadge status={selected.status} />
        </div>
      )}
      {detail ? (
        <PerformanceReport
          metrics={detail.metrics.filter((m) => m.category === "PERFORMANCE")}
        />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-8">
          <h2 className="font-semibold">Performance data unavailable</h2>
          <p className="mt-2 text-sm text-slate-500">
            {selected
              ? "Measurements appear after this scan completes."
              : "Select a completed scan to view its measurements."}
          </p>
          <Link
            href="/scans"
            className="mt-4 inline-block text-sm text-blue-700"
          >
            Choose a scan →
          </Link>
        </div>
      )}
    </div>
  );
}
