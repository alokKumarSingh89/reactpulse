import Link from "next/link";
import {
  Accessibility,
  ArrowRight,
  Gauge,
  ListChecks,
  Network,
  ShieldCheck,
} from "lucide-react";
import { getCurrentUser } from "@/features/auth/get-current-user";
import { getOverviewContext } from "@/features/overview/overview-data";
import {
  AnalyticsSurface,
  MetricMeta,
} from "@/features/overview/analytics-surface";
import { getOrganizationScan } from "@/features/scans/scan-api";
import type { ScanDetail, ScanMetric } from "@/features/scans/scan.types";
import { ScanStatusBadge } from "@/features/scans/scan-status-badge";
import { RunScanButton } from "@/features/scans/run-scan-button";
import {
  formatBytes,
  formatCount,
  formatDuration,
  formatPercentage,
} from "@/features/network/network-format";
import { getEnvironments } from "@/features/environments/environment-api";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    projectId?: string;
    environmentId?: string;
    scanId?: string;
  }>;
}) {
  const user = await getCurrentUser();
  const organization = user?.memberships[0]?.organization;
  if (!organization)
    return (
      <div>
        <h1 className="text-3xl font-semibold">Overview</h1>
        <p className="mt-4 text-sm text-slate-600">
          Join an organization to view application intelligence.
        </p>
      </div>
    );
  const query = await searchParams;
  const { projects, scans, scansUnavailable, projectsUnavailable } =
    await getOverviewContext(organization.id);
  const requestedScan = query.scanId
    ? scans.find((s) => s.id === query.scanId)
    : undefined;
  const projectId = requestedScan?.environment.project.id ?? query.projectId;
  const environmentId = requestedScan?.environment.id ?? query.environmentId;
  const project = projects.find((p) => p.id === projectId);
  const environments = project
    ? await getEnvironments(organization.id, project.id).catch(() => null)
    : [];
  const environment = environments?.find((e) => e.id === environmentId);
  const invalidContext = Boolean(
    (query.scanId && !requestedScan) ||
    (projectId && !project && !projectsUnavailable) ||
    (environmentId && !environment && environments !== null),
  );
  const scoped = invalidContext
    ? []
    : scans.filter(
        (s) =>
          (!projectId || s.environment.project.id === projectId) &&
          (!environmentId || s.environment.id === environmentId),
      );
  const completed = scoped.filter((s) => s.status === "COMPLETED");
  const selected = requestedScan ?? completed[0];
  const history =
    selected?.status === "COMPLETED"
      ? completed
          .filter(
            (s) =>
              s.environment.id === selected.environment.id &&
              Date.parse(s.createdAt) <= Date.parse(selected.createdAt),
          )
          .slice(0, 6)
      : [];
  const details = await Promise.allSettled(
    history.map((s) => getOrganizationScan(organization.id, s.id)),
  );
  const selectedResult = details[0];
  const detail: ScanDetail | null =
    selectedResult?.status === "fulfilled" ? selectedResult.value : null;
  const metrics = detail?.status === "COMPLETED" ? detail.metrics : [];
  const value = (category: ScanMetric["category"], key: string) => {
    const v = metrics.find(
      (m) => m.category === category && m.key === key,
    )?.value;
    return v !== undefined && Number.isFinite(v) && v >= 0 ? v : null;
  };
  const lcp = value("PERFORMANCE", "lcp");
  const cls = value("PERFORMANCE", "synthetic_cls");
  const requests = value("NETWORK", "request_count");
  const thirdParty = value("NETWORK", "third_party_request_percentage");
  const trend = details
    .map((result, index) => ({
      scan: history[index],
      value:
        result.status === "fulfilled"
          ? result.value.metrics.find(
              (m) => m.category === "PERFORMANCE" && m.key === "lcp",
            )?.value
          : undefined,
    }))
    .reverse();
  const trendAvailable =
    trend.length >= 2 &&
    trend.every(
      (p) => p.value !== undefined && Number.isFinite(p.value) && p.value >= 0,
    );
  const href = (path: string) =>
    `${path}${selected ? `?scanId=${encodeURIComponent(selected.id)}` : ""}`;
  const recent = scoped.slice(0, 12);
  const activityCounts = [
    {
      label: "Completed",
      count: recent.filter((s) => s.status === "COMPLETED").length,
      color: "bg-emerald-500",
    },
    {
      label: "Failed",
      count: recent.filter((s) => s.status === "FAILED").length,
      color: "bg-red-500",
    },
    {
      label: "Running / queued",
      count: recent.filter((s) =>
        ["RUNNING", "QUEUED", "PENDING"].includes(s.status),
      ).length,
      color: "bg-amber-500",
    },
    {
      label: "Cancelled",
      count: recent.filter((s) => s.status === "CANCELLED").length,
      color: "bg-slate-400",
    },
  ];
  const problem = scansUnavailable
    ? "Scan data is unavailable. Reload to try again."
    : invalidContext
      ? "This scan or context is unavailable. Choose another project or environment."
      : selectedResult?.status === "rejected"
        ? "Measurements could not be loaded. Scan activity is still available."
        : null;
  const empty =
    selected && selected.status !== "COMPLETED"
      ? "Awaiting a completed scan"
      : "No measurement recorded";
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-medium text-slate-500">
            {organization.name} <span className="mx-1 text-slate-300">/</span>{" "}
            {project?.name ?? "All projects"}
            {environment ? ` / ${environment.name}` : ""}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Overview
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {selected
              ? `${query.scanId ? "Selected" : "Latest"} scan${selected.completedAt ? ` completed ${relativeTime(selected.completedAt)}` : ` · ${selected.status.toLowerCase()}`} · ${selected.environment.project.name} / ${selected.environment.name}`
              : "Your application intelligence, grounded in observed data."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selected && <ScanStatusBadge status={selected.status} />}
          {environment && project ? (
            <RunScanButton
              organizationId={organization.id}
              projectId={project.id}
              environmentId={environment.id}
            />
          ) : (
            <Link
              href="/projects"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Manage projects <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      </div>
      {problem && (
        <p
          role="alert"
          className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          {problem}{" "}
          <Link href="/overview" className="underline">
            Reset context
          </Link>
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:gap-5">
        <AnalyticsSurface
          title="Performance"
          icon={Gauge}
          href={href("/performance")}
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500">Largest Contentful Paint</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
                {lcp === null ? "Not available" : formatDuration(lcp)}
              </p>
            </div>
            <span className="rounded bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700">
              Synthetic
            </span>
          </div>
          {trendAvailable ? (
            <div className="mt-4">
              <svg
                viewBox="0 0 360 48"
                className="h-12 w-full text-blue-600"
                aria-hidden="true"
                preserveAspectRatio="none"
              >
                <polyline
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  points={trend
                    .map(
                      (p, i) =>
                        `${(i * 360) / (trend.length - 1)},${44 - (p.value! / Math.max(1, ...trend.map((t) => t.value!))) * 38}`,
                    )
                    .join(" ")}
                />
              </svg>
              <p className="mt-1 text-[11px] text-slate-500">
                LCP · {trend.length} scans in this environment, oldest to newest
              </p>
              <span className="sr-only">
                {trend
                  .map(
                    (p) =>
                      `${date(p.scan.createdAt)}: ${formatDuration(p.value)}`,
                  )
                  .join("; ")}
              </span>
            </div>
          ) : (
            <p className="mt-4 text-xs text-slate-500">
              {lcp === null
                ? empty
                : "Latest measured sample · more comparable scans needed for a trend"}
            </p>
          )}
          <MetricMeta
            items={[
              {
                label: "Synthetic CLS",
                value: cls === null ? "—" : cls.toFixed(3),
              },
              {
                label: "Observed blocking",
                value: formatDuration(
                  value("PERFORMANCE", "observed_total_blocking_time"),
                ),
              },
              {
                label: "TTFB",
                value: formatDuration(value("PERFORMANCE", "ttfb")),
              },
            ]}
          />
        </AnalyticsSurface>
        <AnalyticsSurface
          title="Network"
          icon={Network}
          href={href("/network")}
          tone="violet"
        >
          <p className="text-xs text-slate-500">Observed requests</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
            {requests === null ? "Not available" : formatCount(requests)}
          </p>
          {thirdParty !== null && thirdParty >= 0 && thirdParty <= 100 ? (
            <div className="mt-5">
              <div
                className="flex h-2 overflow-hidden rounded bg-blue-100"
                aria-hidden="true"
              >
                <div
                  className="bg-violet-500"
                  style={{ width: `${thirdParty}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {formatPercentage(thirdParty)} third-party requests
              </p>
            </div>
          ) : (
            <p className="mt-4 text-xs text-slate-500">
              {requests === null ? empty : "Request distribution unavailable"}
            </p>
          )}
          <MetricMeta
            items={[
              {
                label: "Transfer",
                value: formatBytes(value("RESOURCE", "transfer_size")),
              },
              { label: "Third-party", value: formatPercentage(thirdParty) },
              {
                label: "Failed requests",
                value: formatCount(value("NETWORK", "failed_request_count")),
              },
            ]}
          />
        </AnalyticsSurface>
        <AnalyticsSurface
          title="Security"
          icon={ShieldCheck}
          href={href("/security")}
          tone="amber"
        >
          <p className="text-xs text-slate-500">Passive analysis</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">
            Not assessed
          </p>
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-500">
            Security reporting is not connected yet. Finding counts and coverage
            will appear when available.
          </p>
          <p className="mt-5 text-xs font-medium text-slate-500">
            No security score or verdict
          </p>
        </AnalyticsSurface>
        <AnalyticsSurface
          title="Accessibility"
          icon={Accessibility}
          href={href("/accessibility")}
          tone="slate"
        >
          <p className="text-xs text-slate-500">Inclusive experiences</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-600">
            Coming soon
          </p>
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-500">
            Accessibility checks are not enabled. This application has not been
            assessed for accessibility.
          </p>
          <p className="mt-5 text-xs font-medium text-slate-500">
            Awaiting automated observations
          </p>
        </AnalyticsSurface>
      </div>
      <section
        className="rounded-lg border border-slate-200 bg-white p-5 sm:p-6"
        aria-labelledby="scan-activity-heading"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="scan-activity-heading" className="text-base font-semibold">
              Scan activity
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {scansUnavailable
                ? "Activity unavailable"
                : `Most recent ${recent.length} scans in this context · snapshot at page load`}
            </p>
          </div>
          <Link
            href="/scans"
            className="flex items-center gap-1 text-xs font-medium text-blue-700"
          >
            View scans <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
        {recent.length ? (
          <>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 border-b border-slate-100 pb-5">
              {activityCounts.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 text-xs text-slate-600"
                >
                  <span
                    aria-hidden="true"
                    className={`size-2 rounded-full ${item.color}`}
                  />
                  {item.label}
                  <span className="font-semibold tabular-nums text-slate-900">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-5" aria-label="Recent scan sequence">
              <p className="mb-3 text-xs text-slate-500">
                Scan sequence · oldest to newest
              </p>
              <ol className="grid grid-cols-6 gap-2 sm:grid-cols-12">
                {[...recent].reverse().map((scan) => (
                  <li key={scan.id}>
                    <Link
                      href={`/scans?scanId=${encodeURIComponent(scan.id)}`}
                      aria-label={`${scan.status.toLowerCase()} scan, ${date(scan.createdAt)}`}
                      title={`${date(scan.createdAt)} · ${scan.status.toLowerCase()}`}
                      className="flex h-9 items-center justify-center rounded-md bg-slate-50 hover:bg-blue-50"
                    >
                      <span
                        aria-hidden="true"
                        className={`size-2.5 rounded-full ${scan.status === "COMPLETED" ? "bg-emerald-500" : scan.status === "FAILED" ? "bg-red-500" : scan.status === "CANCELLED" ? "bg-slate-400" : "bg-amber-500"}`}
                      />
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
            <ul className="mt-2 divide-y divide-slate-100">
              {recent.slice(0, 6).map((scan) => (
                <li key={scan.id}>
                  <Link
                    href={`/scans?scanId=${encodeURIComponent(scan.id)}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md py-3 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium">
                        {scan.environment.project.name}{" "}
                        <span className="font-normal text-slate-500">
                          / {scan.environment.name}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        <time dateTime={scan.createdAt}>
                          {date(scan.createdAt)}
                        </time>{" "}
                        · {scan.trigger.toLowerCase()}
                      </p>
                    </div>
                    <ScanStatusBadge status={scan.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="py-10 text-center">
            <p className="text-sm font-medium">
              {scansUnavailable
                ? "Unable to load scan activity"
                : "No scans in this context"}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {scansUnavailable
                ? "Try reloading this page."
                : "Choose a project environment and run your first scan."}
            </p>
            <Link
              href="/projects"
              className="mt-4 inline-block text-sm font-medium text-blue-700"
            >
              View projects →
            </Link>
          </div>
        )}
      </section>
      <section className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
        <ListChecks size={21} className="text-slate-400" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">Recent findings</h2>
          <p className="mt-1 text-sm text-slate-500">
            Not assessed. Finding reporting is not connected; this does not mean
            no issues exist.
          </p>
        </div>
        <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
          Unavailable
        </span>
      </section>
      <p className="text-xs leading-5 text-slate-500">
        Measurements are synthetic browser observations, not real-user data.
        Observed blocking is not Lighthouse TBT. A completed scan is not a
        health or security verdict.
      </p>
    </div>
  );
}
function date(value: string) {
  return (
    new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(value)) + " UTC"
  );
}
function relativeTime(value: string) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(value)) / 60000),
  );
  return minutes < 1
    ? "just now"
    : minutes < 60
      ? `${minutes} min ago`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)} hr ago`
        : `${Math.floor(minutes / 1440)} days ago`;
}
