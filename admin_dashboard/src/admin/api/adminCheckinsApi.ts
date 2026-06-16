import { getToken } from "../auth/session";
import { apiRequest } from "./client";

export type AdminCheckin = {
  id: string;
  eventTitle: string;
  name: string;
  email: string;
  source: string;
  notes: string;
  createdAt: string;
};

export function listRecentCheckins() {
  return apiRequest<{ checkins: AdminCheckin[] }>("/api/v1/admin/checkins/recent", {
    token: getToken()
  });
}

export function verifyCheckin(payload: { code: string; eventId: string; notes?: string }) {
  return apiRequest<{
    eventId: string;
    eventTitle: string;
    userId: string;
    name: string;
    email: string;
    checkedIn: boolean;
  }>("/api/v1/admin/checkins/verify", {
    method: "POST",
    token: getToken(),
    body: payload
  });
}
