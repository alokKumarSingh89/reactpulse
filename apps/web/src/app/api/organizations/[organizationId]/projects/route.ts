import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/api-error";

import { authenticatedApiRequest } from "@/lib/api/authenticated-api";

interface RouteContext {
  params: Promise<{
    organizationId: string;
  }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { organizationId } = await context.params;

  try {
    const projects = await authenticatedApiRequest(
      `/organizations/${organizationId}/projects`,
    );

    return NextResponse.json(projects);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { organizationId } = await context.params;

  try {
    const body = await request.json();

    const project = await authenticatedApiRequest(
      `/organizations/${organizationId}/projects`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(body),
      },
    );

    return NextResponse.json(project, {
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
