import { request, requestWithAuth } from "./client";

export function listCommunityMessages(channel = "global", options = {}) {
  const params = new URLSearchParams();
  params.set("channel", channel);

  if (options?.since) {
    params.set("since", options.since);
  }
  if (options?.order) {
    params.set("order", options.order);
  }

  return request(`/api/v1/community/messages?${params.toString()}`);
}

export function sendCommunityMessage(payload) {
  return requestWithAuth("/api/v1/community/messages", {
    method: "POST",
    body: payload
  });
}
