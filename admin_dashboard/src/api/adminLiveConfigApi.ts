import { apiRequest } from "./client";
import { getToken } from "../auth/session";

export type LiveConfig = {
  id: string;
  isLive: boolean;
  title: string;
  viewers: string;
  nextService: string;
  youtubeId: string;
  updatedAt: string;
};

export type LiveConfigPayload = {
  isLive: boolean;
  title: string;
  viewers: string;
  nextService: string;
  youtubeId: string;
};

function adminToken() {
  const token = getToken();

  if (!token) {
    throw new Error("Admin login required");
  }

  return token;
}

export function getLiveConfig() {
  return apiRequest<{ liveConfig: LiveConfig }>("/api/v1/admin/live-config", {
    token: adminToken()
  });
}

export function updateLiveConfig(payload: Partial<LiveConfigPayload>) {
  return apiRequest<{ liveConfig: LiveConfig }>("/api/v1/admin/live-config", {
    method: "PATCH",
    token: adminToken(),
    body: payload
  });
}
