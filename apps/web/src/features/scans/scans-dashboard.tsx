"use client";

import { useCallback, useEffect, useState } from "react";

import { ScanList } from "./scan-list";

import { ScanReport } from "./scan-report";

import type { ScanDetail, ScanSummary } from "./scan.types";

interface ScansDashboardProps {
  organizationId: string;

  initialScans: ScanSummary[];

  initialSelectedScan: ScanDetail | null;
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
}: ScansDashboardProps) {
  const [scans, setScans] = useState<ScanSummary[]>(initialScans);

  const [selectedScan, setSelectedScan] = useState<ScanDetail | null>(
    initialSelectedScan,
  );

  const [pollError, setPollError] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState(false);

  const selectedScanId = selectedScan?.id;

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
    if (!selectedScan || TERMINAL_STATUSES.has(selectedScan.status)) {
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
  }, [selectedScan?.status, loadSelectedScan, applyScanUpdate]);

  async function refresh() {
    if (!selectedScan) {
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

  return (
    <div
      className={
        selectedScan ? "grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]" : ""
      }
    >
      <ScanList scans={scans} selectedScanId={selectedScan?.id} />

      {selectedScan && (
        <ScanReport
          scan={selectedScan}
          pollError={pollError}
          refreshing={refreshing}
          onRefresh={refresh}
        />
      )}
    </div>
  );
}
