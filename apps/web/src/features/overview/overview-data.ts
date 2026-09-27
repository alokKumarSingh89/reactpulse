import "server-only";
import { cache } from "react";
import { getProjects } from "@/features/projects/project-api";
import { getOrganizationScans } from "@/features/scans/scan-api";

// Request-scoped deduplication for the shell and Overview; never a tenant cache.
export const getOverviewContext = cache(async (organizationId: string) => {
  const [projects, scans] = await Promise.allSettled([
    getProjects(organizationId),
    getOrganizationScans(organizationId),
  ]);
  return {
    projects: projects.status === "fulfilled" ? projects.value : [],
    scans:
      scans.status === "fulfilled"
        ? [...scans.value].sort(
            (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
          )
        : [],
    projectsUnavailable: projects.status === "rejected",
    scansUnavailable: scans.status === "rejected",
  };
});
