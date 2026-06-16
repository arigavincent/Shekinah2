import { apiRequest } from "./client";
import { getToken } from "../auth/session";

export type LibraryItem = {
  id: string;
  title: string;
  description: string;
  author: string;
  category: string;
  coverUrl: string;
  fileUrl: string;
  fileType: string;
  fileSizeBytes: number;
  isFeatured: boolean;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type LibraryPayload = {
  title: string;
  description: string;
  author: string;
  category: string;
  coverUrl: string;
  fileUrl: string;
  fileType: string;
  fileSizeBytes: number;
  isFeatured: boolean;
  publishedAt: string;
};

function adminToken() {
  const token = getToken();
  if (!token) {
    throw new Error("Admin login required");
  }
  return token;
}

export function listLibraryItems() {
  return apiRequest<{ items: LibraryItem[] }>("/api/v1/admin/library", {
    token: adminToken()
  });
}

export function createLibraryItem(payload: LibraryPayload) {
  return apiRequest<{ item: LibraryItem }>("/api/v1/admin/library", {
    method: "POST",
    token: adminToken(),
    body: payload
  });
}

export function updateLibraryItem(id: string, payload: Partial<LibraryPayload>) {
  return apiRequest<{ item: LibraryItem }>(`/api/v1/admin/library/${id}`, {
    method: "PATCH",
    token: adminToken(),
    body: payload
  });
}

export function deleteLibraryItem(id: string) {
  return apiRequest<null>(`/api/v1/admin/library/${id}`, {
    method: "DELETE",
    token: adminToken()
  });
}
