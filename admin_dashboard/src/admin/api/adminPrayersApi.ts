import { getToken } from "../auth/session";
import { apiRequest } from "./client";

export type AdminPrayer = {
  id: string;
  name: string;
  text: string;
  count: number;
  category: string;
  isPublic: boolean;
  ownerEmail: string;
  status: string;
  adminNote: string;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string | null;
  pinned?: boolean;
  shownFrom?: string;
};

export type UpdatePrayerPayload = {
  status?: string;
  adminNote?: string;
};

export async function listPrayers() {
  return apiRequest<{ prayers: AdminPrayer[] }>("/api/v1/admin/prayers", {
    token: getToken()
  });
}

export async function updatePrayer(id: string, payload: UpdatePrayerPayload) {
  return apiRequest<{ prayer: AdminPrayer }>(`/api/v1/admin/prayers/${id}`, {
    method: "PATCH",
    token: getToken(),
    body: payload
  });
}

export async function pinPrayer(id: string, pinned: boolean) {
  return apiRequest<{ pinned: boolean; message: string }>(`/api/v1/admin/prayers/${id}/pin`, {
    method: "PATCH",
    token: getToken(),
    body: { pinned }
  });
}

export async function getPrayerSettings() {
  return apiRequest<{ wallDays: number }>("/api/v1/admin/prayers/settings", { token: getToken() });
}

export async function savePrayerSettings(wallDays: number) {
  return apiRequest<{ wallDays: number; message: string }>("/api/v1/admin/prayers/settings", {
    method: "PUT",
    token: getToken(),
    body: { wallDays }
  });
}
