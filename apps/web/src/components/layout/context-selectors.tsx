"use client";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Project } from "@/features/projects/project.types";
import type { ScanSummary } from "@/features/scans/scan.types";
import type { Environment } from "@/features/environments/environment.types";

export function ContextSelectors({
  organizationId,
  projects,
  scans,
  unavailable,
}: {
  organizationId: string;
  projects: Project[];
  scans: ScanSummary[];
  unavailable: boolean;
}) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const scan = scans.find((s) => s.id === params.get("scanId"));
  const projectId =
    scan?.environment.project.id ??
    params.get("projectId") ??
    (pathname.startsWith("/projects/") ? pathname.split("/")[2] : "");
  const environmentId =
    scan?.environment.id ?? params.get("environmentId") ?? "";
  const [loaded, setLoaded] = useState<{
    projectId: string;
    environments: Environment[];
    error: boolean;
  } | null>(null);
  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();
    fetch(
      `/api/organizations/${encodeURIComponent(organizationId)}/projects/${encodeURIComponent(projectId)}/environments`,
      { signal: controller.signal, cache: "no-store" },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return (await response.json()) as Environment[];
      })
      .then((environments) =>
        setLoaded({ projectId, environments, error: false }),
      )
      .catch(() => {
        if (!controller.signal.aborted)
          setLoaded({ projectId, environments: [], error: true });
      });
    return () => controller.abort();
  }, [organizationId, projectId]);
  const ready = loaded?.projectId === projectId;
  const environments = ready ? loaded.environments : [];
  function change(project: string, environment = "") {
    const query = new URLSearchParams();
    if (project) query.set("projectId", project);
    if (environment) query.set("environmentId", environment);
    startTransition(() =>
      router.push(`/overview${query.size ? `?${query}` : ""}`),
    );
  }
  const selectClass =
    "h-9 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 disabled:opacity-60";
  return (
    <div
      className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:max-w-md"
      aria-busy={pending}
    >
      <label className="min-w-0">
        <span className="sr-only">Project — selecting opens Overview</span>
        <select
          className={selectClass}
          value={projectId}
          disabled={unavailable || pending}
          onChange={(e) => change(e.target.value)}
        >
          <option value="">
            {unavailable ? "Projects unavailable" : "All projects"}
          </option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>
      <label className="min-w-0">
        <span className="sr-only">Environment — selecting opens Overview</span>
        <select
          className={selectClass}
          value={ready ? environmentId : ""}
          disabled={!projectId || !ready || loaded?.error || pending}
          onChange={(e) => change(projectId, e.target.value)}
        >
          <option value="">
            {projectId && !ready
              ? "Loading environments…"
              : loaded?.error && ready
                ? "Environments unavailable"
                : "All environments"}
          </option>
          {environments.map((environment) => (
            <option key={environment.id} value={environment.id}>
              {environment.name}
            </option>
          ))}
        </select>
      </label>
      {pending && (
        <span role="status" className="sr-only">
          Loading Overview
        </span>
      )}
    </div>
  );
}
