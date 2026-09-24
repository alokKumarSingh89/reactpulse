import { NextResponse } from "next/server";

import { authenticatedApiRequest } from "@/lib/api/authenticated-api";

import { ApiError } from "@/lib/api/api-error";

interface RouteContext {
  params: Promise<{
    organizationId: string;

    scanId: string;
  }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { organizationId, scanId } = await context.params;

  try {
    const result = await authenticatedApiRequest(
      `/organizations/${organizationId}/scans/${scanId}/network`,
    );

    return NextResponse.json(result);
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
        message: "Unable to load network analysis",
      },

      {
        status: 500,
      },
    );
  }
}
