export type EnvironmentType =
  "PRODUCTION" | "STAGING" | "PREVIEW" | "DEVELOPMENT" | "OTHER";

export interface Environment {
  id: string;

  projectId: string;

  name: string;
  url: string;

  type: EnvironmentType;

  createdAt: string;
  updatedAt: string;
}

export interface CreateEnvironmentRequest {
  name: string;
  url: string;

  type: EnvironmentType;
}

export interface UpdateEnvironmentRequest {
  name?: string;
  url?: string;

  type?: EnvironmentType;
}
