import { API_CONFIG } from "../config/apiConfig";
import { request, requestWithAuth } from "./client";

function resolveBibleUrl(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${API_CONFIG.baseUrl}${raw}`;
  return `${API_CONFIG.baseUrl}/${raw}`;
}

export function listBibleVersions(query = "") {
  const suffix = query.trim() ? `?query=${encodeURIComponent(query.trim())}` : "";
  return request(`/api/v1/bible/versions${suffix}`);
}

export function getBibleVersionDownloadUrl(version) {
  if (!version) return "";

  const primary = resolveBibleUrl(version.downloadUrl);
  if (primary) return primary;

  return resolveBibleUrl(version.fallbackDownloadUrl);
}

export function getBibleVersionFallbackUrl(version) {
  return resolveBibleUrl(version?.fallbackDownloadUrl);
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
