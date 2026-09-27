import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/get-current-user";
import { getActiveOrganization } from "@/features/organizations/get-active-organization";
import { getOrganizationScans } from "@/features/scans/scan-api";
import { RunScanButton } from "@/features/scans/run-scan-button";
import { SecurityReport } from "@/features/security/security-report";

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{
    scanId?: string;
    projectId?: string;
    environmentId?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const membership = getActiveOrganization(user);
  const query = await searchParams;
  const scans = membership
    ? await getOrganizationScans(membership.organization.id)
    : [];
  const scoped = scans.filter(
    (scan) =>
      (!query.projectId || scan.environment.project.id === query.projectId) &&
      (!query.environmentId || scan.environment.id === query.environmentId),
  );
  const selected = query.scanId
    ? scans.find((scan) => scan.id === query.scanId)
    : scoped.find((scan) => scan.status === "COMPLETED");
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Security</h1>
          <p className="mt-2 text-sm text-slate-500">
            Passive security observations from the selected scan.
          </p>
        </div>
        {selected && membership && (
          <RunScanButton
            organizationId={membership.organization.id}
            projectId={selected.environment.project.id}
            environmentId={selected.environment.id}
          />
        )}
      </header>
      <form
        action="/security"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4"
      >
        <div className="min-w-0 flex-1">
          <label
            htmlFor="security-scan"
            className="mb-2 block text-xs font-medium text-slate-600"
          >
            Project · Environment · Scan
          </label>
          <select
            id="security-scan"
            name="scanId"
            defaultValue={selected?.id ?? ""}
            key={selected?.id ?? "empty"}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <option value="" disabled>
              Select a scan
            </option>
            {scans.map((scan) => (
              <option key={scan.id} value={scan.id}>
                {scan.environment.project.name} · {scan.environment.name} ·{" "}
                {new Date(scan.createdAt).toLocaleString("en", {
                  timeZone: "UTC",
                })}{" "}
                UTC · {scan.status}
              </option>
            ))}
          </select>
        </div>
        <button
          disabled={!scans.length}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50"
        >
          View report
        </button>
      </form>
      {selected ? (
        <SecurityReport key={selected.id} scanId={selected.id} />
      ) : (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">
            {!membership
              ? "No organization"
              : query.scanId
                ? "Scan unavailable"
                : "No completed scan selected"}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Select an available scan or run a new scan to generate passive
            security intelligence.
          </p>
          <Link
            href="/projects"
            className="mt-4 inline-block text-sm font-medium text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            View projects →
          </Link>
        </section>
      )}
    </div>
  );
}
