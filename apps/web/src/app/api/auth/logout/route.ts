import { NextResponse } from "next/server";

import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME } from "@/features/auth/auth-cookie";

import { serverApiRequest } from "@/lib/api/server-api-client";

export async function POST(request: Request) {
  const cookieStore = await cookies();

  const accessToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (accessToken) {
    try {
      await serverApiRequest("/auth/logout", {
        method: "POST",
        accessToken,
      });
    } catch {
      /*
       * Always clear the browser credential.
       *
       * The backend session may already be
       * expired/revoked or temporarily
       * unavailable.
       */
    }
  }

  const loginUrl = new URL("/login", request.url);

  const response = NextResponse.redirect(loginUrl, {
    status: 303,
  });

  response.cookies.set({
    name: AUTH_COOKIE_NAME,

    value: "",

    httpOnly: true,

    secure: process.env.NODE_ENV === "production",

    sameSite: "lax",

    path: "/",

    expires: new Date(0),

    maxAge: 0,
  });

  return response;
}
