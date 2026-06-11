import { API_CONFIG } from "../config/apiConfig";
import { getAuthToken } from "../storage/authTokenStorage";

class ApiError extends Error {
  constructor(message, { status, payload } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function parseResponse(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError("Invalid JSON response", {
      status: response.status,
      payload: text
    });
  }
}

export async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);

  try {
    const response = await fetch(`${API_CONFIG.baseUrl}${path}`, {
      method: options.method || "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });

    const payload = await parseResponse(response);

    if (!response.ok) {
      throw new ApiError(payload?.message || "Request failed", {
        status: response.status,
        payload
      });
    }

    return payload;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new ApiError("Request timed out");
    }

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(error.message || "Network request failed");
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestWithAuth(path, options = {}) {
  const token = options.token || (await getAuthToken());

  if (!token) {
    throw new ApiError("Sign in is required", {
      status: 401
    });
  }

  return request(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    }
  });
}

export { ApiError };
