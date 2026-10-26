import { API_CONFIG } from "../config/apiConfig";

export function resolveMediaUrl(value) {
  if (!value || typeof value !== "string") return "";

  const input = value.trim();

  if (
    input.startsWith("http://") ||
    input.startsWith("https://") ||
    input.startsWith("file://")
  ) {
    return input;
  }

  if (input.startsWith("/")) {
    return `${API_CONFIG.baseUrl}${input}`;
  }

  return input;
}

export function isAudioUrl(value) {
  const url = resolveMediaUrl(value);
  return /\.(mp3|m4a|aac|wav|ogg)(\?.*)?$/i.test(url);
}

export function isVideoUrl(value) {
  const url = resolveMediaUrl(value);
  return /\.(mp4|m4v|mov|webm|m3u8)(\?.*)?$/i.test(url);
}

export function sermonMediaUrl(sermon) {
  return (
    sermon?.mediaUrl ||
    sermon?.videoUrl ||
    sermon?.audioUrl ||
    sermon?.url ||
    ""
  );
}

export function sermonThumbnail(sermon, fallback) {
  return (
    resolveMediaUrl(
      sermon?.thumbnailUrl ||
        sermon?.thumbnail ||
        sermon?.imageUrl ||
        sermon?.image ||
        ""
    ) ||
    fallback
  );
}
