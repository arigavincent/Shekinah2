import { apiRequest } from "./client";
import { getToken } from "../auth/session";

export type ReadingPlanDay = {
  id?: string;
  dayNumber: number;
  title: string;
  reference: string;
  description: string;
  prayerPrompt: string;
};

export type ReadingPlan = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  durationDays: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  days: ReadingPlanDay[];
};

export type ReadingPlanPayload = {
  title: string;
  description: string;
  imageUrl: string;
  durationDays: number;
  isActive: boolean;
  days: ReadingPlanDay[];
};

function adminToken() {
  const token = getToken();
  if (!token) {
    throw new Error("Admin login required");
  }
  return token;
}

export function listAdminReadingPlans() {
  return apiRequest<{ plans: ReadingPlan[] }>("/api/v1/admin/reading-plans", {
    token: adminToken()
  });
}

export function createAdminReadingPlan(payload: ReadingPlanPayload) {
  return apiRequest<{ plan: ReadingPlan }>("/api/v1/admin/reading-plans", {
    method: "POST",
    token: adminToken(),
    body: payload
  });
}

export function updateAdminReadingPlan(id: string, payload: ReadingPlanPayload) {
  return apiRequest<{ plan: ReadingPlan }>(`/api/v1/admin/reading-plans/${id}`, {
    method: "PATCH",
    token: adminToken(),
    body: payload
  });
}

export function deleteAdminReadingPlan(id: string) {
  return apiRequest<null>(`/api/v1/admin/reading-plans/${id}`, {
    method: "DELETE",
    token: adminToken()
  });
}
