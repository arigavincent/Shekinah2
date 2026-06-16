export const PUBLISH_TIME_ZONE = "UTC";

export function publishNowValue() {
  return new Date().toISOString().slice(0, 16);
}

export function formatPublishAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function getPublishState(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { label: "Invalid time", tone: "danger" as const, isPublished: false };
  }

  if (date.getTime() <= Date.now()) {
    return { label: "Published", tone: "success" as const, isPublished: true };
  }

  return { label: "Scheduled", tone: "warning" as const, isPublished: false };
}
