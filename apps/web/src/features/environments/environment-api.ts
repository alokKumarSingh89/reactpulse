import "server-only";

import type { Environment } from "./environment.types";

import { authenticatedApiRequest } from "@/lib/api/authenticated-api";

export async function getEnvironments(
  organizationId: string,
  projectId: string,
): Promise<Environment[]> {
  return authenticatedApiRequest<Environment[]>(
    `/organizations/${organizationId}/projects/${projectId}/environments`,
  );
}
