import { apiRequest } from "./client";
import { getToken } from "../auth/session";

export type EventItem = {
  id: string;
  title: string;
  eventDate: string;
  eventTime: string;
  location: string;
  imageUrl: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type EventPayload = {
  title: string;
  eventDate: string;
  eventTime: string;
  location: string;
  imageUrl: string;
  description: string;
};

function adminToken() {
  const token = getToken();

  if (!token) {
    throw new Error("Admin login required");
  }

  return token;
}

export function listEvents() {
  return apiRequest<{ events: EventItem[] }>("/api/v1/admin/events", {
    token: adminToken()
  });
}

export function createEvent(payload: EventPayload) {
  return apiRequest<{ event: EventItem }>("/api/v1/admin/events", {
    method: "POST",
    token: adminToken(),
    body: payload
  });
}

export function updateEvent(id: string, payload: Partial<EventPayload>) {
  return apiRequest<{ event: EventItem }>(`/api/v1/admin/events/${id}`, {
    method: "PATCH",
    token: adminToken(),
    body: payload
  });
}

export function deleteEvent(id: string) {
  return apiRequest<null>(`/api/v1/admin/events/${id}`, {
    method: "DELETE",
    token: adminToken()
  });
}
