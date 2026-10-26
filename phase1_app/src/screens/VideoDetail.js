import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { Ionicons } from "../components/Icon";
import { SermonVideoPlayer } from "../components/SermonVideoPlayer";
import * as FileSystem from "expo-file-system/legacy";

import { PHASE1_IMAGES } from "../content";
import { C, makeThemedStyles } from "../constants/theme";
import { s } from "../styles/appStyles";
import { useContent } from "../providers/ContentProvider";
import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import {
  DOWNLOAD_TYPES,
  registerDownload
} from "../services/downloadsStore";
import {
  isAudioUrl,
  isVideoUrl,
  resolveMediaUrl,
  sermonMediaUrl,
  sermonThumbnail
} from "../utils/mediaUrl";

const FILE_ROOT = FileSystem.documentDirectory || FileSystem.cacheDirectory || "";
const VIDEO_DOWNLOAD_DIR = `${FILE_ROOT}shekinah-videos/`;

function safeVideoFileName(sermon, url) {
  const rawTitle = sermon?.title || sermon?.id || "video-sermon";
  const slug = String(rawTitle)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  const cleanUrl = String(url || "").split("?")[0];
  const extensionMatch = cleanUrl.match(/\.(mp4|m4v|mov|webm)$/i);
  const extension = extensionMatch?.[0]?.toLowerCase() || ".mp4";

  return `${sermon?.id || slug}-${slug}${extension}`;
}


export function VideoDetail({ sermon, go, openSermon, setDownloadsTab, appLanguage = "en" }) {
  const { data } = useContent();
  const { width } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);
  const [downloadedUri, setDownloadedUri] = useState("");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState("");
  const [downloadError, setDownloadError] = useState("");

  const related = data.sermons.filter(item => item.id !== sermon?.id && item.type === sermon?.type).slice(0, 20);

  const rawUrl = sermonMediaUrl(sermon);
  const resolvedUrl = resolveMediaUrl(rawUrl);

  const hasDirectVideo = Boolean(rawUrl && isVideoUrl(rawUrl));
  const hasAudio = Boolean(rawUrl && isAudioUrl(rawUrl));
  // Streams (HLS) play adaptively online; only single-file videos can be saved offline.
  const canDownload = hasDirectVideo && !/\.m3u8(\?|$)/i.test(resolvedUrl);

  const thumbnail = sermonThumbnail(sermon, PHASE1_IMAGES.sermon);


  useEffect(() => {
    async function hydrateDownloadedVideo() {
      if (!hasDirectVideo || !resolvedUrl || !FILE_ROOT) {
        setDownloadedUri("");
        return;
      }

      const localUri = `${VIDEO_DOWNLOAD_DIR}${safeVideoFileName(sermon, resolvedUrl)}`;

      try {
        const info = await FileSystem.getInfoAsync(localUri);
        setDownloadedUri(info.exists ? localUri : "");
      } catch {
        setDownloadedUri("");
      }
    }

    hydrateDownloadedVideo();
  }, [hasDirectVideo, resolvedUrl, sermon]);

  async function downloadVideo() {
    setDownloadError("");

    if (!hasDirectVideo || !resolvedUrl || resolvedUrl.startsWith("file://")) {
      setDownloadError("Only uploaded/direct video files can be downloaded.");
      return;
    }

    if (!FILE_ROOT) {
      setDownloadError("Device file system is not available.");
      return;
    }

    const localUri = `${VIDEO_DOWNLOAD_DIR}${safeVideoFileName(sermon, resolvedUrl)}`;
    const downloadId = `video:${sermon?.id || Date.now()}`;

    try {
      setDownloadStatus("Preparing video download...");
      setDownloadProgress(0);

      await FileSystem.makeDirectoryAsync(VIDEO_DOWNLOAD_DIR, { intermediates: true });

      const existing = await FileSystem.getInfoAsync(localUri);

      if (existing.exists) {
        await registerDownload({
          id: downloadId,
          type: DOWNLOAD_TYPES.SERMON_VIDEO,
          title: sermon?.title || "Video Sermon",
          speaker: sermon?.speaker || "",
          thumbnail,
          localUri,
          remoteUri: resolvedUrl,
          sermon: {
            ...sermon,
            mediaUrl: localUri,
            videoUrl: localUri
          }
        });

        setDownloadedUri(localUri);
        setDownloadProgress(100);
        setDownloadStatus("Already downloaded for offline playback.");
        setDownloadsTab?.("Sermons");
        go("Downloads");
        return;
      }

      const download = FileSystem.createDownloadResumable(
        resolvedUrl,
        localUri,
        {},
        progressEvent => {
          const total = progressEvent.totalBytesExpectedToWrite || 0;
          const written = progressEvent.totalBytesWritten || 0;

          if (total > 0) {
            setDownloadProgress(Math.round((written / total) * 100));
          }
        }
      );

      const result = await download.downloadAsync();

      if (!result?.uri) {
        throw new Error("Video download failed.");
      }

      await registerDownload({
        id: downloadId,
        type: DOWNLOAD_TYPES.SERMON_VIDEO,
        title: sermon?.title || "Video Sermon",
        speaker: sermon?.speaker || "",
        thumbnail,
        localUri: result.uri,
        remoteUri: resolvedUrl,
        sermon: {
          ...sermon,
          mediaUrl: result.uri,
          videoUrl: result.uri
        }
      });

      setDownloadedUri(result.uri);
      setDownloadProgress(100);
      setDownloadStatus("Downloaded for offline playback.");
      setDownloadsTab?.("Sermons");
      go("Downloads");
    } catch (error) {
      setDownloadStatus("");
      setDownloadProgress(0);
      setDownloadError(error instanceof Error ? error.message : "Failed to download video.");
    }
  }

  const playerHeight = Math.round((width * 9) / 16);
  const meta = [sermon?.speaker, sermon?.date || sermon?.sermonDate].filter(Boolean).join(" · ");

  return (
    <Screen>
      <TopBar title={sermon?.title || (hasAudio ? "Audio Sermon" : "Video Sermon")} go={go} back="Sermons" appLanguage={appLanguage} />

      <View style={[vd.player, { height: playerHeight }]}>
        {hasDirectVideo ? (
          <SermonVideoPlayer
            sermon={sermon}
            source={downloadedUri || resolvedUrl}
            poster={thumbnail}
            height={playerHeight}
          />
        ) : (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => (hasAudio ? go("AudioPlayer", sermon) : null)}
            accessibilityRole="button"
          >
            <Image source={{ uri: thumbnail }} style={StyleSheet.absoluteFill} />
            <View style={vd.overlay}>
              <View style={vd.bigPlay}>
                <Ionicons name={hasAudio ? "musical-notes" : "play"} size={28} color={C.textOnAccent} />
              </View>
              <Text style={vd.overlayText}>
                {hasAudio ? "Listen to this sermon" : "This sermon isn't available yet"}
              </Text>
            </View>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Pressable
          style={({ pressed }) => [vd.titleRow, pressed && { backgroundColor: C.surface }]}
          onPress={() => setExpanded(current => !current)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${sermon?.title}. ${expanded ? "Hide details" : "Show details"}`}
        >
          <View style={{ flex: 1 }}>
            <Text style={vd.title} numberOfLines={expanded ? undefined : 2}>{sermon?.title}</Text>
            {meta ? <Text style={vd.meta}>{meta}</Text> : null}
          </View>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={20} color={C.muted} />
        </Pressable>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={vd.chips}>
          <ActionChip icon="share-social-outline" label="Share" onPress={() => Share.share({ message: `${sermon?.title}${sermon?.speaker ? ` · ${sermon.speaker}` : ""}` })} />
          {canDownload ? (
            <ActionChip
              icon={downloadedUri ? "checkmark-circle" : "download-outline"}
              label={downloadedUri ? "Downloaded" : downloadProgress > 0 && downloadProgress < 100 ? `${downloadProgress}%` : "Download"}
              active={Boolean(downloadedUri)}
              onPress={downloadVideo}
            />
          ) : null}
          {hasAudio ? <ActionChip icon="musical-notes-outline" label="Listen" onPress={() => go("AudioPlayer", sermon)} /> : null}
        </ScrollView>

        {downloadStatus || downloadError ? (
          <Text style={[vd.notice, downloadError && { color: C.red }]}>{downloadError || downloadStatus}</Text>
        ) : null}

        {expanded ? (
          <View style={vd.details}>
            {sermon?.category ? <Text style={vd.category}>{sermon.category}</Text> : null}
            <Text style={vd.description}>{sermon?.description || "No description for this sermon yet."}</Text>
          </View>
        ) : null}

        <View style={vd.divider} />
        <Text style={vd.upNext}>Up next</Text>

        {related.map(item => (
          <Pressable
            key={item.id}
            style={({ pressed }) => [vd.row, pressed && { opacity: 0.7 }]}
            onPress={() => openSermon(item)}
            accessibilityRole="button"
            accessibilityLabel={item.title}
          >
            <Image source={{ uri: sermonThumbnail(item, PHASE1_IMAGES.sermon) }} style={vd.rowThumb} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={vd.rowTitle} numberOfLines={3}>{item.title}</Text>
              <Text style={vd.rowMeta} numberOfLines={1}>{item.date || item.sermonDate}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

function ActionChip({ icon, label, onPress, active }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [vd.chip, active && vd.chipActive, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={16} color={active ? C.accent : C.white} />
      <Text style={[vd.chipText, active && { color: C.accentText }]}>{label}</Text>
    </Pressable>
  );
}

const vd = makeThemedStyles(C => ({
  player: { width: "100%", backgroundColor: "#000" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", gap: 10 },
  bigPlay: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.gold, alignItems: "center", justifyContent: "center" },
  overlayText: { color: "#FFFFFF", fontSize: 13, fontFamily: C.fontMedium },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  title: { color: C.white, fontSize: 17, lineHeight: 23, fontFamily: C.fontBold },
  meta: { color: C.muted, fontSize: 13, fontFamily: C.fontBody, marginTop: 5 },
  chips: { gap: 8, paddingHorizontal: 16, paddingBottom: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: C.surface2, borderRadius: 999, paddingHorizontal: 14, height: 38 },
  chipActive: { backgroundColor: C.accentSoft },
  chipText: { color: C.white, fontSize: 13, fontFamily: C.fontBold },
  notice: { color: C.accentText, fontSize: 13, fontFamily: C.fontMedium, paddingHorizontal: 16, marginTop: 6 },
  details: { marginHorizontal: 16, marginTop: 10, padding: 14, borderRadius: 14, backgroundColor: C.surface },
  category: { color: C.gold, fontSize: 11.5, fontFamily: C.fontBold, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 },
  description: { color: C.white, fontSize: 14.5, lineHeight: 22, fontFamily: C.fontBody, opacity: 0.85 },
  hint: { color: C.faint, fontSize: 12, fontFamily: C.fontBody, marginTop: 10 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.lineStrong, marginTop: 14 },
  upNext: { color: C.white, fontSize: 16, fontFamily: C.fontBold, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 10 },
  rowThumb: { width: 150, aspectRatio: 16 / 9, borderRadius: 10, backgroundColor: C.surface2 },
  rowTitle: { color: C.white, fontSize: 14.5, lineHeight: 20, fontFamily: C.fontMedium },
  rowMeta: { color: C.muted, fontSize: 12.5, fontFamily: C.fontBody, marginTop: 4 }
}));
