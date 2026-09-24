import type {
  CurrentUser,
  OrganizationMembership,
} from "@/features/auth/auth.types";

export function getActiveOrganization(
  user: CurrentUser,
): OrganizationMembership | null {
  return user.memberships[0] ?? null;
}
