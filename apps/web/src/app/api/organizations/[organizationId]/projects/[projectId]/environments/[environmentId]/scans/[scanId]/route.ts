import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/api-error";

import { authenticatedApiRequest } from "@/lib/api/authenticated-api";

interface RouteContext {
  params: Promise<{
    organizationId: string;
    projectId: string;
    environmentId: string;
    scanId: string;
  }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { organizationId, projectId, environmentId, scanId } =
    await context.params;

  try {
    const scan = await authenticatedApiRequest(
      `/organizations/${organizationId}` +
        `/projects/${projectId}` +
        `/environments/${environmentId}` +
        `/scans/${scanId}`,
    );

    return NextResponse.json(scan);
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        {
          message: error.message,
        },
        {
          status: error.status,
        },
      );
    }

    return NextResponse.json(
      {
        message: "Unexpected server error",
      },
      {
        status: 500,
      },
    );
  }
}
