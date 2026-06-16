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
