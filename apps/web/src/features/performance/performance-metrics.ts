import type { ScanMetric } from "@/features/scans/scan.types";

export function findMetric(
  metrics: ScanMetric[],
  key: string,
): ScanMetric | null {
  return metrics.find((metric) => metric.key === key) ?? null;
}

export function formatMilliseconds(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} s`;
  }

  return `${Math.round(value)} ms`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${Math.round(bytes)} B`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en").format(Math.round(value));
}
