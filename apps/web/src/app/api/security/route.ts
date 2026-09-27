import { NextResponse } from "next/server";

import type { CurrentUser } from "@/features/auth/auth.types";
import { getActiveOrganization } from "@/features/organizations/get-active-organization";
import { authenticatedApiRequest } from "@/lib/api/authenticated-api";
import { ApiError } from "@/lib/api/api-error";

const messages = {
  400: "Invalid security report request",
  401: "Authentication required",
  403: "Security report access denied",
  404: "Scan not found",
  502: "Unable to load security report",
} as const;

function failure(status: keyof typeof messages) {
  return NextResponse.json(
    { message: messages[status] },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: Request) {
  const values = new URL(request.url).searchParams.getAll("scanId");
  const scanId = values[0];
  // Scan IDs are Prisma UUIDs. Reject path/query injection before interpolation.
  if (
    values.length !== 1 ||
    !scanId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scanId)
  ) {
    return failure(400);
  }

  try {
    // Unlike the page helper, preserve upstream failures instead of treating
    // every /auth/me failure as a missing session.
    const user = await authenticatedApiRequest<CurrentUser>("/auth/me");
    const membership = getActiveOrganization(user);
    if (!membership) return failure(403);

    const report = await authenticatedApiRequest<unknown>(
      `/organizations/${encodeURIComponent(membership.organization.id)}/scans/${encodeURIComponent(scanId)}/security`,
    );

    // The API owns the versioned safe projection. No security interpretation,
    // raw evidence loading or assessment-state normalization belongs here.
    if (
      !report || typeof report !== "object" ||
      !("scan" in report) || !("assessment" in report) ||
      !("observations" in report) || !("findings" in report) ||
      !Array.isArray(report.findings) ||
      !report.assessment || typeof report.assessment !== "object" ||
      !("state" in report.assessment) ||
      !["COMPLETE", "PARTIAL", "UNAVAILABLE", "NOT_ASSESSED"].includes(String(report.assessment.state))
    ) return failure(502);

    return NextResponse.json({
      scan: report.scan,
      assessment: report.assessment,
      observations: report.observations,
      findings: report.findings,
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      switch (error.status) {
        case 400:
        case 401:
        case 403:
        case 404:
          return failure(error.status);
      }
    }
    // Never forward ApiError.message/details, upstream bodies or request config.
    return failure(502);
  }
}
