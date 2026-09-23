import "server-only";

import { ApiError } from "./api-error";

const API_URL = process.env.API_URL;

if (!API_URL) {
  throw new Error("API_URL is not configured");
}

interface ServerApiRequestOptions extends RequestInit {
  accessToken?: string;
}

export async function serverApiRequest<T>(
  path: string,
  options: ServerApiRequestOptions = {},
): Promise<T> {
  const { accessToken, headers, ...requestOptions } = options;

  const requestHeaders = new Headers(headers);

  requestHeaders.set("Accept", "application/json");

  if (requestOptions.body && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (accessToken) {
    requestHeaders.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...requestOptions,

    headers: requestHeaders,

    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await readJsonSafely(response);

    throw new ApiError(
      response.status,

      extractErrorMessage(payload),

      payload,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function readJsonSafely(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function extractErrorMessage(payload: unknown): string {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("message" in payload)
  ) {
    return "Request failed";
  }

  const message = (
    payload as {
      message?: unknown;
    }
  ).message;

  if (typeof message === "string") {
    return message;
  }

  if (Array.isArray(message)) {
    return message
      .filter((value): value is string => typeof value === "string")
      .join(", ");
  }

  return "Request failed";
}
