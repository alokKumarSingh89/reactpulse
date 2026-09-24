import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/api-error";

import { authenticatedApiRequest } from "@/lib/api/authenticated-api";

interface RouteContext {
  params: Promise<{
    organizationId: string;
    projectId: string;
    environmentId: string;
  }>;
}

function handleApiError(error: unknown) {
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

export async function GET(_request: Request, context: RouteContext) {
  const { organizationId, projectId, environmentId } = await context.params;

  try {
    const scans = await authenticatedApiRequest(
      `/organizations/${organizationId}` +
        `/projects/${projectId}` +
        `/environments/${environmentId}` +
        "/scans",
    );

    return NextResponse.json(scans);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(_request: Request, context: RouteContext) {
  const { organizationId, projectId, environmentId } = await context.params;

  try {
    const scan = await authenticatedApiRequest(
      `/organizations/${organizationId}` +
        `/projects/${projectId}` +
        `/environments/${environmentId}` +
        "/scans",
      {
        method: "POST",
      },
    );

    return NextResponse.json(scan, {
      status: 202,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
