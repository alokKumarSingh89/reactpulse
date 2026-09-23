import "server-only";

import type { Project } from "./project.types";

import { authenticatedApiRequest } from "@/lib/api/authenticated-api";

export async function getProjects(organizationId: string): Promise<Project[]> {
  return authenticatedApiRequest<Project[]>(
    `/organizations/${organizationId}/projects`,
  );
}

export async function getProject(
  organizationId: string,
  projectId: string,
): Promise<Project> {
  return authenticatedApiRequest<Project>(
    `/organizations/${organizationId}/projects/${projectId}`,
  );
}
