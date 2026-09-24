import type { OrganizationMembership } from "@/features/auth/auth.types";

export function canManageProjects(membership: OrganizationMembership): boolean {
  return ["OWNER", "ADMIN", "DEVELOPER"].includes(membership.role);
}

export function canDeleteProjects(membership: OrganizationMembership): boolean {
  return ["OWNER", "ADMIN"].includes(membership.role);
}
