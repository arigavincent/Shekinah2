import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { PHASE1_IMAGES } from "../content";
import { C } from "../constants/theme";
import { tr } from "../i18n/labels";
import { s } from "../styles/appStyles";
import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { Tabs } from "../components/Tabs";
import {
  DOWNLOAD_TYPES,
  deleteDownload,
  formatBytes,
  listDownloads
} from "../services/downloadsStore";

const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024 * 1024;

function DownloadRow({ item, onOpen, onDelete, appLanguage }) {
  const isAudio = item.type === DOWNLOAD_TYPES.SERMON_AUDIO;
  const isVideo = item.type === DOWNLOAD_TYPES.SERMON_VIDEO;

  return (
    <Pressable style={s.listRow} onPress={onOpen}>
      <Image
        source={{ uri: item.thumbnail || PHASE1_IMAGES.sermon }}
        style={s.rowImage}
      />

      <View style={s.rowBody}>
        <Text style={[s.rowTitle, { color: C.white }]}>{item.title}</Text>

        <Text style={[s.mutedText, { color: C.muted }]} numberOfLines={1}>
          {tr(appLanguage, isAudio ? "Audio sermon" : isVideo ? "Video sermon" : "Download")} · {formatBytes(item.sizeBytes)}
        </Text>

        {item.speaker ? (
          <Text style={[s.goldSmall, { color: C.gold }]} numberOfLines={1}>
            {item.speaker}
          </Text>
        ) : null}
      </View>

      <Pressable
        style={s.playDot}
        onPress={event => {
          event?.stopPropagation?.();
          onDelete();
        }}
      >
        <Ionicons name="trash-outline" size={18} color={C.white} />
      </Pressable>
    </Pressable>
  );
}

function BibleVersionCard({ go, appLanguage }) {
  return (
    <View style={s.plainCard}>
      <View style={s.rowTight}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: C.goldSoft,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: C.gold
          }}
        >
          <Ionicons name="book-outline" size={21} color={C.gold} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[s.rowTitle, { color: C.white }]}>English KJV</Text>
          <Text style={[s.mutedText, { color: C.muted }]}>
            {tr(appLanguage, "Bundled offline")} · 66 books · 31,102 verses
          </Text>
          <Text style={[s.goldSmall, { color: C.gold }]}>{tr(appLanguage, "Available offline")}</Text>
        </View>
      </View>

      <Pressable style={[s.primaryBtn, { marginTop: 14 }]} onPress={() => go("Bible")}>
        <Text style={s.primaryText}>{tr(appLanguage, "Open Bible")}</Text>
      </Pressable>
    </View>
  );
}

export function DownloadsScreen({ go, tab, setTab, appLanguage = "en" }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const sermonDownloads = useMemo(() => {
    return items.filter(item =>
      item.type === DOWNLOAD_TYPES.SERMON_AUDIO ||
      item.type === DOWNLOAD_TYPES.SERMON_VIDEO
    );
  }, [items]);

  const usedBytes = useMemo(() => {
    return items.reduce((total, item) => total + Number(item.sizeBytes || 0), 0);
  }, [items]);
  const usagePercent = Math.max(0, Math.min(100, Math.round((usedBytes / STORAGE_LIMIT_BYTES) * 100)));
  const usageBarWidth = usedBytes > 0 ? Math.max(4, usagePercent) : 0;

  async function load() {
    setLoading(true);

    try {
      const next = await listDownloads();
      setItems(next);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function removeItem(item) {
    Alert.alert(
      tr(appLanguage, "Delete Download"),
      `${tr(appLanguage, "Remove")} "${item.title}" ${tr(appLanguage, "from this device?")}`,
      [
        { text: tr(appLanguage, "Cancel"), style: "cancel" },
        {
          text: tr(appLanguage, "Delete"),
          style: "destructive",
          onPress: async () => {
            const next = await deleteDownload(item.id);
            setItems(next);
          }
        }
      ]
    );
  }

  function openDownload(item) {
    if (item.type === DOWNLOAD_TYPES.SERMON_AUDIO && item.sermon) {
      go("AudioPlayer", {
        ...item.sermon,
        mediaUrl: item.localUri,
        audioUrl: item.localUri
      });
      return;
    }

    if (item.type === DOWNLOAD_TYPES.SERMON_VIDEO && item.sermon) {
      go("VideoDetail", {
        ...item.sermon,
        mediaUrl: item.localUri,
        videoUrl: item.localUri
      });
      return;
    }

    Alert.alert(tr(appLanguage, "Download"), tr(appLanguage, "This download cannot be opened yet."));
  }

  return (
    <Screen>
      <TopBar
        title="Downloads"
        go={go}
        back="Home"
        appLanguage={appLanguage}
      />

      <Tabs
        tabs={["Sermons", "Bible Versions"]}
        active={tab}
        setActive={setTab}
        appLanguage={appLanguage}
      />

      <ScrollView
        contentContainerStyle={s.scrollPad}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            tintColor={C.gold}
            colors={[C.gold]}
            progressBackgroundColor={C.surface2}
          />
        }
      >
        <View style={s.plainCard}>
          <Text style={[s.goldSmall, { color: C.gold }]}>{tr(appLanguage, "Device Storage")}</Text>
          <Text style={[s.rowTitle, { color: C.white }]}>
            Using {formatBytes(usedBytes)} of {formatBytes(STORAGE_LIMIT_BYTES)}
          </Text>
          <Text style={[s.mutedText, { color: C.muted }]}>
            {sermonDownloads.length} sermon download{sermonDownloads.length === 1 ? "" : "s"} stored locally on this device.
          </Text>

          <View style={[s.storage, { marginTop: 12 }]}>
            <View style={[s.storageFill, { width: `${usageBarWidth}%` }]} />
          </View>

          <Text style={[s.goldSmall, { color: C.gold, marginTop: 0 }]}>
            {usagePercent}% used
          </Text>
        </View>

        {tab === "Sermons" ? (
          loading ? (
            <View style={s.plainCard}>
              <Text style={[s.rowTitle, { color: C.white }]}>{tr(appLanguage, "Loading downloads...")}</Text>
            </View>
          ) : sermonDownloads.length === 0 ? (
            <View style={s.plainCard}>
              <Text style={[s.rowTitle, { color: C.white }]}>{tr(appLanguage, "No sermon downloads")}</Text>
              <Text style={[s.mutedText, { color: C.muted }]}>
                {tr(appLanguage, "Open an audio sermon and tap Download to save it offline.")}
              </Text>
            </View>
          ) : (
            sermonDownloads.map(item => (
              <DownloadRow
                key={item.id}
                item={item}
                appLanguage={appLanguage}
                onOpen={() => openDownload(item)}
                onDelete={() => removeItem(item)}
              />
            ))
          )
        ) : (
          <>
            <BibleVersionCard go={go} appLanguage={appLanguage} />

            <View style={s.plainCard}>
              <Text style={[s.rowTitle, { color: C.white }]}>{tr(appLanguage, "More versions coming later")}</Text>
              <Text style={[s.mutedText, { color: C.muted }]}>
                {tr(appLanguage, "Additional translations require licensing or public-domain sources.")}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
