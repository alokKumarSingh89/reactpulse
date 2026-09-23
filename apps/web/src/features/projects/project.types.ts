export type ProjectStatus = "ACTIVE" | "ARCHIVED";

export interface Project {
  id: string;

  organizationId: string;

  name: string;
  slug: string;

  status: ProjectStatus;

  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  name: string;
  slug: string;
}

export interface UpdateProjectRequest {
  name?: string;

  status?: ProjectStatus;
}
