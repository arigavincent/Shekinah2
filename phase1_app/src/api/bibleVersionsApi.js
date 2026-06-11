import { API_CONFIG } from "../config/apiConfig";
import { request, requestWithAuth } from "./client";

export function listBibleVersions(query = "") {
  const suffix = query.trim() ? `?query=${encodeURIComponent(query.trim())}` : "";
  return request(`/api/v1/bible/versions${suffix}`);
}

export function getBibleVersionDownloadUrl(version) {
  if (!version) return "";

  const primary = typeof version.downloadUrl === "string" ? version.downloadUrl.trim() : "";
  if (primary) return primary;

  const fallback = typeof version.fallbackDownloadUrl === "string" ? version.fallbackDownloadUrl.trim() : "";
  if (!fallback) return "";

  if (/^https?:\/\//i.test(fallback)) {
    return fallback;
  }

  return `${API_CONFIG.baseUrl}${fallback}`;
}

export function getBibleVersionFallbackUrl(version) {
  const fallback = typeof version?.fallbackDownloadUrl === "string" ? version.fallbackDownloadUrl.trim() : "";
  if (!fallback) return "";
  if (/^https?:\/\//i.test(fallback)) return fallback;
  return `${API_CONFIG.baseUrl}${fallback}`;
}

export function listInstalledBibleVersionsRemote() {
  return requestWithAuth("/api/v1/bible/installs");
}

export function recordBibleVersionInstall(payload) {
  return requestWithAuth("/api/v1/bible/installs", {
    method: "POST",
    body: payload
  });
}
