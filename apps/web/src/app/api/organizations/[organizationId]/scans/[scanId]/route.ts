import { NextResponse } from "next/server";

import { ApiError } from "@/lib/api/api-error";

import { authenticatedApiRequest } from "@/lib/api/authenticated-api";

interface RouteContext {
  params: Promise<{
    organizationId: string;
    scanId: string;
  }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { organizationId, scanId } = await context.params;

  try {
    const scan = await authenticatedApiRequest(
      `/organizations/${organizationId}/scans/${scanId}`,
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
        message: "Unable to load scan",
      },
      {
        status: 500,
      },
    );
  }
}
