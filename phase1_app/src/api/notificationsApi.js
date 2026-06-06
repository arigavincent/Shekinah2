import { request } from "./client";

export function registerNotificationDevice(payload) {
  return request("/api/v1/notifications/register", {
    method: "POST",
    body: payload
  });
}

export function updateNotificationPreferences(payload) {
  return request("/api/v1/notifications/preferences", {
    method: "PATCH",
    body: payload
  });
}
