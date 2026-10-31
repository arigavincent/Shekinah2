import { apiRequest } from "./client";
import { getToken } from "../auth/session";

export type SermonSource = "manual" | "cloudflare_stream" | "live_recording" | "podcast";
export type SermonStatus = "processing" | "ready" | "error";

export type Sermon = {
 isPublished:boolean;notifyOnPublish:boolean;
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
 isPublished?:boolean;notifyOnPublish?:boolean;
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

export function getStorageStatus() {
  return apiRequest<{ r2: boolean; stream: boolean }>("/api/v1/admin/sermons/storage", {
    token: adminToken()
  });
}

export type DirectUpload = {
  uploadUrl: string;
  publicUrl: string;
  objectKey: string;
  contentType: string;
  expiresAt: string;
};

export function startDirectUpload(kind: "video" | "audio" | "image", file: File) {
  return apiRequest<DirectUpload>("/api/v1/admin/sermons/direct-upload", {
    method: "POST",
    token: adminToken(),
    body: { kind, fileName: file.name, sizeBytes: file.size }
  });
}

// PUTs the file straight to R2 with the presigned URL, reporting progress.
export function putFileToStorage(upload: DirectUpload, file: File, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", upload.uploadUrl);
    request.setRequestHeader("Content-Type", upload.contentType);
    request.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error(`Storage rejected the upload (${request.status}).`));
    request.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    request.send(file);
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

export type SermonCategory = {
  id: string;
  name: string;
  imageUrl: string;
  sermonCount: number;
};

export function listSermonCategories() {
  return apiRequest<{ categories: SermonCategory[] }>("/api/v1/admin/sermon-categories", {
    token: adminToken()
  });
}

export function createSermonCategory(name: string, imageUrl = "") {
  return apiRequest<{ category: SermonCategory }>("/api/v1/admin/sermon-categories", {
    method: "POST",
    token: adminToken(),
    body: { name, imageUrl }
  });
}

export function updateSermonCategory(id: string, patch: { name?: string; imageUrl?: string }) {
  return apiRequest<{ category: SermonCategory }>(`/api/v1/admin/sermon-categories/${id}`, {
    method: "PATCH",
    token: adminToken(),
    body: patch
  });
}

export function deleteSermonCategory(id: string) {
  return apiRequest<null>(`/api/v1/admin/sermon-categories/${id}`, {
    method: "DELETE",
    token: adminToken()
  });
}
