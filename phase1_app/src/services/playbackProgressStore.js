import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "shekinah:playback:progress:v1";
const listeners = new Set();

let cache = null;

function emit() {
  for (const listener of listeners) {
    listener(cache || {});
  }
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== "object") return null;

  const sermonId = String(entry.sermonId || "").trim();
  if (!sermonId) return null;

  const positionMs = Math.max(0, Number(entry.positionMs || 0));
  const durationMs = Math.max(0, Number(entry.durationMs || 0));

  return {
    sermonId,
    title: String(entry.title || "").trim(),
    speaker: String(entry.speaker || "").trim(),
    type: String(entry.type || "").trim(),
    thumbnail: String(entry.thumbnail || "").trim(),
    positionMs,
    durationMs,
    updatedAt: entry.updatedAt || new Date().toISOString()
  };
}

function normalizeStore(value) {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.values(value).reduce((acc, item) => {
    const next = normalizeEntry(item);
    if (next) {
      acc[next.sermonId] = next;
    }
    return acc;
  }, {});
}

async function readStore(force = false) {
  if (cache && !force) {
    return cache;
  }

  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cache = normalizeStore(raw ? JSON.parse(raw) : {});
  } catch {
    cache = {};
  }

  return cache;
}

async function writeStore(value) {
  cache = normalizeStore(value);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  emit();
  return cache;
}

export async function getPlaybackProgressMap() {
  return readStore();
}

export async function getPlaybackProgress(sermonId) {
  const map = await readStore();
  return map[String(sermonId || "").trim()] || null;
}

export async function savePlaybackProgress(entry) {
  const nextEntry = normalizeEntry(entry);
  if (!nextEntry) {
    return null;
  }

  const current = await readStore();

  await writeStore({
    ...current,
    [nextEntry.sermonId]: nextEntry
  });

  return nextEntry;
}

export async function clearPlaybackProgress(sermonId) {
  const key = String(sermonId || "").trim();
  if (!key) return {};

  const current = await readStore();
  if (!current[key]) {
    return current;
  }

  const next = { ...current };
  delete next[key];
  await writeStore(next);
  return next;
}

export function subscribePlaybackProgress(listener) {
  listeners.add(listener);

  readStore()
    .then(value => listener(value))
    .catch(() => listener({}));

  return () => {
    listeners.delete(listener);
  };
}

export function progressRatio(entry) {
  const positionMs = Number(entry?.positionMs || 0);
  const durationMs = Number(entry?.durationMs || 0);

  if (!Number.isFinite(positionMs) || !Number.isFinite(durationMs) || durationMs <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, positionMs / durationMs));
}

export function hasContinueProgress(entry) {
  const ratio = progressRatio(entry);
  return Number(entry?.positionMs || 0) >= 5000 && ratio > 0.02 && ratio < 0.98;
}

export function formatPlaybackTime(ms) {
  const safeMs = Math.max(0, Number(ms || 0));
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
