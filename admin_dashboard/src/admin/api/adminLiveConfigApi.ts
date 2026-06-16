import { apiRequest } from "./client";
import { getToken } from "../auth/session";

export type LiveProvider = "youtube" | "facebook" | "external_hls" | "cloudflare_stream";

export type LiveConfig = {
  id: string;
  isLive: boolean;
  title: string;
  viewers: string;
  nextService: string;
  youtubeId: string;
  provider: LiveProvider;
  cloudflareLiveInputId?: string;
  cloudflarePlaybackUid?: string;
  playbackHlsUrl?: string;
  playbackDashUrl?: string;
  embedUrl?: string;
  rtmpsUrl?: string;
  srtUrl?: string;
  srtStreamId?: string;
  streamKey?: string;
  srtPassphrase?: string;
  replayUrl?: string;
  hasCloudflareLiveInput?: boolean;
  updatedAt: string;
};

export type LiveConfigPayload = {
  isLive: boolean;
  title: string;
  viewers: string;
  nextService: string;
  youtubeId: string;
  provider: LiveProvider;
  replayUrl?: string;
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

export function createCloudflareLiveInput() {
  return apiRequest<{ liveConfig: LiveConfig }>("/api/v1/admin/live-config/cloudflare/live-input", {
    method: "POST",
    token: adminToken()
  });
}


export function resetCloudflareLiveInput() {
  return apiRequest<{ liveConfig: LiveConfig }>("/api/v1/admin/live-config/cloudflare/live-input", {
    method: "DELETE",
    token: adminToken()
  });
}
