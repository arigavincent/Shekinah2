import { apiRequest } from "./client";
import { getToken } from "../auth/session";

export type Sermon = {
  id: string;
  type: "video" | "audio";
  title: string;
  speaker: string;
  sermonDate: string;
  categoryId: string;
  category: string;
  isLive: boolean;
  thumbnailUrl: string;
  duration: string;
  description: string;
  mediaUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type SermonPayload = {
  type: "video" | "audio";
  title: string;
  speaker: string;
  sermonDate: string;
  categoryId: string;
  isLive: boolean;
  thumbnailUrl: string;
  duration: string;
  description: string;
  mediaUrl: string;
};

function adminToken() {
  const token = getToken();

  if (!token) {
    throw new Error("Admin login required");
  }

  return token;
}

export function listSermons() {
  return apiRequest<{ sermons: Sermon[] }>("/api/v1/admin/sermons", {
    token: adminToken()
  });
}

export function createSermon(payload: SermonPayload) {
  return apiRequest<{ sermon: Sermon }>("/api/v1/admin/sermons", {
    method: "POST",
    token: adminToken(),
    body: payload
  });
}

export function updateSermon(id: string, payload: Partial<SermonPayload>) {
  return apiRequest<{ sermon: Sermon }>(`/api/v1/admin/sermons/${id}`, {
    method: "PATCH",
    token: adminToken(),
    body: payload
  });
}

export function deleteSermon(id: string) {
  return apiRequest<null>(`/api/v1/admin/sermons/${id}`, {
    method: "DELETE",
    token: adminToken()
  });
}
