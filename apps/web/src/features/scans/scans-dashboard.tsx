"use client";

import { useCallback, useEffect, useState } from "react";

import { ScanList } from "./scan-list";

import { ScanReport } from "./scan-report";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { RunScanButton } from "./run-scan-button";
import { ScanStatusBadge } from "./scan-status-badge";
import { ScanAnalytics, scanDate, scanValues } from "./scan-analytics";
import { Button } from "@/components/ui/button";
import type { ScanMetric, ScanDetail, ScanSummary } from "./scan.types";

interface ScansDashboardProps {
  organizationId: string;

  initialScans: ScanSummary[];

  initialSelectedScan: ScanDetail | null;
  initialMetrics: Record<string, ScanMetric[]>;
}

const TERMINAL_STATUSES = new Set<ScanDetail["status"]>([
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);

export function ScansDashboard({
  organizationId,
  initialScans,
  initialSelectedScan,
  initialMetrics,
}: ScansDashboardProps) {
  const router = useRouter();
  const [scans, setScans] = useState<ScanSummary[]>(initialScans);

  const [selectedScan, setSelectedScan] = useState<ScanDetail | null>(
    initialSelectedScan,
  );

  const [pollError, setPollError] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState(false);

  const selectedScanId = selectedScan?.id;

  const selectedScanStatus = selectedScan?.status;

  const shouldPoll = Boolean(
    selectedScanId &&
    selectedScanStatus &&
    !TERMINAL_STATUSES.has(selectedScanStatus),
  );

  const loadSelectedScan = useCallback(async () => {
    if (!selectedScanId) {
      return null;
    }

    const response = await fetch(
      `/api/organizations/${organizationId}/scans/${selectedScanId}`,
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error("Unable to refresh scan");
    }

    return (await response.json()) as ScanDetail;
  }, [organizationId, selectedScanId]);

  const applyScanUpdate = useCallback((updatedScan: ScanDetail) => {
    setSelectedScan(updatedScan);

    setScans((current) =>
      current.map((scan) =>
        scan.id === updatedScan.id
          ? {
              ...scan,
              ...updatedScan,
            }
          : scan,
      ),
    );
  }, []);

  useEffect(() => {
    if (!shouldPoll) {
      return;
    }

    let cancelled = false;

    async function poll() {
      try {
        const updatedScan = await loadSelectedScan();

        if (cancelled || !updatedScan) {
          return;
        }

        applyScanUpdate(updatedScan);

        setPollError(null);
      } catch {
        if (!cancelled) {
          setPollError(
            "Unable to refresh scan status. ReactPulse will retry automatically.",
          );
        }
      }
    }

    const interval = window.setInterval(() => {
      void poll();
    }, 1500);

    return () => {
      cancelled = true;

      window.clearInterval(interval);
    };
  }, [shouldPoll, loadSelectedScan, applyScanUpdate]);

  async function refresh() {
    if (!selectedScanId) {
      return;
    }

    setRefreshing(true);

    try {
      const updatedScan = await loadSelectedScan();

      if (updatedScan) {
        applyScanUpdate(updatedScan);
      }

      setPollError(null);
    } catch {
      setPollError("Unable to refresh scan.");
    } finally {
      setRefreshing(false);
    }
  }

  const active = scans.filter((scan) => !TERMINAL_STATUSES.has(scan.status));
  const latest = scans.find((scan) => scan.status === "COMPLETED");
  const context = selectedScan?.environment;
  const metrics = {
    ...initialMetrics,
    ...(selectedScan?.status === "COMPLETED"
      ? { [selectedScan.id]: selectedScan.metrics }
      : {}),
  };
  const network = scanValues(latest ? metrics[latest.id] : []);
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Scans</h1>
          <p className="mt-2 text-sm text-slate-500">
            Monitor scan executions and inspect captured evidence.
          </p>
          <p className="mt-2 text-xs font-medium text-slate-600">
            {context
              ? `${context.project.name} / ${context.name}`
              : "All projects / All environments"}
          </p>
        </div>
        {context ? (
          <RunScanButton
            organizationId={organizationId}
            projectId={context.project.id}
            environmentId={context.id}
          />
        ) : (
          <Link
            href="/projects"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Run new scan
          </Link>
        )}
      </header>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-600">
        {[
          "COMPLETED",
          "FAILED",
          "RUNNING",
          "QUEUED",
          "PENDING",
          "CANCELLED",
        ].map((status) => (
          <span key={status}>
            {status.toLowerCase()}{" "}
            <strong className="ml-1 font-semibold tabular-nums text-slate-900">
              {scans.filter((scan) => scan.status === status).length}
            </strong>
          </span>
        ))}
        <Button variant="ghost" size="sm" onClick={() => router.refresh()}>
          Refresh list
        </Button>
        <span className="text-slate-500">Loaded scans across workspace</span>
      </div>
      {active.length > 0 && (
        <section
          className="rounded-lg border border-blue-200 bg-blue-50/50 px-4 py-3"
          aria-label="Active scans"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-blue-900">
              {active.length} active {active.length === 1 ? "scan" : "scans"}
            </h2>
            <span className="text-xs text-slate-500">
              Open details for live updates
            </span>
          </div>
          <ul className="mt-2 divide-y divide-blue-100">
            {active.slice(0, 3).map((scan) => (
              <li
                key={scan.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div>
                  <p className="text-sm font-medium">
                    {scan.environment.project.name} · {scan.environment.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {scan.status === "RUNNING"
                      ? "Browser scan in progress"
                      : "Waiting for scanner"}{" "}
                    · {scanDate(scan.startedAt ?? scan.createdAt)}
                  </p>
                </div>
                <Link
                  href={`/scans?scanId=${encodeURIComponent(scan.id)}`}
                  className="flex items-center gap-3 text-xs text-blue-700"
                >
                  <ScanStatusBadge status={scan.status} />
                  View details →
                </Link>
              </li>
            ))}
          </ul>
          {active.length > 3 && (
            <p className="mt-2 text-xs text-slate-600">
              {active.length - 3} more active scans in history below.
            </p>
          )}
        </section>
      )}
      {latest && (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Latest completed</h2>
              <p className="mt-1 text-xs text-slate-500">
                {scanDate(latest.completedAt ?? latest.createdAt)} ·{" "}
                {latest.environment.project.name} / {latest.environment.name}
              </p>
            </div>
            <ScanStatusBadge status={latest.status} />
          </div>
          <ScanAnalytics metrics={metrics[latest.id]} />
          <div className="mt-3 flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-3 text-xs">
            <span className="text-slate-500">
              {network.requests} requests · {network.transfer} transfer ·{" "}
              {network.thirdParty} third-party · observed blocking is not
              Lighthouse TBT
            </span>
            <Link
              href={`/performance?scanId=${encodeURIComponent(latest.id)}`}
              className="font-medium text-blue-700"
            >
              View analysis →
            </Link>
          </div>
        </section>
      )}
      {selectedScan && (
        <section className="space-y-3" aria-label="Selected scan details">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Selected scan</h2>
            <Link href="/scans" className="text-xs text-blue-700">
              Close details
            </Link>
          </div>
          <ScanReport
            scan={selectedScan}
            pollError={pollError}
            refreshing={refreshing}
            onRefresh={refresh}
          />
        </section>
      )}
      <ScanList
        scans={scans}
        selectedScanId={selectedScan?.id}
        metrics={metrics}
      />
      <p className="text-xs text-slate-500">
        Recent completed scans include loaded measurements. No change or
        regression is inferred across different environments.
      </p>
    </div>
  );
}
