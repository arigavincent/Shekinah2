import { request } from "./client";

export function createPrayerRequest(payload) {
  return request("/api/v1/prayer-requests", {
    method: "POST",
    body: payload
  });
}
