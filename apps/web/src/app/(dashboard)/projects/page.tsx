import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { CreateProjectButton } from "@/features/projects/create-project-button";
import { getProjects } from "@/features/projects/project-api";
import { getEnvironments } from "@/features/environments/environment-api";
import { getActiveOrganization } from "@/features/organizations/get-active-organization";
import { getCurrentUser } from "@/features/auth/get-current-user";
import {
  getOrganizationScans,
  getOrganizationScan,
} from "@/features/scans/scan-api";
import { ScanAnalytics, scanDate } from "@/features/scans/scan-analytics";
import { ScanStatusBadge } from "@/features/scans/scan-status-badge";

export default async function ProjectsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const membership = getActiveOrganization(user);
  if (!membership) return <div>No organization membership found.</div>;
  const organizationId = membership.organization.id;
  const [projects, scans] = await Promise.all([
    getProjects(organizationId),
    getOrganizationScans(organizationId).catch(() => null),
  ]);
  const workspaces = await Promise.all(
    projects.map(async (project) => {
      const environments = await getEnvironments(
        organizationId,
        project.id,
      ).catch(() => null);
      const projectScans =
        scans?.filter((scan) => scan.environment.project.id === project.id) ??
        [];
      const latest = projectScans[0];
      const selected =
        environments?.find((e) => e.id === latest?.environment.id) ??
        environments?.[0];
      const completed = projectScans.find(
        (scan) =>
          scan.status === "COMPLETED" && scan.environment.id === selected?.id,
      );
      const detail = completed
        ? await getOrganizationScan(organizationId, completed.id).catch(
            () => null,
          )
        : null;
      return { project, environments, selected, latest, completed, detail };
    }),
  );
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-2 text-sm text-slate-500">
            Applications monitored by ReactPulse.
          </p>
        </div>
        <CreateProjectButton organizationId={organizationId} />
      </header>
      {!projects.length ? (
        <section className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <FolderKanban
            className="mx-auto text-blue-600"
            size={26}
            aria-hidden="true"
          />
          <h2 className="mt-4 text-lg font-semibold">No projects yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            Add your first React application to begin collecting performance and
            network evidence, with passive security reporting to follow.
          </p>
          <div className="mt-5 flex justify-center">
            <CreateProjectButton organizationId={organizationId} />
          </div>
        </section>
      ) : (
        <div className="space-y-3">
          {workspaces.map(
            ({
              project,
              environments,
              selected,
              latest,
              completed,
              detail,
            }) => (
              <article
                key={project.id}
                className="rounded-lg border border-slate-200 bg-white px-4 py-3 sm:px-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-sm font-semibold text-blue-700"
                    >
                      {project.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <Link
                        href={`/projects/${project.id}`}
                        className="break-words text-base font-semibold text-slate-900 hover:text-blue-700"
                      >
                        {project.name}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {selected
                          ? hostname(selected.url)
                          : environments === null
                            ? "Environments unavailable"
                            : "No environment configured"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {project.status === "ARCHIVED" && <Badge>Archived</Badge>}
                    {latest && <ScanStatusBadge status={latest.status} />}
                    <Link
                      href={`/projects/${project.id}${selected ? `?environmentId=${encodeURIComponent(selected.id)}` : ""}`}
                      className="text-xs font-medium text-blue-700"
                    >
                      Open →
                    </Link>
                  </div>
                </div>
                <div className="mt-2 grid gap-3 sm:grid-cols-[minmax(0,1fr)_2fr]">
                  <div>
                    <p className="text-[11px] text-slate-500">
                      Last scan · {selected?.name ?? "No environment"}
                    </p>
                    <p className="mt-1 text-xs font-medium">
                      {scans === null
                        ? "Scan history unavailable"
                        : latest
                          ? scanDate(latest.createdAt)
                          : "Not scanned yet"}
                    </p>
                    {completed && latest?.id !== completed.id && (
                      <p className="mt-1 text-[10px] text-slate-500">
                        Metrics:{" "}
                        {scanDate(completed.completedAt ?? completed.createdAt)}
                      </p>
                    )}
                  </div>
                  <ScanAnalytics compact metrics={detail?.metrics} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
                  {environments?.map((environment) => (
                    <Link
                      key={environment.id}
                      href={`/projects/${project.id}?environmentId=${encodeURIComponent(environment.id)}`}
                      aria-label={`Open ${environment.name} environment for ${project.name}`}
                      className={`rounded px-2 py-1 text-[11px] ${environment.id === selected?.id ? "bg-blue-50 font-medium text-blue-700" : "text-slate-500 hover:bg-slate-50"}`}
                    >
                      {environment.name}
                      {environment.id === selected?.id ? " · shown" : ""}
                    </Link>
                  ))}
                  {!completed && (
                    <span className="text-[11px] text-slate-500">
                      {scans === null
                        ? "Analysis unavailable"
                        : "No completed scan"}
                    </span>
                  )}
                  {completed && !detail && (
                    <span className="text-[11px] text-slate-500">
                      Measurements unavailable
                    </span>
                  )}
                </div>
              </article>
            ),
          )}
        </div>
      )}
    </div>
  );
}
function hostname(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return "Hostname unavailable";
  }
}
