"use client";

import { useRouter } from "next/navigation";

import type { ScanSummary } from "@/features/scans/scan.types";

interface NetworkScanSelectorProps {
  scans: ScanSummary[];

  selectedScanId: string;
}

export function NetworkScanSelector({
  scans,
  selectedScanId,
}: NetworkScanSelectorProps) {
  const router = useRouter();

  function handleChange(scanId: string) {
    router.push(`/network?scanId=${encodeURIComponent(scanId)}`);
  }

  return (
    <div className="w-full max-w-xl">
      <label
        htmlFor="network-scan"
        className="mb-2 block text-sm font-medium text-slate-700"
      >
        Scan
      </label>

      <select
        id="network-scan"
        value={selectedScanId}
        onChange={(event) => handleChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500"
      >
        {scans.map((scan) => (
          <option key={scan.id} value={scan.id}>
            {createScanLabel(scan)}
          </option>
        ))}
      </select>
    </div>
  );
}

function createScanLabel(scan: ScanSummary): string {
  const project = scan.environment.project.name;

  const environment = scan.environment.name;

  const date = formatDate(scan.completedAt ?? scan.createdAt);

  return `${project} / ${environment} • ${date}`;
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",

    timeStyle: "short",
  }).format(date);
}
