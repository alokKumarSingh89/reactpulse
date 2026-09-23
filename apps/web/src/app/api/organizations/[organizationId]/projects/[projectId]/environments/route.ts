import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/api-error";

import { authenticatedApiRequest } from "@/lib/api/authenticated-api";

interface RouteContext {
  params: Promise<{
    organizationId: string;
    projectId: string;
  }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { organizationId, projectId } = await context.params;

  try {
    const environments = await authenticatedApiRequest(
      `/organizations/${organizationId}/projects/${projectId}/environments`,
    );

    return NextResponse.json(environments);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { organizationId, projectId } = await context.params;

  try {
    const body = await request.json();

    const environment = await authenticatedApiRequest(
      `/organizations/${organizationId}/projects/${projectId}/environments`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(body),
      },
    );

    return NextResponse.json(environment, {
      status: 201,
    });
  } catch (error) {
    return handleApiError(error);
  }
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
