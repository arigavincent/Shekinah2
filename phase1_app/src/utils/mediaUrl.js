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

export function extractYouTubeId(value) {
  if (!value || typeof value !== "string") return "";

  const input = value.trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;

  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match?.[1]) return match[1];
  }

  return "";
}

export function isYouTubeUrl(value) {
  return Boolean(extractYouTubeId(value));
}

export function isAudioUrl(value) {
  const url = resolveMediaUrl(value);
  return /\.(mp3|m4a|aac|wav|ogg)(\?.*)?$/i.test(url);
}

export function isVideoUrl(value) {
  const url = resolveMediaUrl(value);

  if (isYouTubeUrl(url)) return false;

  return /\.(mp4|m4v|mov|webm|m3u8)(\?.*)?$/i.test(url);
}

export function youtubeThumbnail(videoId) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function sermonMediaUrl(sermon) {
  return (
    sermon?.mediaUrl ||
    sermon?.videoUrl ||
    sermon?.audioUrl ||
    sermon?.youtubeUrl ||
    sermon?.youtubeId ||
    sermon?.url ||
    ""
  );
}

export function sermonThumbnail(sermon, fallback) {
  const rawMedia = sermonMediaUrl(sermon);
  const youtubeId = extractYouTubeId(rawMedia);

  return (
    resolveMediaUrl(
      sermon?.thumbnailUrl ||
        sermon?.thumbnail ||
        sermon?.imageUrl ||
        sermon?.image ||
        ""
    ) ||
    (youtubeId ? youtubeThumbnail(youtubeId) : "") ||
    fallback
  );
}
