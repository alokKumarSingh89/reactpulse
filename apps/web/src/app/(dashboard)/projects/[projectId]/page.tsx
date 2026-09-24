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
  params: Promise<{
    projectId: string;
  }>;
}

export default async function ProjectPage({ params }: ProjectPageProps) {
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

  return (
    <div className="space-y-8">
      <Link
        href="/projects"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-950"
      >
        <ArrowLeft size={15} />
        Projects
      </Link>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex items-start gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <FolderKanban size={20} />
          </div>

          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                {project.name}
              </h1>

              <Badge>{project.status}</Badge>
              <ProjectActions
                organizationId={organizationId}
                project={project}
              />
            </div>

            <p className="mt-1 text-sm text-slate-500">{project.slug}</p>
          </div>
        </div>
      </div>

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
          <div className="grid gap-4 xl:grid-cols-2">
            {environments.map((environment) => (
              <EnvironmentCard
                key={environment.id}
                organizationId={organizationId}
                projectId={project.id}
                environment={environment}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
