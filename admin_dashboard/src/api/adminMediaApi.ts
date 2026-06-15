import { getToken } from "../auth/session";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export type MediaKind = "image" | "video" | "audio" | "document";

export type UploadedMedia = {
  kind: MediaKind;
  path: string;
  url: string;
  name: string;
  size: number;
};

function adminToken() {
  const token = getToken();

  if (!token) {
    throw new Error("Admin login required");
  }

  return token;
}

export async function uploadMedia(kind: MediaKind, file: File) {
  const formData = new FormData();
  formData.append("kind", kind);
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/v1/admin/media`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken()}`
    },
    body: formData
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message || "Media upload failed");
  }

  return payload as { media: UploadedMedia };
}
