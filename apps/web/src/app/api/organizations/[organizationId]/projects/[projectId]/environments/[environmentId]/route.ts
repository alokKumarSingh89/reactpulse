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

export async function PATCH(request: Request, context: RouteContext) {
  const { organizationId, projectId, environmentId } = await context.params;

  try {
    const body = await request.json();

    const environment = await authenticatedApiRequest(
      `/organizations/${organizationId}/projects/${projectId}/environments/${environmentId}`,
      {
        method: "PATCH",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(body),
      },
    );

    return NextResponse.json(environment);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { organizationId, projectId, environmentId } = await context.params;

  try {
    await authenticatedApiRequest(
      `/organizations/${organizationId}/projects/${projectId}/environments/${environmentId}`,
      {
        method: "DELETE",
      },
    );

    return new NextResponse(null, {
      status: 204,
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
