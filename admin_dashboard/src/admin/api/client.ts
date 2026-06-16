import { proxyAdminApiRequest } from "./proxy.functions";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://shekinah-sons-backend.onrender.com";

export class ApiError extends Error {
  status?: number;
  payload?: unknown;

  constructor(message: string, status?: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

type RequestOptions = {
  method?: string;
  token?: string | null;
  body?: unknown;
};

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  if (API_BASE_URL === "https://shekinah-sons-backend.onrender.com") {
    const result = await proxyAdminApiRequest({
      data: {
        path,
        method: options.method || "GET",
        token: options.token,
        body: options.body,
      },
    });

    if (!result.ok) {
      const payload = result.payload as { message?: string } | null;
      throw new ApiError(payload?.message || "Request failed", result.status, result.payload);
    }

    return result.payload as T;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(
      payload?.message || "Request failed",
      response.status,
      payload
    );
  }

  return payload as T;
}
