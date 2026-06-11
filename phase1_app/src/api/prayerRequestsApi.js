import { request, requestWithAuth } from "./client";

export function listPublicPrayerRequests() {
  return request("/api/v1/prayer-requests");
}

export function listMyPrayerRequests() {
  return requestWithAuth("/api/v1/prayer-requests/mine");
}

export function createPrayerRequest(payload) {
  return requestWithAuth("/api/v1/prayer-requests", {
    method: "POST",
    body: payload
  });
}

export function prayForRequest(id) {
  return requestWithAuth(`/api/v1/prayer-requests/${id}/pray`, {
    method: "POST"
  });
}
