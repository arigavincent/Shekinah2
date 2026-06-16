export const PUBLISH_TIME_ZONE = "UTC";

export function publishNowValue() {
  return new Date().toISOString().slice(0, 16);
}

export function tomorrowMorningValue(hour = 5, minute = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  date.setUTCHours(hour, minute, 0, 0);
  return date.toISOString().slice(0, 16);
}

export function nextSundayMorningValue(hour = 8, minute = 0) {
  const date = new Date();
  const day = date.getUTCDay();
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  date.setUTCDate(date.getUTCDate() + daysUntilSunday);
  date.setUTCHours(hour, minute, 0, 0);
  return date.toISOString().slice(0, 16);
}

function parsePublishDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized =
    /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
      ? `${trimmed}T00:00:00Z`
      : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)
        ? `${trimmed}:00Z`
        : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed)
          ? `${trimmed}Z`
          : trimmed;

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatPublishAt(value: string) {
  const date = parsePublishDate(value);
  if (!date) return value;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: PUBLISH_TIME_ZONE
  }).format(date);
}

export function getPublishState(value: string) {
  const date = parsePublishDate(value);
  if (!date) {
    return { label: "Invalid time", tone: "danger" as const, isPublished: false };
  }

  if (date.getTime() <= Date.now()) {
    return { label: "Published", tone: "success" as const, isPublished: true };
  }

  return { label: "Scheduled", tone: "warning" as const, isPublished: false };
}

export function getPublishVisibility(value: string) {
  const state = getPublishState(value);

  if (state.label === "Invalid time") {
    return state;
  }

  return state.isPublished
    ? { ...state, label: "Visible in APK now" }
    : { ...state, label: "Scheduled - hidden from APK" };
}
