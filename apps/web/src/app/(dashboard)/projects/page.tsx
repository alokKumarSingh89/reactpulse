import { FolderKanban, Globe2 } from "lucide-react";

import Link from "next/link";

import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";

import { Card } from "@/components/ui/card";

import { CreateProjectButton } from "@/features/projects/create-project-button";

import { getProjects } from "@/features/projects/project-api";

import { getActiveOrganization } from "@/features/organizations/get-active-organization";

import { getCurrentUser } from "@/features/auth/get-current-user";

export default async function ProjectsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const membership = getActiveOrganization(user);

  if (!membership) {
    return <div>No organization membership found.</div>;
  }

  const { organization } = membership;

  const projects = await getProjects(organization.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            Projects
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Applications monitored by ReactPulse.
          </p>
        </div>

        <CreateProjectButton organizationId={organization.id} />
      </div>

      {projects.length === 0 ? (
        <EmptyProjects organizationId={organization.id} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="h-full p-5 transition hover:border-slate-300 hover:shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                    <FolderKanban size={19} />
                  </div>

                  <Badge>{project.status}</Badge>
                </div>

                <h2 className="mt-5 font-semibold text-slate-950">
                  {project.name}
                </h2>

                <p className="mt-1 text-sm text-slate-500">{project.slug}</p>

                <div className="mt-5 flex items-center gap-2 text-xs text-slate-500">
                  <Globe2 size={14} />
                  Manage environments
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyProjects({ organizationId }: { organizationId: string }) {
  return (
    <div className="flex min-h-96 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
        <FolderKanban size={22} />
      </div>

      <h2 className="mt-4 font-semibold text-slate-950">
        Create your first project
      </h2>

      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
        A project represents an application that ReactPulse will monitor and
        analyze.
      </p>

      <div className="mt-5">
        <CreateProjectButton organizationId={organizationId} />
      </div>
    </div>
  );
}
