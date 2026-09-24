import { Activity } from "lucide-react";

import type { ScanMetric } from "@/features/scans/scan.types";

import { MetricCard } from "./metric-card";

import {
  findMetric,
  formatBytes,
  formatMilliseconds,
  formatNumber,
} from "./performance-metrics";

interface PerformanceReportProps {
  metrics: ScanMetric[];
}

export function PerformanceReport({ metrics }: PerformanceReportProps) {
  const ttfb = findMetric(metrics, "ttfb");

  const fcp = findMetric(metrics, "fcp");

  const lcp = findMetric(metrics, "lcp");

  const layoutShift = findMetric(metrics, "synthetic_layout_shift");

  const navigation = findMetric(metrics, "navigation_duration");

  const blocking = findMetric(metrics, "observed_total_blocking_time");

  const longTaskCount = findMetric(metrics, "long_task_count");

  const longTaskDuration = findMetric(metrics, "long_task_duration");

  const domNodes = findMetric(metrics, "dom_nodes");

  const resourceCount = findMetric(metrics, "resource_count");

  const transferSize = findMetric(metrics, "transfer_size");

  if (metrics.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <Activity size={24} className="mx-auto text-slate-400" />

        <h2 className="mt-3 font-semibold text-slate-950">
          No performance metrics
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          This scan did not produce performance observations.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">Performance</h2>

        <p className="mt-1 text-sm text-slate-500">
          Synthetic browser observations captured during this scan.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ttfb && (
          <MetricCard
            label="TTFB"
            value={formatMilliseconds(ttfb.value)}
            description="Browser-observed navigation response start."
          />
        )}

        {fcp && (
          <MetricCard
            label="FCP"
            value={formatMilliseconds(fcp.value)}
            description="First Contentful Paint observed in the synthetic browser."
          />
        )}

        {lcp && (
          <MetricCard
            label="LCP"
            value={formatMilliseconds(lcp.value)}
            description="Largest Contentful Paint observed during the scan window."
          />
        )}

        {layoutShift && (
          <MetricCard
            label="Layout shift"
            value={layoutShift.value.toFixed(3)}
            description="Synthetic layout-shift observation. Not production-user CLS."
          />
        )}

        {navigation && (
          <MetricCard
            label="Navigation"
            value={formatMilliseconds(navigation.value)}
          />
        )}

        {blocking && (
          <MetricCard
            label="Observed blocking"
            value={formatMilliseconds(blocking.value)}
            description="Long-task blocking observed by ReactPulse; not Lighthouse TBT."
          />
        )}

        {longTaskCount && (
          <MetricCard
            label="Long tasks"
            value={formatNumber(longTaskCount.value)}
          />
        )}

        {longTaskDuration && (
          <MetricCard
            label="Long-task duration"
            value={formatMilliseconds(longTaskDuration.value)}
          />
        )}

        {domNodes && (
          <MetricCard label="DOM nodes" value={formatNumber(domNodes.value)} />
        )}

        {resourceCount && (
          <MetricCard
            label="Resources"
            value={formatNumber(resourceCount.value)}
          />
        )}

        {transferSize && (
          <MetricCard
            label="Transferred"
            value={formatBytes(transferSize.value)}
          />
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-500">
        These values come from a controlled synthetic browser run. They should
        not be interpreted as real-user monitoring data or as a Lighthouse
        performance score.
      </div>
    </section>
  );
}
