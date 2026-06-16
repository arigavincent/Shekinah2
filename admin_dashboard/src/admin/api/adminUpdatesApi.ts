import { apiRequest } from "./client";
import { getToken } from "../auth/session";

export type UpdateItem = {
  id: string;
  title: string;
  excerpt: string;
  updateDate: string;
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type UpdatePayload = {
  title: string;
  excerpt: string;
  updateDate: string;
  imageUrl: string;
};

function adminToken() {
  const token = getToken();

  if (!token) {
    throw new Error("Admin login required");
  }

  return token;
}

export function listUpdates() {
  return apiRequest<{ updates: UpdateItem[] }>("/api/v1/admin/updates", {
    token: adminToken()
  });
}

export function createUpdate(payload: UpdatePayload) {
  return apiRequest<{ update: UpdateItem }>("/api/v1/admin/updates", {
    method: "POST",
    token: adminToken(),
    body: payload
  });
}

export function updateUpdate(id: string, payload: Partial<UpdatePayload>) {
  return apiRequest<{ update: UpdateItem }>(`/api/v1/admin/updates/${id}`, {
    method: "PATCH",
    token: adminToken(),
    body: payload
  });
}

export function deleteUpdate(id: string) {
  return apiRequest<null>(`/api/v1/admin/updates/${id}`, {
    method: "DELETE",
    token: adminToken()
  });
}
