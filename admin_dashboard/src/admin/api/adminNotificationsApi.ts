import { getToken } from "../auth/session";
import { apiRequest } from "./client";

export type NotificationMessage = {
  id: string;
  title: string;
  body: string;
  category: string;
  targetCount: number;
  successCount: number;
  failureCount: number;
  createdAt: string;
};

export type BroadcastPayload = {
  title: string;
  body: string;
  category: string;
  data?: Record<string, unknown>;
};

export async function listNotificationMessages() {
  return apiRequest<{ messages: NotificationMessage[] }>(
    "/api/v1/admin/notifications/messages",
    {
      token: getToken()
    }
  );
}

export async function broadcastNotification(payload: BroadcastPayload) {
  return apiRequest<{
    message: {
      id: string;
      targetCount: number;
      successCount: number;
      failureCount: number;
    };
  }>("/api/v1/admin/notifications/broadcast", {
    method: "POST",
    token: getToken(),
    body: payload
  });
}
