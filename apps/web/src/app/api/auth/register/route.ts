import { NextResponse } from "next/server";

import {
  AUTH_COOKIE_MAX_AGE,
  AUTH_COOKIE_NAME,
} from "@/features/auth/auth-cookie";

import type { AuthResponse, RegisterRequest } from "@/features/auth/auth.types";

import { ApiError } from "@/lib/api/api-error";

import { serverApiRequest } from "@/lib/api/server-api-client";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterRequest;

    const result = await serverApiRequest<AuthResponse>("/auth/register", {
      method: "POST",

      body: JSON.stringify(body),
    });

    const response = NextResponse.json(
      {
        user: result.user,
      },
      {
        status: 201,
      },
    );

    response.cookies.set({
      name: AUTH_COOKIE_NAME,

      value: result.accessToken,

      httpOnly: true,

      secure: process.env.NODE_ENV === "production",

      sameSite: "lax",

      path: "/",

      maxAge: AUTH_COOKIE_MAX_AGE,
    });

    return response;
  } catch (error) {
    return handleAuthError(error);
  }
}

function handleAuthError(error: unknown) {
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
      message: "Unable to create account",
    },
    {
      status: 500,
    },
  );
}
