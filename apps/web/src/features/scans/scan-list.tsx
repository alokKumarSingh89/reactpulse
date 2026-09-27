import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ScanStatusBadge } from "./scan-status-badge";
import { scanDate, scanValues } from "./scan-analytics";
import type { ScanSummary, ScanMetric } from "./scan.types";

export function ScanList({
  scans,
  selectedScanId,
  metrics = {},
}: {
  scans: ScanSummary[];
  selectedScanId?: string;
  metrics?: Record<string, ScanMetric[]>;
}) {
  if (!scans.length)
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
        <h2 className="font-semibold">No scans yet</h2>
        <p className="mt-2 text-sm text-slate-500">
          Select a project environment to capture your first observations.
        </p>
        <Link
          href="/projects"
          className="mt-4 inline-block text-sm text-blue-700"
        >
          Choose a project →
        </Link>
      </div>
    );
  const multiple = new Set(scans.map((s) => s.environment.id)).size > 1;
  return (
    <section
      className="overflow-hidden rounded-lg border border-slate-200 bg-white"
      aria-labelledby="history-title"
    >
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 id="history-title" className="text-base font-semibold">
          Scan history
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Newest first · — means measurements are unavailable or not loaded
        </p>
      </div>
      <div
        aria-hidden="true"
        className="hidden grid-cols-[minmax(0,2fr)_110px_80px_80px_90px_55px] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2 text-[10px] font-medium uppercase tracking-wide text-slate-500 md:grid"
      >
        <span>Date / context</span>
        <span>Status</span>
        <span>LCP</span>
        <span>Requests</span>
        <span>Transfer</span>
        <span />
      </div>
      <ul className="divide-y divide-slate-100">
        {scans.map((scan) => {
          const v = scanValues(
            scan.status === "COMPLETED" ? metrics[scan.id] : [],
          );
          return (
            <li key={scan.id}>
              <Link
                href={`/scans?scanId=${encodeURIComponent(scan.id)}`}
                aria-current={scan.id === selectedScanId ? "true" : undefined}
                className={`grid min-h-14 grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-2 text-xs md:grid-cols-[minmax(0,2fr)_110px_80px_80px_90px_55px] ${scan.id === selectedScanId ? "bg-blue-50" : "hover:bg-slate-50"}`}
              >
                <div className="min-w-0">
                  <time
                    dateTime={scan.createdAt}
                    className="font-medium text-slate-800"
                  >
                    {scanDate(scan.createdAt)}
                  </time>
                  {multiple && (
                    <p className="truncate text-[11px] text-slate-500">
                      {scan.environment.project.name} · {scan.environment.name}
                    </p>
                  )}
                </div>
                <ScanStatusBadge status={scan.status} />
                <span className="hidden tabular-nums md:block">{v.lcp}</span>
                <span className="hidden tabular-nums md:block">
                  {v.requests}
                </span>
                <span className="hidden tabular-nums md:block">
                  {v.transfer}
                </span>
                <span className="text-[11px] text-slate-500 md:hidden">
                  LCP {v.lcp} · {v.requests} requests · {v.transfer}
                </span>
                <span className="flex items-center justify-end gap-1 text-blue-700">
                  <span className="hidden md:inline">View</span>
                  <ArrowRight size={13} aria-hidden="true" />
                  <span className="sr-only">Scan details</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
