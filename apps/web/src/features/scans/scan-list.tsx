import { Monitor } from "lucide-react";

import Link from "next/link";

import { ScanStatusBadge } from "./scan-status-badge";

import type { ScanSummary } from "./scan.types";

interface ScanListProps {
  scans: ScanSummary[];
  selectedScanId?: string;
}

export function ScanList({ scans, selectedScanId }: ScanListProps) {
  if (scans.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <Monitor size={24} className="mx-auto text-slate-400" />

        <h2 className="mt-3 font-semibold text-slate-950">No scans yet</h2>

        <p className="mt-2 text-sm text-slate-500">
          Open a project and run a scan against an environment.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {scans.map((scan) => {
        const selected = scan.id === selectedScanId;

        return (
          <Link
            key={scan.id}
            href={`/scans?scanId=${encodeURIComponent(scan.id)}`}
            className={`block border-b border-slate-100 p-4 transition last:border-b-0 ${
              selected ? "bg-slate-50" : "hover:bg-slate-50"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">
                  {scan.environment.project.name}
                </p>

                <p className="mt-1 truncate text-xs text-slate-500">
                  {scan.environment.name}
                </p>
              </div>

              <ScanStatusBadge status={scan.status} />
            </div>

            <p className="mt-3 truncate text-xs text-slate-400">
              {scan.targetUrl}
            </p>

            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-400">
              <span>{formatDate(scan.createdAt)}</span>

              <span>{formatDuration(scan.startedAt, scan.completedAt)}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDuration(
  startedAt: string | null,
  completedAt: string | null,
): string {
  if (!startedAt || !completedAt) {
    return "—";
  }

  const start = new Date(startedAt).getTime();

  const end = new Date(completedAt).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return "—";
  }

  const durationMs = end - start;

  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }

  return `${(durationMs / 1000).toFixed(1)} s`;
}
