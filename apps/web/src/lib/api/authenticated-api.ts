import "server-only";

import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME } from "@/features/auth/auth-cookie";

import { ApiError } from "./api-error";

import { serverApiRequest } from "./server-api-client";

export async function authenticatedApiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const cookieStore = await cookies();

  const accessToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!accessToken) {
    throw new ApiError(401, "Authentication required");
  }

  return serverApiRequest<T>(path, {
    ...options,
    accessToken,
  });
}
