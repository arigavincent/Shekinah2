import { getToken } from "../auth/session";
import { apiRequest } from "./client";

export type AdminCommunityMessage = {
  id: string;
  channel: string;
  displayName: string;
  message: string;
  status: string;
  hiddenReason?: string;
  createdAt: string;
  userId?: string;
  userEmail?: string;
};

export function listCommunityMessages(params: { channel?: string; status?: string } = {}) {
  const search = new URLSearchParams();
  if (params.channel) search.set("channel", params.channel);
  if (params.status) search.set("status", params.status);

  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiRequest<{ messages: AdminCommunityMessage[] }>(`/api/v1/admin/community/messages${suffix}`, {
    token: getToken()
  });
}

export function updateCommunityMessage(id: string, payload: { status: string; hiddenReason?: string }) {
  return apiRequest<{ message: AdminCommunityMessage }>(`/api/v1/admin/community/messages/${id}`, {
    method: "PATCH",
    token: getToken(),
    body: payload
  });
}

export function deleteCommunityMessage(id: string) {
  return apiRequest<void>(`/api/v1/admin/community/messages/${id}`, {
    method: "DELETE",
    token: getToken()
  });
}
