import * as FileSystem from "expo-file-system/legacy";
import { Asset } from "expo-asset";
import { openDatabaseAsync } from "expo-sqlite";
import JSZip from "jszip";

import { getBibleVersionDownloadUrl, getBibleVersionFallbackUrl, recordBibleVersionInstall } from "../api/bibleVersionsApi";

const DB_NAME = "bible.db";
const DB_ASSET = require("../../assets/bible/bible.db");
const LABEL_SOURCE_VERSION = "eng_msb";

export const BUNDLED_VERSION_IDS = ["eng_msb", "swh_neno"];

async function ensureBibleDb() {
  const dir = `${FileSystem.documentDirectory}SQLite`;
  const target = `${dir}/${DB_NAME}`;

  const info = await FileSystem.getInfoAsync(target);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

    const asset = Asset.fromModule(DB_ASSET);
    await asset.downloadAsync();

    await FileSystem.copyAsync({
      from: asset.localUri || asset.uri,
      to: target
    });
  }
}

export async function openBibleDb() {
  await ensureBibleDb();
  return openDatabaseAsync(DB_NAME);
}

export async function listInstalledBibleVersions(database) {
  const db = database || (await openBibleDb());
  return db.getAllAsync(
    `
      SELECT id, name, short_label, abbreviation, language_code, license, attribution
      FROM versions
      ORDER BY CASE WHEN id IN ('eng_msb', 'swh_neno') THEN 0 ELSE 1 END, name ASC
    `
  );
}

async function readVersionText(version) {
  const tempPath = `${FileSystem.cacheDirectory}${version.id || "bible"}-${Date.now()}`;
  const attempts = [getBibleVersionDownloadUrl(version), getBibleVersionFallbackUrl(version)].filter(Boolean);
  let lastError = null;

  for (const url of attempts) {
    try {
      const isZip = /\.zip($|\?)/i.test(url);
      const targetPath = `${tempPath}${isZip ? ".zip" : ".txt"}`;
      await FileSystem.downloadAsync(url, targetPath);

      let contents = "";
      if (isZip) {
        const base64 = await FileSystem.readAsStringAsync(targetPath, {
          encoding: FileSystem.EncodingType.Base64
        });
        const zip = await JSZip.loadAsync(base64, { base64: true });
        const textFileName = Object.keys(zip.files).find(name => /\.(txt|vpl)$/i.test(name));

        if (!textFileName) {
          throw new Error("Bible package did not contain a readable text file.");
        }

        contents = await zip.files[textFileName].async("string");
      } else {
        contents = await FileSystem.readAsStringAsync(targetPath);
      }

      await FileSystem.deleteAsync(targetPath, { idempotent: true });
      if (contents.trim()) {
        return contents;
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("Unable to download Bible version text.");
}

function normalizeVersionId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_");
}

function parseVPL(text, bookCodeMap) {
  const lines = text.split(/\r?\n/);
  const parsed = [];
  const pattern = /^([1-3]?[A-Z]{2,5})\s+(\d+):(\d+)\s+(.+)$/;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(pattern);
    if (!match) continue;

    const bookCode = match[1].toUpperCase();
    const bookId = bookCodeMap.get(bookCode);
    if (!bookId) continue;

    parsed.push({
      bookId,
      chapter: Number(match[2]),
      verse: Number(match[3]),
      text: match[4].trim()
    });
  }

  return parsed;
}

function parseCommaSeparatedBookLine(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/\t|,/);
  if (parts.length < 4) return null;

  const bookCode = String(parts[0] || "").trim().toUpperCase();
  const chapter = Number(String(parts[1] || "").trim());
  const verse = Number(String(parts[2] || "").trim());
  const text = parts.slice(3).join(" ").trim();

  if (!bookCode || !Number.isFinite(chapter) || !Number.isFinite(verse) || !text) {
    return null;
  }

  return { bookCode, chapter, verse, text };
}

function parsePipeSeparatedBookLine(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed) return null;

  const parts = trimmed.split("|");
  if (parts.length < 4) return null;

  const bookCode = String(parts[0] || "").trim().toUpperCase();
  const chapter = Number(String(parts[1] || "").trim());
  const verse = Number(String(parts[2] || "").trim());
  const text = parts.slice(3).join("|").trim();

  if (!bookCode || !Number.isFinite(chapter) || !Number.isFinite(verse) || !text) {
    return null;
  }

  return { bookCode, chapter, verse, text };
}

function parseAlternativeVPL(text, bookCodeMap) {
  const lines = text.split(/\r?\n/);
  const parsed = [];

  for (const rawLine of lines) {
    const line = String(rawLine || "").replace(/^\uFEFF/, "").trim();
    if (!line) continue;

    const candidate = parsePipeSeparatedBookLine(line) || parseCommaSeparatedBookLine(line);
    if (!candidate) continue;

    const bookId = bookCodeMap.get(candidate.bookCode);
    if (!bookId) continue;

    parsed.push({
      bookId,
      chapter: candidate.chapter,
      verse: candidate.verse,
      text: candidate.text
    });
  }

  return parsed;
}

export async function installBibleVersion(version) {
  const db = await openBibleDb();
  const versionId = normalizeVersionId(version.id);
  const versionName = String(version.name || version.id || "Bible Version").trim();
  const versionAbbreviation = String(version.abbreviation || version.id || "BIBLE").trim().slice(0, 24);
  const versionShortLabel = String(version.abbreviation || version.name || version.id || "Bible").trim().slice(0, 32);
  const languageCode = String(version.languageCode || "").trim().slice(0, 12) || "und";
  const license = String(version.license || "Provider supplied").trim().slice(0, 120);
  const attribution = String(version.attribution || version.provider || "").trim().slice(0, 180);
  const provider = String(version.provider || "provider").trim();

  const sourceText = await readVersionText(version);
  const books = await db.getAllAsync(`SELECT id, code FROM books ORDER BY sort_order ASC`);
  const bookCodeMap = new Map(books.map(item => [String(item.code).toUpperCase(), item.id]));
  const verses = parseVPL(sourceText, bookCodeMap);
  const resolvedVerses = verses.length ? verses : parseAlternativeVPL(sourceText, bookCodeMap);

  if (!resolvedVerses.length) {
    throw new Error("Downloaded version text could not be parsed.");
  }

  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM verses WHERE version_id = ?`, versionId);
    await db.runAsync(`DELETE FROM book_labels WHERE version_id = ?`, versionId);
    await db.runAsync(`DELETE FROM versions WHERE id = ?`, versionId);

    await db.runAsync(
      `
        INSERT INTO versions (id, name, short_label, abbreviation, language_code, license, attribution)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      versionId,
      versionName,
      versionShortLabel,
      versionAbbreviation,
      languageCode,
      license,
      attribution
    );

    await db.runAsync(
      `
        INSERT INTO book_labels (version_id, book_id, name)
        SELECT ?, book_id, name
        FROM book_labels
        WHERE version_id = ?
      `,
      versionId,
      LABEL_SOURCE_VERSION
    );

    const statement = await db.prepareAsync(
      `INSERT INTO verses (version_id, book_id, chapter, verse, text) VALUES (?, ?, ?, ?, ?)`
    );

    try {
      for (const item of resolvedVerses) {
        await statement.executeAsync(versionId, item.bookId, item.chapter, item.verse, item.text);
      }
    } finally {
      await statement.finalizeAsync();
    }
  });

  try {
    await recordBibleVersionInstall({
      provider,
      versionId,
      languageCode,
      languageName: String(version.languageName || "").trim(),
      name: versionName,
      abbreviation: versionAbbreviation,
      status: "installed"
    });
  } catch {
    // Device install should still succeed if the member is not signed in.
  }

  return {
    id: versionId,
    name: versionName
  };
}

export async function removeBibleVersion(versionId) {
  if (BUNDLED_VERSION_IDS.includes(versionId)) {
    throw new Error("Bundled Bible versions cannot be removed.");
  }

  const db = await openBibleDb();

  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM verses WHERE version_id = ?`, versionId);
    await db.runAsync(`DELETE FROM book_labels WHERE version_id = ?`, versionId);
    await db.runAsync(`DELETE FROM versions WHERE id = ?`, versionId);
  });

  try {
    await recordBibleVersionInstall({
      provider: "device",
      versionId,
      languageCode: "",
      languageName: "",
      name: versionId,
      abbreviation: versionId.toUpperCase(),
      status: "removed"
    });
  } catch {
    // Ignore account sync failures for local removal.
  }
}

export async function getVersionChapterVerses(database, versionId, bookId, chapter) {
  const db = database || (await openBibleDb());
  return db.getAllAsync(
    `
      SELECT verse, text
      FROM verses
      WHERE version_id = ? AND book_id = ? AND chapter = ?
      ORDER BY verse ASC
    `,
    [versionId, bookId, chapter]
  );
}
