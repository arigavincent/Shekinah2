import { request } from "./client";

export async function registerUser({ name, email, password }) {
  return request("/api/v1/auth/register", {
    method: "POST",
    body: {
      name,
      email,
      password
    }
  });
}

export async function loginUser({ email, password }) {
  return request("/api/v1/auth/login", {
    method: "POST",
    body: {
      email,
      password
    }
  });
}

export async function getCurrentUser(token) {
  return request("/api/v1/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}
