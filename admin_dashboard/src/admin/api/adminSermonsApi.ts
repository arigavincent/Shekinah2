import { apiRequest } from "./client";
import { getToken } from "../auth/session";

export type SermonSource = "manual" | "cloudflare_stream" | "live_recording" | "podcast";
export type SermonStatus = "processing" | "ready" | "error";

export type Sermon = {
  id: string;
  externalId: string;
  type: "video" | "audio";
  code: string;
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
  source: SermonSource;
  streamUid: string;
  status: SermonStatus;
  createdAt: string;
  updatedAt: string;
};

export type SermonPayload = {
  externalId?: string;
  type: "video" | "audio";
  code: string;
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

export type StreamUploadRequest = {
  sizeBytes: number;
  fileName: string;
  code: string;
  title: string;
  speaker: string;
  sermonDate: string;
  publishedAt: string;
  categoryId: string;
  description: string;
};

// Reserves a Cloudflare Stream upload and creates the sermon as "processing".
export function startStreamUpload(payload: StreamUploadRequest) {
  return apiRequest<{ uploadUrl: string; sermon: Sermon }>("/api/v1/admin/sermons/stream-upload", {
    method: "POST",
    token: adminToken(),
    body: payload
  });
}

export type SermonSyncReport = {
  ready: number;
  failed: number;
  stillProcessing: number;
  recordingsAdded: number;
  podcastAdded: number;
  podcastUpdated: number;
  errors?: string[];
};

export function syncSermonMedia() {
  return apiRequest<{ report: SermonSyncReport }>("/api/v1/admin/sermons/sync", {
    method: "POST",
    token: adminToken()
  });
}

export function getPodcastSettings() {
  return apiRequest<{ feedUrl: string }>("/api/v1/admin/settings/podcast", {
    token: adminToken()
  });
}

export function updatePodcastSettings(feedUrl: string) {
  return apiRequest<{ feedUrl: string; episodes: number }>("/api/v1/admin/settings/podcast", {
    method: "PATCH",
    token: adminToken(),
    body: { feedUrl }
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
