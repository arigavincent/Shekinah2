import { request, requestWithAuth } from "./client";

export function listCommunityMessages(channel = "global") {
  return request(`/api/v1/community/messages?channel=${encodeURIComponent(channel)}`);
}

export function sendCommunityMessage(payload) {
  return requestWithAuth("/api/v1/community/messages", {
    method: "POST",
    body: payload
  });
}
