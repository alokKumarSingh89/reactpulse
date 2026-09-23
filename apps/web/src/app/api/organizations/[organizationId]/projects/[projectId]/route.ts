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
    const project = await authenticatedApiRequest(
      `/organizations/${organizationId}/projects/${projectId}`,
    );

    return NextResponse.json(project);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { organizationId, projectId } = await context.params;

  try {
    const body = await request.json();

    const project = await authenticatedApiRequest(
      `/organizations/${organizationId}/projects/${projectId}`,
      {
        method: "PATCH",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(body),
      },
    );

    return NextResponse.json(project);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { organizationId, projectId } = await context.params;

  try {
    await authenticatedApiRequest(
      `/organizations/${organizationId}/projects/${projectId}`,
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
