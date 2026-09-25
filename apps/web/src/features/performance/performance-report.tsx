import { Activity } from "lucide-react";

import type { ScanMetric } from "@/features/scans/scan.types";

import { MetricCard } from "./metric-card";

import {
  findMetric,
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

  const syntheticCls = findMetric(metrics, "synthetic_cls");

  const navigation = findMetric(metrics, "navigation_duration");

  const blocking = findMetric(metrics, "observed_total_blocking_time");

  const longTaskCount = findMetric(metrics, "long_task_count");

  const longTaskDuration = findMetric(metrics, "long_task_duration");

  const domNodes = findMetric(metrics, "dom_nodes");

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
            description="Document response latency measured from request start to response start."
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
            description="Largest Contentful Paint observed during the synthetic scan window."
          />
        )}

        {syntheticCls && (
          <MetricCard
            label="Synthetic CLS"
            value={syntheticCls.value.toFixed(3)}
            description="Largest layout-shift session window observed during this synthetic scan."
          />
        )}

        {navigation && (
          <MetricCard
            label="Navigation"
            value={formatMilliseconds(navigation.value)}
            description="Total observed navigation duration for the scanned document."
          />
        )}

        {blocking && (
          <MetricCard
            label="Observed blocking"
            value={formatMilliseconds(blocking.value)}
            description="Blocking derived from observed long tasks. This is not Lighthouse Total Blocking Time."
          />
        )}

        {longTaskCount && (
          <MetricCard
            label="Long tasks"
            value={formatNumber(longTaskCount.value)}
            description="Number of main-thread tasks observed above the long-task threshold."
          />
        )}

        {longTaskDuration && (
          <MetricCard
            label="Long-task duration"
            value={formatMilliseconds(longTaskDuration.value)}
            description="Combined duration of the long tasks observed during the scan."
          />
        )}

        {domNodes && (
          <MetricCard
            label="DOM nodes"
            value={formatNumber(domNodes.value)}
            description="Number of DOM elements present when ReactPulse collected the performance snapshot."
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
