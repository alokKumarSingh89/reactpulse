"use client";

import { AlertTriangle, LoaderCircle, RefreshCw } from "lucide-react";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import { PerformanceReport } from "@/features/performance/performance-report";

import { ScanMetadata } from "./scan-metadata";

import { ScanStatusBadge } from "./scan-status-badge";

import type { ScanDetail } from "./scan.types";

interface ScanReportClientProps {
  organizationId: string;

  initialScan: ScanDetail;
}

const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

export function ScanReportClient({
  organizationId,
  initialScan,
}: ScanReportClientProps) {
  const [scan, setScan] = useState<ScanDetail>(initialScan);

  const [pollError, setPollError] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState(false);

  const loadScan = useCallback(async () => {
    const response = await fetch(
      `/api/organizations/${organizationId}/scans/${scan.id}`,
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error("Unable to refresh scan");
    }

    return (await response.json()) as ScanDetail;
  }, [organizationId, scan.id]);

  useEffect(() => {
    if (TERMINAL_STATUSES.has(scan.status)) {
      return;
    }

    let cancelled = false;

    const interval = window.setInterval(async () => {
      try {
        const nextScan = await loadScan();

        if (cancelled) {
          return;
        }

        setScan(nextScan);

        setPollError(null);
      } catch {
        if (!cancelled) {
          setPollError(
            "Unable to refresh scan status. ReactPulse will retry automatically.",
          );
        }
      }
    }, 1500);

    return () => {
      cancelled = true;

      window.clearInterval(interval);
    };
  }, [loadScan, scan.status]);

  async function refreshManually() {
    setRefreshing(true);

    try {
      const nextScan = await loadScan();

      setScan(nextScan);

      setPollError(null);
    } catch {
      setPollError("Unable to refresh scan status.");
    } finally {
      setRefreshing(false);
    }
  }

  const performanceMetrics = scan.metrics.filter(
    (metric) => metric.category === "PERFORMANCE",
  );

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
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
            onClick={refreshManually}
          >
            <RefreshCw
              size={15}
              className={refreshing ? "animate-spin" : undefined}
            />

            <span className="ml-2">Refresh</span>
          </Button>
        </div>

        {isProcessing(scan.status) && (
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <LoaderCircle size={18} className="animate-spin text-slate-600" />

              <div>
                <p className="text-sm font-medium text-slate-800">
                  {getProcessingLabel(scan.status)}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  This page updates automatically.
                </p>
              </div>
            </div>
          </div>
        )}

        {pollError && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {pollError}
          </div>
        )}

        {scan.status === "FAILED" && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle
                size={18}
                className="mt-0.5 shrink-0 text-red-600"
              />

              <div>
                <p className="text-sm font-medium text-red-800">Scan failed</p>

                <p className="mt-1 text-sm text-red-700">
                  {scan.failureMessage ??
                    "ReactPulse could not complete this scan."}
                </p>

                {scan.failureCode && (
                  <code className="mt-2 block text-xs text-red-600">
                    {scan.failureCode}
                  </code>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      <ScanMetadata scan={scan} />

      {scan.status === "COMPLETED" && (
        <PerformanceReport metrics={performanceMetrics} />
      )}
    </div>
  );
}

function isProcessing(status: ScanDetail["status"]) {
  return status === "PENDING" || status === "QUEUED" || status === "RUNNING";
}

function getProcessingLabel(status: ScanDetail["status"]) {
  if (status === "PENDING") {
    return "Preparing scan";
  }

  if (status === "QUEUED") {
    return "Waiting for scanner";
  }

  return "Analyzing application";
}
