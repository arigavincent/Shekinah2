import { apiRequest } from "./client";
import { getToken } from "../auth/session";

export type Sermon = {
  id: string;
  externalId: string;
  type: "video" | "audio";
  title: string;
  speaker: string;
  sermonDate: string;
  publishedAt: string;
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
  externalId?: string;
  type: "video" | "audio";
  title: string;
  speaker: string;
  sermonDate: string;
  publishedAt: string;
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

export function importSermons(csv: string) {
  return apiRequest<{ result: SermonImportResult }>(
    "/api/v1/admin/sermons/import",
    {
      method: "POST",
      token: adminToken(),
      body: { csv }
    }
  );
}

export function previewSermonImport(csv: string) {
  return apiRequest<{ preview: SermonImportPreview }>("/api/v1/admin/sermons/import/preview", {
    method: "POST",
    token: adminToken(),
    body: { csv }
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
export type ImportPreviewRow = {
  rowNumber: number;
  externalId: string;
  title: string;
  action: "create" | "update" | "reject";
  existingId?: string;
  publishedAt?: string;
  errors?: string[];
};

export type SermonImportPreview = {
  rows: ImportPreviewRow[];
  creates: number;
  updates: number;
  rejected: number;
};

export type SermonImportResult = {
  created: Sermon[];
  updated: Sermon[];
  rejected: { rowNumber: number; externalId?: string; title?: string; error: string }[];
};
