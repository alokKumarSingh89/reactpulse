import { NextResponse } from "next/server";

import {
  AUTH_COOKIE_MAX_AGE,
  AUTH_COOKIE_NAME,
} from "@/features/auth/auth-cookie";

import type { AuthResponse, LoginRequest } from "@/features/auth/auth.types";

import { ApiError } from "@/lib/api/api-error";

import { serverApiRequest } from "@/lib/api/server-api-client";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginRequest;

    const result = await serverApiRequest<AuthResponse>("/auth/login", {
      method: "POST",

      body: JSON.stringify(body),
    });

    const response = NextResponse.json({
      user: result.user,
    });

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
        message: "Unable to sign in",
      },
      {
        status: 500,
      },
    );
  }
}
