import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { WebView } from "react-native-webview";

import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { getLibraryItem, listLibraryItems } from "../api/libraryApi";
import { C } from "../constants/theme";
import { s } from "../styles/appStyles";
import { resolveMediaUrl } from "../utils/mediaUrl";

const LIBRARY_DIR = `${FileSystem.documentDirectory || FileSystem.cacheDirectory || ""}library-docs/`;

function safeFileName(item, resolvedUrl) {
  const suffix = resolvedUrl.split(".").pop()?.split("?")[0] || "pdf";
  return `${item.id || "library"}-${Date.now()}.${suffix}`;
}

function formatBytes(size) {
  if (!size) return "Unknown size";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function LibraryScreen({ go, openDrawer, appLanguage = "en" }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [viewerUrl, setViewerUrl] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadedPath, setDownloadedPath] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(item =>
      !q || [item.title, item.author, item.category, item.description].join(" ").toLowerCase().includes(q)
    );
  }, [items, query]);

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await listLibraryItems();
      setItems(Array.isArray(response?.items) ? response.items : []);
    } catch (error) {
      Alert.alert("Library", error instanceof Error ? error.message : "Unable to load the library.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function openItem(item) {
    try {
      const response = await getLibraryItem(item.id);
      const next = response?.item || item;
      setSelected(next);
      setViewerUrl("");
      const resolved = resolveMediaUrl(next.fileUrl);
      if (!resolved || !FileSystem.documentDirectory) {
        setDownloadedPath("");
        return;
      }

      const directoryInfo = await FileSystem.getInfoAsync(LIBRARY_DIR);
      if (!directoryInfo.exists) {
        await FileSystem.makeDirectoryAsync(LIBRARY_DIR, { intermediates: true });
      }

      const files = await FileSystem.readDirectoryAsync(LIBRARY_DIR).catch(() => []);
      const matched = files.find(file => file.startsWith(`${next.id}-`));
      if (matched) {
        setDownloadedPath(`${LIBRARY_DIR}${matched}`);
      } else {
        setDownloadedPath("");
      }
    } catch (error) {
      Alert.alert("Library", error instanceof Error ? error.message : "Unable to open this resource.");
    }
  }

  async function readInApp() {
    const resolved = resolveMediaUrl(selected?.fileUrl || "");
    if (!resolved) {
      Alert.alert("Library", "This resource is missing its PDF file URL.");
      return;
    }
    setViewerUrl(`https://drive.google.com/viewerng/viewer?embedded=true&url=${encodeURIComponent(resolved)}`);
  }

  async function downloadItem() {
    const resolved = resolveMediaUrl(selected?.fileUrl || "");
    if (!selected || !resolved || !LIBRARY_DIR) {
      Alert.alert("Library", "This resource cannot be downloaded yet.");
      return;
    }

    setDownloading(true);
    try {
      const dirInfo = await FileSystem.getInfoAsync(LIBRARY_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(LIBRARY_DIR, { intermediates: true });
      }

      const targetPath = `${LIBRARY_DIR}${safeFileName(selected, resolved)}`;
      await FileSystem.downloadAsync(resolved, targetPath);
      setDownloadedPath(targetPath);
      Alert.alert("Downloaded", "The PDF was saved on this device.", [
        { text: "Later", style: "cancel" },
        { text: "Open", onPress: openDownloaded }
      ]);
    } catch (error) {
      Alert.alert("Download Failed", error instanceof Error ? error.message : "Unable to download this PDF.");
    } finally {
      setDownloading(false);
    }
  }

  async function openDownloaded() {
    if (!downloadedPath) return;
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloadedPath, {
          mimeType: "application/pdf",
          UTI: "com.adobe.pdf"
        });
        return;
      }

      Alert.alert("Unavailable", "This device cannot open the saved PDF directly.");
    } catch (error) {
      Alert.alert("Open Failed", error instanceof Error ? error.message : "Unable to open the saved PDF.");
    }
  }

  if (viewerUrl) {
    return (
      <Screen>
        <TopBar title="Library Reader" go={go} back="Library" onBack={() => setViewerUrl("")} appLanguage={appLanguage} />
        <View style={{ flex: 1, marginTop: 12 }}>
          <WebView source={{ uri: viewerUrl }} style={{ flex: 1, backgroundColor: C.background }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar
        title="Library"
        go={go}
        back={selected ? "Library" : undefined}
        onBack={selected ? () => setSelected(null) : undefined}
        onMenu={selected ? undefined : openDrawer}
        appLanguage={appLanguage}
      />

      <ScrollView
        contentContainerStyle={s.scrollPad}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
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
                Read church handouts, books, and training materials in one place.
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
            ) : filtered.length === 0 ? (
              <View style={s.plainCard}>
                <Text style={[s.rowTitle, { color: C.white }]}>No library items yet</Text>
                <Text style={[s.mutedText, { color: C.muted }]}>
                  Books and learning PDFs will appear here after the church uploads them.
                </Text>
              </View>
            ) : (
              filtered.map(item => (
                <Pressable key={item.id} style={s.plainCard} onPress={() => openItem(item)}>
                  {item.coverUrl ? (
                    <Image
                      source={{ uri: resolveMediaUrl(item.coverUrl) }}
                      style={[s.eventLargeImage, { marginBottom: 14 }]}
                      resizeMode="cover"
                    />
                  ) : null}
                  <View style={[s.rowTight, { justifyContent: "space-between" }]}>
                    <Text style={[s.rowTitle, { color: C.white, flex: 1 }]}>{item.title}</Text>
                    {item.isFeatured ? <Text style={s.goldSmall}>Featured</Text> : null}
                  </View>
                  <Text style={[s.goldSmall, { marginTop: 8 }]}>{item.author || "Shekinah Sons Global"}</Text>
                  <Text style={[s.mutedText, { color: C.muted, marginTop: 6 }]}>
                    {item.category || "Library"} · {formatBytes(item.fileSizeBytes)}
                  </Text>
                  <Text style={s.detailBody}>{item.description}</Text>
                </Pressable>
              ))
            )}
          </>
        ) : (
          <>
            {selected.coverUrl ? (
              <Image
                source={{ uri: resolveMediaUrl(selected.coverUrl) }}
                style={s.detailImage}
                resizeMode="cover"
              />
            ) : null}

            <Text style={[s.detailTitle, { marginTop: 12 }]}>{selected.title}</Text>
            <Text style={s.goldSmall}>{selected.author || "Shekinah Sons Global"}</Text>
            <Text style={[s.mutedText, { color: C.muted, marginTop: 8 }]}>
              {selected.category || "Library"} · {formatBytes(selected.fileSizeBytes)}
            </Text>
            <Text style={s.detailBody}>{selected.description}</Text>

            <Pressable style={s.primaryBtn} onPress={readInApp}>
              <Text style={s.primaryText}>Read in App</Text>
            </Pressable>

            <Pressable style={[s.secondaryBtn, downloading && { opacity: 0.65 }]} onPress={downloadItem} disabled={downloading}>
              <Text style={s.secondaryText}>{downloading ? "Downloading..." : "Download PDF"}</Text>
            </Pressable>

            {downloadedPath ? (
              <Pressable style={s.secondaryBtn} onPress={openDownloaded}>
                <Text style={s.secondaryText}>Open Downloaded PDF</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
