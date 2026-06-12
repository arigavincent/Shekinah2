import { requestWithAuth } from "./client";

export async function registerPrivateChatDevice(payload) {
  return requestWithAuth("/api/v1/private-chat/device", {
    method: "POST",
    body: payload
  });
}

export async function getPrivateChatMemberProfile(memberId) {
  return requestWithAuth(`/api/v1/private-chat/members/${encodeURIComponent(memberId)}`);
}

export async function listPrivateChatRequests() {
  return requestWithAuth("/api/v1/private-chat/requests");
}

export async function createPrivateChatRequest(recipientUserId) {
  return requestWithAuth("/api/v1/private-chat/requests", {
    method: "POST",
    body: { recipientUserId }
  });
}

export async function respondPrivateChatRequest(requestId, action) {
  return requestWithAuth(`/api/v1/private-chat/requests/${encodeURIComponent(requestId)}/respond`, {
    method: "POST",
    body: { action }
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
