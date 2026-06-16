import { getToken } from "../auth/session";
import { apiRequest } from "./client";

export type AdminTestimony = {
  id: string;
  title: string;
  body: string;
  status: string;
  featured: boolean;
  likeCount: number;
  displayName: string;
  ownerEmail: string;
  createdAt: string;
  updatedAt: string;
};

export function listAdminTestimonies(status = "") {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiRequest<{ testimonies: AdminTestimony[] }>(`/api/v1/admin/testimonies${suffix}`, {
    token: getToken()
  });
}

export function updateAdminTestimony(id: string, payload: { status: string; featured?: boolean }) {
  return apiRequest<{ testimony: AdminTestimony }>(`/api/v1/admin/testimonies/${id}`, {
    method: "PATCH",
    token: getToken(),
    body: payload
  });
}
