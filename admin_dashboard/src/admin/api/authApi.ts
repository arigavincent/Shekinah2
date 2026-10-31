import { apiRequest } from "./client";
import type { AdminUser } from "../auth/session";

type LoginResponse = {
  token: string;
  user: AdminUser;
  // Two-step sign-in: no session yet, exchange the ticket and a code.
  mfaRequired?: boolean;
  mfaToken?: string;
};

type MeResponse = {
  user: AdminUser;
};

export function login(email: string, password: string) {
  return apiRequest<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: { email, password }
  });
}

export function me(token: string) {
  return apiRequest<MeResponse>("/api/v1/auth/me", {
    token
  });
}

export function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string
) {
  return apiRequest<LoginResponse>("/api/v1/auth/password", {
    method: "PATCH",
    token,
    body: { currentPassword, newPassword }
  });
}

export function verifyCode(mfaToken: string, code: string) {
  return apiRequest<LoginResponse>("/api/v1/auth/mfa/verify", {
    method: "POST",
    body: { mfaToken, code }
  });
}
