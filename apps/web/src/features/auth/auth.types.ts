export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
}

export interface OrganizationMembership {
  role: "OWNER" | "ADMIN" | "DEVELOPER" | "VIEWER";

  organization: OrganizationSummary;
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;

  status: "ACTIVE" | "SUSPENDED";

  memberships: OrganizationMembership[];
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;

  organizationName: string;
  organizationSlug: string;
}
