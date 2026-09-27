import type { ScanMetric } from "./scan.types";
import {
  formatBytes,
  formatCount,
  formatDuration,
  formatPercentage,
} from "@/features/network/network-format";

export function scanValues(metrics: ScanMetric[] = []) {
  function value(category: string, key: string) {
    const v = metrics.find(
      (m) => m.category === category && m.key === key,
    )?.value;
    return v !== undefined && Number.isFinite(v) && v >= 0 ? v : null;
  }
  const cls = value("PERFORMANCE", "synthetic_cls");
  return {
    lcp: formatDuration(value("PERFORMANCE", "lcp")),
    cls: cls === null ? "—" : cls.toFixed(3),
    blocking: formatDuration(
      value("PERFORMANCE", "observed_total_blocking_time"),
    ),
    ttfb: formatDuration(value("PERFORMANCE", "ttfb")),
    thirdParty: formatPercentage(
      value("NETWORK", "third_party_request_percentage"),
    ),
    requests: formatCount(value("NETWORK", "request_count")),
    transfer: formatBytes(value("RESOURCE", "transfer_size")),
  };
}
export function ScanAnalytics({
  metrics = [],
  compact = false,
}: {
  metrics?: ScanMetric[];
  compact?: boolean;
}) {
  const values = scanValues(metrics);
  const items = compact
    ? [
        ["LCP", values.lcp],
        ["Requests", values.requests],
        ["Transfer", values.transfer],
      ]
    : [
        ["LCP", values.lcp],
        ["Synthetic CLS", values.cls],
        ["Observed blocking", values.blocking],
        ["TTFB", values.ttfb],
      ];
  return (
    <dl
      className={`grid gap-3 ${compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}
    >
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[11px] text-slate-500">{label}</dt>
          <dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
export function scanDate(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "Unknown date"
    : new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      }).format(d) + " UTC";
}
