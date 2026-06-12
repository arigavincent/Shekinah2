import { request, requestWithAuth } from "./client";
import { API_CONFIG } from "../config/apiConfig";

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

export function liveChatSocketUrl() {
  const baseUrl = API_CONFIG.baseUrl.replace(/\/+$/, "");
  if (baseUrl.startsWith("https://")) {
    return `${baseUrl.replace("https://", "wss://")}/api/v1/community/live/stream`;
  }
  if (baseUrl.startsWith("http://")) {
    return `${baseUrl.replace("http://", "ws://")}/api/v1/community/live/stream`;
  }

  return `${baseUrl}/api/v1/community/live/stream`;
}
