import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ExpoPdfReader } from "../components/ExpoPdfReader";

import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { getLibraryItem, listLibraryItems } from "../api/libraryApi";
import { C } from "../constants/theme";
import { s } from "../styles/appStyles";
import { resolveMediaUrl } from "../utils/mediaUrl";

const LIBRARY_DIR = `${FileSystem.documentDirectory || FileSystem.cacheDirectory || ""}library-docs/`;
const DOWNLOADS_KEY = "@shekinah/library-downloads/v1";
const READER_STATE_KEY = "@shekinah/library-reader-state/v1";

function extensionFromUrl(value, fallback = "pdf") {
  const clean = String(value || "").split("?")[0].split("#")[0];
  const suffix = clean.includes(".") ? clean.split(".").pop() : "";
  return suffix && suffix.length <= 8 ? suffix.toLowerCase() : fallback;
}

function stableFileName(item, resolvedUrl) {
  const ext = extensionFromUrl(resolvedUrl, item?.fileType || "pdf");
  const safeId = String(item?.id || item?.title || "library")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return `${safeId || "library"}.${ext}`;
}

function formatBytes(size) {
  if (!size) return "Unknown size";
  const units = ["B", "KB", "MB", "GB"];
  let value = Number(size) || 0;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function mimeTypeFor(item, path = "") {
  const type = String(item?.fileType || "").toLowerCase();
  const ext = extensionFromUrl(path || item?.fileUrl || "", type || "pdf");

  if (type.includes("pdf") || ext === "pdf") return "application/pdf";
  if (type.includes("epub") || ext === "epub") return "application/epub+zip";
  if (["doc", "docx"].includes(ext)) return "application/msword";
  if (["ppt", "pptx"].includes(ext)) return "application/vnd.ms-powerpoint";
  if (["jpg", "jpeg"].includes(ext)) return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "txt") return "text/plain";

  return "application/octet-stream";
}

function isPdfMaterial(item) {
  const type = String(item?.fileType || "").toLowerCase();
  const url = String(item?.fileUrl || item?.sourceUrl || item?.path || "").toLowerCase();
  return type.includes("pdf") || /\.pdf(\?|#|$)/i.test(url);
}

async function ensureLibraryDir() {
  if (!LIBRARY_DIR) return;
  const dirInfo = await FileSystem.getInfoAsync(LIBRARY_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(LIBRARY_DIR, { intermediates: true });
  }
}

const libraryStyles = StyleSheet.create({
  secondaryBtn: {
    backgroundColor: C.surface2,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    borderWidth: 1,
    borderColor: C.line
  },
  secondaryText: {
    color: C.white,
    fontSize: 14,
    fontWeight: "900"
  },
  dangerText: {
    color: C.red,
    fontSize: 14,
    fontWeight: "900"
  },
  readerShell: {
    flex: 1,
    backgroundColor: C.background,
    borderRadius: 12,
    overflow: "hidden"
  },
  readerToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.line
  },
  readerToolButton: {
    backgroundColor: C.surface2,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 44,
    alignItems: "center"
  },
  readerToolText: {
    color: C.white,
    fontSize: 12,
    fontWeight: "900"
  },
  readerPageText: {
    color: C.gold,
    fontSize: 12,
    fontWeight: "900",
    flex: 1,
    textAlign: "center"
  },
  pdf: {
    flex: 1,
    width: "100%",
    backgroundColor: C.background
  }
});

export function LibraryScreen({ go, openDrawer, appLanguage = "en", session }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [readerSource, setReaderSource] = useState("");
  const [readerItem, setReaderItem] = useState(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloadingId, setDownloadingId] = useState("");
  const [downloads, setDownloads] = useState({});
  const [loadError, setLoadError] = useState("");
  const [readerStates, setReaderStates] = useState({});
  const [failedCovers, setFailedCovers] = useState({});

  const selectedDownload = selected?.id ? downloads[selected.id] : null;
  const signedIn = Boolean(session?.token && session?.user);
  const signedInUserId = String(session?.user?.id || session?.user?.email || "").trim();
  const readerStateStorageKey = signedIn && signedInUserId
    ? `${READER_STATE_KEY}:${signedInUserId}`
    : "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(item =>
      !q || [item.title, item.author, item.category, item.description].join(" ").toLowerCase().includes(q)
    );
  }, [items, query]);

  async function saveDownloads(nextDownloads) {
    setDownloads(nextDownloads);
    await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(nextDownloads));
  }

  async function loadDownloads() {
    try {
      const raw = await AsyncStorage.getItem(DOWNLOADS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      const next = {};

      for (const [id, record] of Object.entries(parsed || {})) {
        if (!record?.path) continue;
        const info = await FileSystem.getInfoAsync(record.path).catch(() => null);
        if (info?.exists) {
          next[id] = record;
        }
      }

      setDownloads(next);
      if (Object.keys(next).length !== Object.keys(parsed || {}).length) {
        await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(next));
      }
    } catch {
      setDownloads({});
    }
  }

  async function loadReaderStates() {
    if (!readerStateStorageKey) {
      setReaderStates({});
      return;
    }

    try {
      const raw = await AsyncStorage.getItem(readerStateStorageKey);
      setReaderStates(raw ? JSON.parse(raw) : {});
    } catch {
      setReaderStates({});
    }
  }

  async function saveReaderStateForItem(itemId, patch) {
    if (!signedIn || !readerStateStorageKey || !itemId) return;

    const next = {
      ...readerStates,
      [itemId]: {
        ...(readerStates[itemId] || {}),
        ...patch
      }
    };

    setReaderStates(next);
    await AsyncStorage.setItem(readerStateStorageKey, JSON.stringify(next));
  }

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      setLoadError("");
      const response = await listLibraryItems();
      setItems(Array.isArray(response?.items) ? response.items : []);
    } catch (error) {
      setItems([]);
      setLoadError(error instanceof Error ? error.message : "Unable to load the library.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDownloads();
    load();
  }, []);

  useEffect(() => {
    loadReaderStates();
  }, [readerStateStorageKey]);

  async function openItem(item) {
    try {
      const response = await getLibraryItem(item.id);
      const next = response?.item || item;
      setSelected(next);
      closeReader();

      const existing = downloads[next.id];
      if (existing?.path) {
        const info = await FileSystem.getInfoAsync(existing.path).catch(() => null);
        if (!info?.exists) {
          const nextDownloads = { ...downloads };
          delete nextDownloads[next.id];
          await saveDownloads(nextDownloads);
        }
      }
    } catch (error) {
      Alert.alert("Library", error instanceof Error ? error.message : "Unable to open this resource.");
    }
  }

  function openPdfReader(item, uri) {
    if (!uri) return;

    const nextItem = item || selected;
    setReaderItem(nextItem);
    setReaderSource(uri);
  }

  function closeReader() {
    setReaderSource("");
    setReaderItem(null);
  }

  function closeDetail() {
    setSelected(null);
    closeReader();
  }

  async function readInApp(item = selected) {
    const resolved = resolveMediaUrl(item?.fileUrl || "");
    if (!resolved) {
      Alert.alert("Library", "This resource is missing its file URL.");
      return;
    }

    if (!isPdfMaterial(item)) {
      Alert.alert(
        "Open Material",
        "This file type may need another app on your phone. Download it and open it from local storage."
      );
      return;
    }

    const downloaded = item?.id ? downloads[item.id] : null;
    const source = downloaded?.path || resolved;
    openPdfReader(downloaded || item, source);
  }

  async function downloadItem(item = selected) {
    const resolved = resolveMediaUrl(item?.fileUrl || "");
    if (!item || !resolved || !LIBRARY_DIR) {
      Alert.alert("Library", "This resource cannot be downloaded yet.");
      return;
    }

    setDownloadingId(item.id);

    try {
      await ensureLibraryDir();

      const targetPath = `${LIBRARY_DIR}${stableFileName(item, resolved)}`;
      const existingInfo = await FileSystem.getInfoAsync(targetPath).catch(() => null);

      if (!existingInfo?.exists) {
        const result = await FileSystem.downloadAsync(resolved, targetPath);
        if (result?.status && result.status >= 400) {
          throw new Error(`Download failed with HTTP ${result.status}`);
        }
      }

      const record = {
        id: item.id,
        title: item.title,
        author: item.author || "Shekinah Sons Global",
        category: item.category || "Library",
        fileType: item.fileType || extensionFromUrl(resolved),
        fileSizeBytes: item.fileSizeBytes || 0,
        path: targetPath,
        sourceUrl: resolved,
        downloadedAt: new Date().toISOString()
      };

      const nextDownloads = { ...downloads, [item.id]: record };
      await saveDownloads(nextDownloads);

      Alert.alert("Downloaded", "This material was saved on this device for later reading.", [
        { text: "Later", style: "cancel" },
        { text: "Open", onPress: () => openDownloaded(record) }
      ]);
    } catch (error) {
      Alert.alert("Download Failed", error instanceof Error ? error.message : "Unable to download this material.");
    } finally {
      setDownloadingId("");
    }
  }

  async function openDownloaded(record = selectedDownload) {
    if (!record?.path) {
      Alert.alert("Library", "This material is not downloaded yet.");
      return;
    }

    try {
      const info = await FileSystem.getInfoAsync(record.path);
      if (!info.exists) {
        const nextDownloads = { ...downloads };
        delete nextDownloads[record.id];
        await saveDownloads(nextDownloads);
        Alert.alert("Missing File", "This downloaded file is no longer on this device.");
        return;
      }

      if (isPdfMaterial(record)) {
        openPdfReader(record, record.path);
        return;
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(record.path, {
          mimeType: mimeTypeFor(record, record.path),
          dialogTitle: record.title || "Open Material"
        });
        return;
      }

      Alert.alert("Unavailable", "This device cannot open the saved file directly.");
    } catch (error) {
      Alert.alert("Open Failed", error instanceof Error ? error.message : "Unable to open the saved material.");
    }
  }


  function coverImageUri(item) {
    const url = resolveMediaUrl(item?.coverUrl || "");
    if (!url || failedCovers[item?.id]) return "";
    return url;
  }

  function markCoverFailed(item) {
    if (!item?.id) return;
    setFailedCovers(current => ({ ...current, [item.id]: true }));
  }

  function CoverFallback({ label = "Cover image unavailable" }) {
    return (
      <View style={[s.plainCard, { backgroundColor: C.surface2, alignItems: "center", justifyContent: "center", minHeight: 150 }]}>
        <Text style={[s.mutedText, { color: C.muted, textAlign: "center" }]}>{label}</Text>
      </View>
    );
  }

  async function deleteDownloaded(record = selectedDownload) {
    if (!record?.id) return;

    try {
      if (record.path) {
        const info = await FileSystem.getInfoAsync(record.path).catch(() => null);
        if (info?.exists) {
          await FileSystem.deleteAsync(record.path, { idempotent: true });
        }
      }

      const nextDownloads = { ...downloads };
      delete nextDownloads[record.id];
      await saveDownloads(nextDownloads);
    } catch (error) {
      Alert.alert("Delete Failed", error instanceof Error ? error.message : "Unable to delete this downloaded file.");
    }
  }

  if (readerSource) {
    return (
      <ExpoPdfReader
        title={readerItem?.title || "Library Reader"}
        sourceUri={readerSource}
        go={go}
        onBack={closeReader}
        appLanguage={appLanguage}
        itemId={readerItem?.id}
        readerState={signedIn ? readerStates[readerItem?.id] || {} : {}}
        readerFeaturesEnabled={signedIn}
        onRequireLogin={() => go("Profile")}
        onReaderStateChange={saveReaderStateForItem}
      />
    );
  }

  return (
    <Screen>
      <TopBar
        title="Library"
        go={go}
        back={selected ? "Library" : undefined}
        onBack={selected ? closeDetail : undefined}
        onMenu={selected ? undefined : openDrawer}
        appLanguage={appLanguage}
      />

      <ScrollView
        contentContainerStyle={s.scrollPad}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              loadDownloads();
              load(true);
            }}
            tintColor={C.gold}
            colors={[C.gold]}
            progressBackgroundColor={C.surface2}
          />
        }
      >
        {!selected ? (
          <>
            <View style={s.plainCard}>
              <Text style={[s.rowTitle, { color: C.white }]}>Books & E-Learning</Text>
              <Text style={[s.mutedText, { color: C.muted }]}>
                Read church handouts, books, and training materials. Download materials for later reading.
              </Text>
            </View>

            <TextInput
              style={[s.searchInput, { color: C.white }]}
              placeholder="Search title, author, category..."
              placeholderTextColor={C.muted}
              value={query}
              onChangeText={setQuery}
            />

            {loading ? (
              <View style={s.plainCard}>
                <Text style={[s.mutedText, { color: C.muted }]}>Loading library...</Text>
              </View>
            ) : loadError ? (
              <View style={s.plainCard}>
                <Text style={[s.rowTitle, { color: C.white }]}>Library unavailable</Text>
                <Text style={[s.mutedText, { color: C.muted }]}>
                  We could not load library materials right now. Pull down to refresh.
                </Text>
              </View>
            ) : filtered.length === 0 ? (
              <View style={s.plainCard}>
                <Text style={[s.rowTitle, { color: C.white }]}>No library items yet</Text>
                <Text style={[s.mutedText, { color: C.muted }]}>
                  Books and learning PDFs will appear here after the church uploads them.
                </Text>
              </View>
            ) : (
              filtered.map(item => {
                const downloaded = downloads[item.id];

                return (
                  <Pressable key={item.id} style={s.plainCard} onPress={() => openItem(item)}>
                    {coverImageUri(item) ? (
                      <Image
                        source={{ uri: coverImageUri(item) }}
                        style={[s.eventLargeImage, { marginBottom: 14 }]}
                        resizeMode="cover"
                        onError={() => markCoverFailed(item)}
                      />
                    ) : (
                      <CoverFallback label="No readable cover image" />
                    )}

                    <View style={[s.rowTight, { justifyContent: "space-between" }]}>
                      <Text style={[s.rowTitle, { color: C.white, flex: 1 }]}>{item.title}</Text>
                      {downloaded ? (
                        <Text style={s.goldSmall}>Downloaded</Text>
                      ) : item.isFeatured ? (
                        <Text style={s.goldSmall}>Featured</Text>
                      ) : null}
                    </View>

                    <Text style={[s.goldSmall, { marginTop: 8 }]}>{item.author || "Shekinah Sons Global"}</Text>
                    <Text style={[s.mutedText, { color: C.muted, marginTop: 6 }]}>
                      {item.category || "Library"} · {formatBytes(item.fileSizeBytes)}
                    </Text>
                    <Text style={s.detailBody}>{item.description}</Text>
                  </Pressable>
                );
              })
            )}

            {Object.values(downloads).length > 0 ? (
              <>
                <Text style={[s.sectionTitle, { marginTop: 18 }]}>Downloaded Materials</Text>
                {Object.values(downloads).map(record => (
                  <View key={record.id} style={s.plainCard}>
                    <Text style={[s.rowTitle, { color: C.white }]}>{record.title}</Text>
                    <Text style={[s.mutedText, { color: C.muted, marginTop: 6 }]}>
                      Saved on this device · {record.category}
                    </Text>

                    <View style={[s.rowTight, { gap: 10, marginTop: 14 }]}>
                      <Pressable style={[libraryStyles.secondaryBtn, { flex: 1 }]} onPress={() => openDownloaded(record)}>
                        <Text style={libraryStyles.secondaryText}>Open</Text>
                      </Pressable>
                      <Pressable style={[libraryStyles.secondaryBtn, { flex: 1 }]} onPress={() => deleteDownloaded(record)}>
                        <Text style={libraryStyles.dangerText}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </>
            ) : null}
          </>
        ) : (
          <>
            {coverImageUri(selected) ? (
              <Image
                source={{ uri: coverImageUri(selected) }}
                style={s.detailImage}
                resizeMode="cover"
                onError={() => markCoverFailed(selected)}
              />
            ) : (
              <CoverFallback label="Cover image unavailable. Upload a real image file in Admin." />
            )}

            <Text style={[s.detailTitle, { marginTop: 12 }]}>{selected.title}</Text>
            <Text style={s.goldSmall}>{selected.author || "Shekinah Sons Global"}</Text>
            <Text style={[s.mutedText, { color: C.muted, marginTop: 8 }]}>
              {selected.category || "Library"} · {formatBytes(selected.fileSizeBytes)}
            </Text>
            <Text style={s.detailBody}>{selected.description}</Text>

            {selectedDownload ? (
              <View style={[s.plainCard, { backgroundColor: C.surface2 }]}>
                <Text style={[s.rowTitle, { color: C.white }]}>Saved for offline reading</Text>
                <Text style={[s.mutedText, { color: C.muted, marginTop: 6 }]}>
                  This material is already saved on this device.
                </Text>
              </View>
            ) : null}

            <Pressable
              style={[s.primaryBtn, downloadingId === selected.id && { opacity: 0.65 }]}
              onPress={() => downloadItem(selected)}
              disabled={downloadingId === selected.id}
            >
              <Text style={s.primaryText}>
                {downloadingId === selected.id
                  ? "Downloading..."
                  : selectedDownload
                    ? "Download Again"
                    : "Download for Later"}
              </Text>
            </Pressable>

            {selectedDownload ? (
              <Pressable style={libraryStyles.secondaryBtn} onPress={() => openDownloaded(selectedDownload)}>
                <Text style={libraryStyles.secondaryText}>Open Downloaded Material</Text>
              </Pressable>
            ) : null}

            <Pressable style={libraryStyles.secondaryBtn} onPress={() => readInApp(selected)}>
              <Text style={libraryStyles.secondaryText}>Read in Reader</Text>
            </Pressable>

            {selectedDownload ? (
              <Pressable style={libraryStyles.secondaryBtn} onPress={() => deleteDownloaded(selectedDownload)}>
                <Text style={libraryStyles.dangerText}>Remove Download</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
