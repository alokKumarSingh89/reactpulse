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
    const scans = await authenticatedApiRequest(
      `/organizations/${organizationId}/scans`,
    );

    return NextResponse.json(scans);
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
        message: "Unable to load scans",
      },
      {
        status: 500,
      },
    );
  }
}
