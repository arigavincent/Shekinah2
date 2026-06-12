import { requestWithAuth } from "./client";

export async function registerPrivateChatDevice(payload) {
  return requestWithAuth("/api/v1/private-chat/device", {
    method: "POST",
    body: payload
  });
}

export async function listPrivateChatContacts() {
  return requestWithAuth("/api/v1/private-chat/contacts");
}

export async function createPrivateChatThread(recipientUserId) {
  return requestWithAuth("/api/v1/private-chat/threads", {
    method: "POST",
    body: { recipientUserId }
  });
}

export async function listPrivateChatThreads() {
  return requestWithAuth("/api/v1/private-chat/threads");
}

export async function listPrivateChatMessages(threadId) {
  return requestWithAuth(`/api/v1/private-chat/threads/${encodeURIComponent(threadId)}/messages`);
}

export async function sendPrivateChatMessage(threadId, payload) {
  return requestWithAuth(`/api/v1/private-chat/threads/${encodeURIComponent(threadId)}/messages`, {
    method: "POST",
    body: payload
  });
}
