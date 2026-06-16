import { getToken } from "../auth/session";
import { API_BASE_URL } from "./client";

export type MediaKind = "image" | "video" | "audio" | "document";

export type UploadedMedia = {
  kind: MediaKind;
  path: string;
  url: string;
  name: string;
  size: number;
  provider?: string;
  resourceType?: string;
  format?: string;
};

function adminToken() {
  const token = getToken();
  if (!token) throw new Error("Admin login required");
  return token;
}

export type UploadProgress = {
  loaded: number;
  total: number;
  /** 0-100, or -1 if unknown */
  percent: number;
};

type AnyRecord = Record<string, unknown>;

function pickString(obj: AnyRecord | undefined | null, ...keys: string[]): string {
  if (!obj) return "";
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return "";
}

function pickNumber(obj: AnyRecord | undefined | null, ...keys: string[]): number {
  if (!obj) return 0;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return 0;
}

function inferProviderFromUrl(value: string): string {
  const lower = value.toLowerCase();

  if (lower.includes(".r2.dev") || lower.includes(".r2.cloudflarestorage.com")) {
    return "r2";
  }

  if (lower.includes("res.cloudinary.com")) {
    return "cloudinary";
  }

  if (lower.includes("/uploads/media/")) {
    return "local";
  }

  return "";
}

function mediaProvider(obj: AnyRecord | undefined | null, url: string, path: string): string {
  return pickString(obj, "provider") || inferProviderFromUrl(url || path);
}

function isMediaCandidate(value: unknown): value is AnyRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as AnyRecord;
  return [
    "secure_url",
    "url",
    "path",
    "public_id",
    "provider",
    "resource_type",
    "resourceType",
    "bytes",
    "size"
  ].some(key => typeof record[key] !== "undefined");
}

function findDeepMediaCandidate(value: unknown, seen = new Set<unknown>()): AnyRecord | null {
  if (!value || typeof value !== "object" || seen.has(value)) return null;
  seen.add(value);

  if (isMediaCandidate(value)) return value as AnyRecord;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findDeepMediaCandidate(item, seen);
      if (found) return found;
    }
    return null;
  }

  for (const nested of Object.values(value as AnyRecord)) {
    const found = findDeepMediaCandidate(nested, seen);
    if (found) return found;
  }

  return null;
}

function findMediaLikeString(value: unknown, seen = new Set<unknown>()): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^https?:\/\/\S+$/i.test(trimmed) || /^\/uploads\/\S+$/i.test(trimmed)) {
      return trimmed;
    }
    return "";
  }

  if (!value || typeof value !== "object" || seen.has(value)) return "";
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findMediaLikeString(item, seen);
      if (found) return found;
    }
    return "";
  }

  const record = value as AnyRecord;
  for (const nested of Object.values(record)) {
    const found = findMediaLikeString(nested, seen);
    if (found) return found;
  }
  return "";
}

/**
 * Normalize a media upload response. Supports several shapes our backend
 * (and Cloudinary, directly or wrapped) might return:
 *   { media: { url, path, ... } }
 *   { data: { url|secure_url, public_id, bytes, ... } }
 *   { url|secure_url, public_id, bytes, ... }
 */
function normalizeMediaResponse(
  payload: unknown,
  kind: MediaKind,
  file: File
): UploadedMedia | null {
  if (typeof payload === "string") {
    const extracted = findMediaLikeString(payload);
    if (extracted) {
      return {
        kind,
        path: extracted,
        url: extracted,
        name: file.name,
        size: file.size || 0,
      provider: inferProviderFromUrl(extracted),
        provider: inferProviderFromUrl(extracted)
      };
    }
  }

  if (!payload || typeof payload !== "object") return null;
  const root = payload as AnyRecord;

  const candidates: AnyRecord[] = [];
  if (root.media && typeof root.media === "object") candidates.push(root.media as AnyRecord);
  if (root.data && typeof root.data === "object") candidates.push(root.data as AnyRecord);
  if (root.result && typeof root.result === "object") candidates.push(root.result as AnyRecord);
  if (root.asset && typeof root.asset === "object") candidates.push(root.asset as AnyRecord);
  candidates.push(root);

  const deepCandidate = findDeepMediaCandidate(root);
  if (deepCandidate) candidates.unshift(deepCandidate);

  for (const c of candidates) {
    const url = pickString(c, "secure_url", "url", "Location", "location", "src");
    const path = pickString(c, "path", "public_id", "key", "id") || url;
    if (!url && !path) continue;
    return {
      kind: (pickString(c, "kind", "resource_type") as MediaKind) || kind,
      path: path || url,
      url: url || path,
      name: pickString(c, "name", "original_filename", "filename") || file.name,
      size: pickNumber(c, "size", "bytes", "length") || file.size || 0,
      provider: mediaProvider(c, url, path),
      resourceType: pickString(c, "resourceType", "resource_type"),
      format: pickString(c, "format")
    };
  }

  const extracted = findMediaLikeString(root);
  if (extracted) {
    return {
      kind,
      path: extracted,
      url: extracted,
      name: file.name,
      size: file.size || 0
    };
  }

  return null;
}

export function uploadMedia(
  kind: MediaKind,
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<{ media: UploadedMedia }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("kind", kind);
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}/api/v1/admin/media`, true);
    xhr.setRequestHeader("Authorization", `Bearer ${adminToken()}`);
    xhr.setRequestHeader("Accept", "application/json");

    if (onProgress) {
      onProgress({ loaded: 0, total: file.size, percent: 0 });
      xhr.upload.onprogress = event => {
        const total = event.total || file.size || 0;
        const percent =
          event.lengthComputable && total > 0 ? Math.round((event.loaded / total) * 100) : -1;
        onProgress({ loaded: event.loaded, total, percent });
      };
      xhr.upload.onload = () => onProgress({ loaded: file.size, total: file.size, percent: 100 });
    }

    xhr.onerror = () => reject(new Error("Network error during media upload"));
    xhr.ontimeout = () => reject(new Error("Media upload timed out"));
    xhr.onload = () => {
      let payload: unknown = null;
      try {
        payload = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        payload = null;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        const msg =
          (payload && typeof payload === "object" && (payload as AnyRecord).message) ||
          `Media upload failed (HTTP ${xhr.status})`;
        reject(new Error(typeof msg === "string" ? msg : `Media upload failed (HTTP ${xhr.status})`));
        return;
      }
      const media = normalizeMediaResponse(payload, kind, file);
      if (!media) {
        const raw = typeof xhr.responseText === "string" ? xhr.responseText.trim() : "";
        const preview = raw ? raw.slice(0, 240) : "";
        reject(
          new Error(
            preview
              ? `Media upload returned unsupported response: ${preview}`
              : "Media upload returned no media reference"
          )
        );
        return;
      }
      resolve({ media });
    };

    xhr.send(formData);
  });
}
