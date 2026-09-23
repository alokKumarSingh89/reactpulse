import "server-only";

import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME } from "./auth-cookie";

import type { CurrentUser } from "./auth.types";

import { serverApiRequest } from "@/lib/api/server-api-client";

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();

  const accessToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!accessToken) {
    return null;
  }

  try {
    return await serverApiRequest<CurrentUser>("/auth/me", {
      accessToken,
    });
  } catch {
    return null;
  }
}
