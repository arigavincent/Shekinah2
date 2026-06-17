import { API_CONFIG } from "../config/apiConfig";
import { request, requestWithAuth } from "./client";

function resolveBibleUrl(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${API_CONFIG.baseUrl}${raw}`;
  return `${API_CONFIG.baseUrl}/${raw}`;
}

function versionsFromResponse(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.versions)) return response.versions;
  return [];
}

function withApiBibleDownloadUrl(version) {
  if (version?.provider !== "api.bible" || !version?.providerBibleId) {
    return version;
  }

  return {
    ...version,
    downloadable: true,
    downloadStatus: "available",
    disabledReason: "",
    fileType: "vpl-text",
    provider: "api.bible",
    downloadUrl: `/api/v1/bible/provider/api-bible/versions/${encodeURIComponent(
      version.providerBibleId
    )}/export-vpl`
  };
}

function uniqueVersions(items) {
  const seen = new Set();
  const out = [];

  for (const item of items) {
    const key = item?.id || item?.providerBibleId || item?.name;
    if (!key || seen.has(key)) continue;

    seen.add(key);
    out.push(item);
  }

  return out;
}

export async function listBibleVersions(query = "") {
  const cleanQuery = query.trim();
  const suffix = cleanQuery ? `?query=${encodeURIComponent(cleanQuery)}` : "";

  const localPromise = request(`/api/v1/bible/versions${suffix}`);

  if (!cleanQuery) {
    return localPromise;
  }

  const [localResult, apiBibleResult] = await Promise.allSettled([
    localPromise,
    request(`/api/v1/bible/provider/api-bible/versions${suffix}`)
  ]);

  const localVersions =
    localResult.status === "fulfilled" ? versionsFromResponse(localResult.value) : [];

  const apiBibleVersions =
    apiBibleResult.status === "fulfilled"
      ? versionsFromResponse(apiBibleResult.value).map(withApiBibleDownloadUrl)
      : [];

  return {
    versions: uniqueVersions([...localVersions, ...apiBibleVersions]),
    providerStatus: {
      local: localResult.status,
      apiBible: apiBibleResult.status
    }
  };
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
