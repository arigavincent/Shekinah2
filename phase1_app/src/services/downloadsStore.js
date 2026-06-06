import * as FileSystem from "expo-file-system/legacy";

const FILE_ROOT = FileSystem.documentDirectory || FileSystem.cacheDirectory || "";
const ROOT_DIR = `${FILE_ROOT}shekinah-downloads/`;
const MANIFEST_URI = `${ROOT_DIR}manifest.json`;

export const DOWNLOAD_TYPES = {
  SERMON_AUDIO: "sermon_audio",
  SERMON_VIDEO: "sermon_video",
  BIBLE_VERSION: "bible_version"
};

async function ensureRootDir() {
  if (!FILE_ROOT) {
    throw new Error("File system is not available.");
  }

  const info = await FileSystem.getInfoAsync(ROOT_DIR);

  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(ROOT_DIR, { intermediates: true });
  }
}

async function readManifest() {
  await ensureRootDir();

  const info = await FileSystem.getInfoAsync(MANIFEST_URI);

  if (!info.exists) {
    return { items: [], updatedAt: new Date().toISOString() };
  }

  try {
    const raw = await FileSystem.readAsStringAsync(MANIFEST_URI);
    const parsed = JSON.parse(raw);

    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      updatedAt: parsed.updatedAt || new Date().toISOString()
    };
  } catch {
    return { items: [], updatedAt: new Date().toISOString() };
  }
}

async function writeManifest(items) {
  await ensureRootDir();

  await FileSystem.writeAsStringAsync(
    MANIFEST_URI,
    JSON.stringify(
      {
        items,
        updatedAt: new Date().toISOString()
      },
      null,
      2
    )
  );
}

export async function listDownloads() {
  const manifest = await readManifest();
  const existing = [];

  for (const item of manifest.items) {
    if (!item?.id || !item?.localUri) continue;

    const info = await FileSystem.getInfoAsync(item.localUri);

    if (info.exists) {
      existing.push({
        ...item,
        sizeBytes: info.size || item.sizeBytes || 0
      });
    }
  }

  if (existing.length !== manifest.items.length) {
    await writeManifest(existing);
  }

  return existing;
}

export async function registerDownload(item) {
  if (!item?.id) throw new Error("Download id is required.");
  if (!item?.localUri) throw new Error("Download localUri is required.");

  const existing = await listDownloads();

  const nextItem = {
    ...item,
    downloadedAt: item.downloadedAt || new Date().toISOString()
  };

  const next = [
    nextItem,
    ...existing.filter(existingItem => existingItem.id !== nextItem.id)
  ];

  await writeManifest(next);

  return nextItem;
}

export async function deleteDownload(id) {
  const existing = await listDownloads();
  const target = existing.find(item => item.id === id);

  if (target?.localUri) {
    await FileSystem.deleteAsync(target.localUri, { idempotent: true }).catch(() => {});
  }

  const next = existing.filter(item => item.id !== id);

  await writeManifest(next);

  return next;
}

export function formatBytes(bytes) {
  const value = Number(bytes || 0);

  if (!Number.isFinite(value) || value <= 0) return "Unknown size";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;

  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
