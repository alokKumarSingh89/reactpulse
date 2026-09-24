"use client";

import { AlertTriangle, LoaderCircle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

import { PerformanceReport } from "@/features/performance/performance-report";

import { ScanMetadata } from "./scan-metadata";

import { ScanStatusBadge } from "./scan-status-badge";

import type { ScanDetail } from "./scan.types";

interface ScanReportProps {
  scan: ScanDetail;

  pollError: string | null;

  refreshing: boolean;

  onRefresh: () => void;
}

export function ScanReport({
  scan,
  pollError,
  refreshing,
  onRefresh,
}: ScanReportProps) {
  const performanceMetrics = scan.metrics.filter(
    (metric) => metric.category === "PERFORMANCE",
  );

  return (
    <div className="min-w-0 space-y-8">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-slate-950">Scan status</h2>

              <ScanStatusBadge status={scan.status} />
            </div>

            <p className="mt-2 break-all text-sm text-slate-500">
              {scan.targetUrl}
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            disabled={refreshing}
            onClick={onRefresh}
          >
            <RefreshCw
              size={15}
              className={refreshing ? "animate-spin" : undefined}
            />

            <span className="ml-2">Refresh</span>
          </Button>
        </div>

        {isProcessing(scan.status) && <ProcessingState status={scan.status} />}

        {pollError && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {pollError}
          </div>
        )}

        {scan.status === "FAILED" && (
          <FailureState code={scan.failureCode} message={scan.failureMessage} />
        )}

        {scan.status === "CANCELLED" && (
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-800">Scan cancelled</p>

            <p className="mt-1 text-sm text-slate-500">
              This scan did not complete.
            </p>
          </div>
        )}
      </section>

      <ScanMetadata scan={scan} />

      {scan.status === "COMPLETED" &&
        (performanceMetrics.length > 0 ? (
          <PerformanceReport metrics={performanceMetrics} />
        ) : (
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-950">Performance</h2>

            <p className="mt-2 text-sm text-slate-500">
              No performance measurements were recorded for this scan.
            </p>
          </section>
        ))}
    </div>
  );
}

function ProcessingState({ status }: { status: ScanDetail["status"] }) {
  return (
    <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center gap-3">
        <LoaderCircle size={18} className="animate-spin text-slate-600" />

        <div>
          <p className="text-sm font-medium text-slate-800">
            {getProcessingLabel(status)}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            ReactPulse is refreshing this scan automatically.
          </p>
        </div>
      </div>
    </div>
  );
}

function FailureState({
  code,
  message,
}: {
  code: string | null;

  message: string | null;
}) {
  return (
    <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600" />

        <div>
          <p className="text-sm font-medium text-red-800">Scan failed</p>

          <p className="mt-1 text-sm text-red-700">
            {message ?? "ReactPulse could not complete this scan."}
          </p>

          {code && (
            <code className="mt-2 block text-xs text-red-600">{code}</code>
          )}
        </div>
      </div>
    </div>
  );
}

function isProcessing(status: ScanDetail["status"]) {
  return status === "PENDING" || status === "QUEUED" || status === "RUNNING";
}

function getProcessingLabel(status: ScanDetail["status"]) {
  switch (status) {
    case "PENDING":
      return "Preparing scan";

    case "QUEUED":
      return "Waiting for scanner";

    case "RUNNING":
      return "Analyzing application";

    default:
      return "Processing scan";
  }
}
