import {
  getOrganizationScans,
  getOrganizationScan,
} from "@/features/scans/scan-api";
import { ScanAnalytics, scanDate } from "@/features/scans/scan-analytics";
import { RunScanButton } from "@/features/scans/run-scan-button";
import { ArrowLeft, FolderKanban, Globe2 } from "lucide-react";

import Link from "next/link";

import { notFound, redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";

import { getCurrentUser } from "@/features/auth/get-current-user";

import { CreateEnvironmentButton } from "@/features/environments/create-environment-button";

import { EnvironmentCard } from "@/features/environments/environment-card";

import { getEnvironments } from "@/features/environments/environment-api";

import { getActiveOrganization } from "@/features/organizations/get-active-organization";

import { getProject } from "@/features/projects/project-api";

import { ApiError } from "@/lib/api/api-error";
import { ProjectActions } from "@/features/projects/project-actions";

interface ProjectPageProps {
  searchParams: Promise<{ environmentId?: string }>;
  params: Promise<{
    projectId: string;
  }>;
}

export default async function ProjectPage({
  params,
  searchParams,
}: ProjectPageProps) {
  const { projectId } = await params;

  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const membership = getActiveOrganization(user);

  if (!membership) {
    notFound();
  }

  const organizationId = membership.organization.id;

  let project;

  try {
    project = await getProject(organizationId, projectId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }

  const environments = await getEnvironments(organizationId, project.id);

  const { environmentId } = await searchParams;
  const selected =
    environments.find((environment) => environment.id === environmentId) ??
    environments[0];
  const scans = await getOrganizationScans(organizationId).catch(() => null);
  const scoped =
    scans?.filter((scan) => scan.environment.id === selected?.id) ?? [];
  const latest = scoped[0];
  const completed = scoped.find((scan) => scan.status === "COMPLETED");
  const detail = completed
    ? await getOrganizationScan(organizationId, completed.id).catch(() => null)
    : null;

  return (
    <div className="space-y-5">
      <Link
        href="/projects"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-950"
      >
        <ArrowLeft size={15} />
        Projects
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
            <FolderKanban size={20} />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                {project.name}
              </h1>

              <Badge>{project.status}</Badge>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              {selected?.name ?? "No environment"} ·{" "}
              {scans === null
                ? "Scan history unavailable"
                : latest
                  ? `Last scan ${scanDate(latest.createdAt)}`
                  : "Not scanned yet"}
            </p>
          </div>
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">
              {selected?.name ?? "Deployment context"}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {completed
                ? `Latest completed measurements · ${scanDate(completed.completedAt ?? completed.createdAt)}`
                : "No completed scan"}
            </p>
          </div>
          {selected && (
            <RunScanButton
              organizationId={organizationId}
              projectId={project.id}
              environmentId={selected.id}
            />
          )}
        </div>
        <ScanAnalytics compact metrics={detail?.metrics} />
        {completed && (
          <div className="mt-3 flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-xs text-blue-700">
            <Link href={`/scans?scanId=${encodeURIComponent(completed.id)}`}>
              Scan details →
            </Link>
            <Link
              href={`/performance?scanId=${encodeURIComponent(completed.id)}`}
            >
              Performance →
            </Link>
            <Link href={`/network?scanId=${encodeURIComponent(completed.id)}`}>
              Network →
            </Link>
          </div>
        )}
      </section>
      <details className="text-sm">
        <summary className="w-fit cursor-pointer rounded text-xs text-slate-500">
          Project management
        </summary>
        <div className="mt-2">
          <ProjectActions organizationId={organizationId} project={project} />
        </div>
      </details>
      <section className="space-y-4">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Environments
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Deployed URLs ReactPulse can analyze.
            </p>
          </div>

          <CreateEnvironmentButton
            organizationId={organizationId}
            projectId={project.id}
          />
        </div>

        {environments.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <Globe2 size={22} />
            </div>

            <h3 className="mt-4 font-semibold text-slate-950">
              Add your first environment
            </h3>

            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
              Add a production, staging or development URL to begin analyzing
              your application.
            </p>

            <div className="mt-5">
              <CreateEnvironmentButton
                organizationId={organizationId}
                projectId={project.id}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {environments.map((environment) => (
              <EnvironmentCard
                key={environment.id}
                organizationId={organizationId}
                projectId={project.id}
                environment={environment}
                selected={environment.id === selected?.id}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
