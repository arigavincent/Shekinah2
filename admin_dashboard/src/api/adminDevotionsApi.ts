import { apiRequest } from "./client";
import { getToken } from "../auth/session";

export type Devotion = {
  id: string;
  title: string;
  excerpt: string;
  devotionDate: string;
  publishedAt: string;
  imageUrl: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type DevotionPayload = {
  title: string;
  excerpt: string;
  devotionDate: string;
  publishedAt: string;
  imageUrl: string;
  body: string;
};

function adminToken() {
  const token = getToken();

  if (!token) {
    throw new Error("Admin login required");
  }

  return token;
}

export function listDevotions() {
  return apiRequest<{ devotions: Devotion[] }>("/api/v1/admin/devotions", {
    token: adminToken()
  });
}

export function createDevotion(payload: DevotionPayload) {
  return apiRequest<{ devotion: Devotion }>("/api/v1/admin/devotions", {
    method: "POST",
    token: adminToken(),
    body: payload
  });
}

export function importDevotions(csv: string) {
  return apiRequest<{ result: { imported: Devotion[]; rejected: { rowNumber: number; error: string }[] } }>(
    "/api/v1/admin/devotions/import",
    {
      method: "POST",
      token: adminToken(),
      body: { csv }
    }
  );
}

export function updateDevotion(id: string, payload: Partial<DevotionPayload>) {
  return apiRequest<{ devotion: Devotion }>(`/api/v1/admin/devotions/${id}`, {
    method: "PATCH",
    token: adminToken(),
    body: payload
  });
}

export function deleteDevotion(id: string) {
  return apiRequest<null>(`/api/v1/admin/devotions/${id}`, {
    method: "DELETE",
    token: adminToken()
  });
}
