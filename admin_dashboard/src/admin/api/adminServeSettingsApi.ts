import { apiRequest } from "./client";
import { getToken } from "../auth/session";

export type ServeSettings = {
  whatsappNumber: string;
};

function adminToken() {
  const token = getToken();

  if (!token) {
    throw new Error("Admin login required");
  }

  return token;
}

export function getServeSettings() {
  return apiRequest<{ serve: ServeSettings }>("/api/v1/admin/settings/serve", {
    token: adminToken()
  });
}

export function updateServeSettings(payload: Partial<ServeSettings>) {
  return apiRequest<{ serve: ServeSettings }>("/api/v1/admin/settings/serve", {
    method: "PATCH",
    token: adminToken(),
    body: payload
  });
}
