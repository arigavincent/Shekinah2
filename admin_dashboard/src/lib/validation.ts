export function isValidDateString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;

  return date.toISOString().slice(0, 10) === value;
}

export function isValidAssetReference(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;

  if (trimmed.startsWith("/uploads/")) return true;

  try {
    const url = new URL(trimmed);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

export function isValidYouTubeId(value: string) {
  return /^[A-Za-z0-9_-]{6,64}$/.test(value.trim());
}

export function isValidPhone(value: string) {
  return /^\+?[0-9 ()-]{7,20}$/.test(value.trim());
}

export function hasMinLength(value: string, min: number) {
  return value.trim().length >= min;
}
