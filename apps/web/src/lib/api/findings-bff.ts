import "server-only";
import { NextResponse } from "next/server";
import { isFindingUuid, projectFindingListQuery, type FindingLifecycleAction } from "@reactpulse/contracts";
import type { CurrentUser } from "@/features/auth/auth.types";
import { getActiveOrganization } from "@/features/organizations/get-active-organization";
import { authenticatedApiRequest } from "./authenticated-api";
import { ApiError } from "./api-error";
import { projectFindingResponse, projectFindingListResponse, validFindingCursor } from "./findings";
const messages = {
  400: "Invalid findings request", 401: "Authentication required",
  403: "Finding access denied", 404: "Finding not found",
  409: "Finding action or data conflicts with current state", 502: "Unable to load findings",
} as const;
function failure(status: keyof typeof messages) {
  return NextResponse.json({ message: messages[status] }, { status, headers: { "Cache-Control": "no-store" } });
}
async function endpoint() {
  const user = await authenticatedApiRequest<CurrentUser>("/auth/me");
  const membership = getActiveOrganization(user);
  if (!membership) throw new ApiError(403, messages[403]);
  return `/organizations/${encodeURIComponent(membership.organization.id)}/findings`;
}
function errorResponse(error: unknown) {
  if (error instanceof ApiError && (error.status === 400 || error.status === 401 || error.status === 403 || error.status === 404 || error.status === 409)) return failure(error.status);
  return failure(502);
}
export async function findingsList(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const raw: Record<string, string> = {};
    for (const [key, value] of params) {
      if (Object.hasOwn(raw, key)) return failure(400);
      Object.defineProperty(raw, key, { value, enumerable: true });
    }
    const query = projectFindingListQuery(raw);
    if (!query || (query.cursor && !validFindingCursor(query.cursor))) return failure(400);
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) search.set(key, String(value));
    const response = await authenticatedApiRequest<unknown>(`${await endpoint()}?${search}`);
    const safe = projectFindingListResponse(response, query.limit);
    if (!safe) return failure(502);
    return NextResponse.json(safe, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
export async function findingRequest(request: Request, findingId: string, action?: FindingLifecycleAction) {
  try {
    if (!isFindingUuid(findingId) || new URL(request.url).search) return failure(400);
    if (action) {
      // Cookie-authenticated mutation: require the browser's exact Origin, not
      // merely a same-site subdomain or attacker-supplied forwarding headers.
      if (request.headers.get('origin') !== new URL(request.url).origin ||
          (request.headers.get('sec-fetch-site') && request.headers.get('sec-fetch-site') !== 'same-origin')) return failure(403);
      if (request.body !== null) return failure(400);
    }
    const response = await authenticatedApiRequest<unknown>(`${await endpoint()}/${encodeURIComponent(findingId)}${action ? '/'+action : ''}`, action ? { method: 'POST' } : {});
    const safe = projectFindingResponse(response);
    if (!safe || safe.id !== findingId) return failure(502);
    return NextResponse.json(safe, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
