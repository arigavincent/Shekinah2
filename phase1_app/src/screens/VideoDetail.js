import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ResizeMode, Video } from "expo-av";
import YoutubePlayer from "react-native-youtube-iframe";
import * as ScreenOrientation from "expo-screen-orientation";
import * as FileSystem from "expo-file-system/legacy";

import { PHASE1_IMAGES } from "../content";
import { C } from "../constants/theme";
import { s } from "../styles/appStyles";
import { useContent } from "../providers/ContentProvider";
import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { SectionHeader } from "../components/SectionHeader";
import {
  DOWNLOAD_TYPES,
  registerDownload
} from "../services/downloadsStore";
import {
  extractYouTubeId,
  isAudioUrl,
  isVideoUrl,
  resolveMediaUrl,
  sermonMediaUrl,
  sermonThumbnail
} from "../utils/mediaUrl";

const { width } = Dimensions.get("window");

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

function youtubeWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

async function lockLandscape() {
  try {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
  } catch (error) {
    console.warn("Failed to lock landscape", error);
  }
}

async function lockPortrait() {
  try {
    await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  } catch (error) {
    console.warn("Failed to lock portrait", error);
  }
}

export function VideoDetail({ sermon, go, openSermon, setDownloadsTab }) {
  const { data } = useContent();
  const videoRef = useRef(null);
  const [youtubePlaying, setYoutubePlaying] = useState(false);
  const [downloadedUri, setDownloadedUri] = useState("");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState("");
  const [downloadError, setDownloadError] = useState("");

  const related = data.sermons.filter(item => item.id !== sermon?.id);

  const rawUrl = sermonMediaUrl(sermon);
  const resolvedUrl = resolveMediaUrl(rawUrl);

  const videoId = extractYouTubeId(rawUrl);
  const hasYouTubeVideo = Boolean(videoId);
  const hasDirectVideo = Boolean(rawUrl && !hasYouTubeVideo && isVideoUrl(rawUrl));
  const hasAudio = Boolean(rawUrl && isAudioUrl(rawUrl));

  const thumbnail = sermonThumbnail(sermon, PHASE1_IMAGES.sermon);

  const onFullScreenChange = useCallback(async isFullScreen => {
    if (isFullScreen) {
      await lockLandscape();
      return;
    }

    await lockPortrait();
  }, []);

  function openYoutubeExternal() {
    if (!videoId) return;
    Linking.openURL(youtubeWatchUrl(videoId));
  }

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

  return (
    <Screen>
      <TopBar title={hasAudio ? "Audio Sermon" : "Video Sermon"} go={go} back="Sermons" />

      <ScrollView contentContainerStyle={s.scrollPad}>
        <View style={s.videoBox}>
          {hasYouTubeVideo ? (
            <YoutubePlayer
              height={width * (9 / 16)}
              width={width - 28}
              play={youtubePlaying}
              videoId={videoId}
              onFullScreenChange={onFullScreenChange}
              webViewProps={{
                allowsFullscreenVideo: true,
                mediaPlaybackRequiresUserAction: false
              }}
            />
          ) : hasDirectVideo ? (
            <Video
              ref={videoRef}
              source={{ uri: resolvedUrl }}
              style={s.videoImage}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              shouldPlay={false}
              onFullscreenUpdate={async event => {
                const update = event.fullscreenUpdate;

                // 1 = player did present fullscreen
                // 3 = player did dismiss fullscreen
                if (update === 1) {
                  await lockLandscape();
                }

                if (update === 3) {
                  await lockPortrait();
                }
              }}
            />
          ) : (
            <>
              <Image source={{ uri: thumbnail }} style={s.videoImage} />

              <View style={s.videoOverlay}>
                <View style={s.playLarge}>
                  <Ionicons name={hasAudio ? "musical-notes" : "play"} size={28} color={C.black} />
                </View>
              </View>
            </>
          )}
        </View>

        {hasYouTubeVideo ? (
          <Pressable
            style={s.plainCard}
            onPress={() => setYoutubePlaying(current => !current)}
          >
            <Text style={s.rowTitle}>
              {youtubePlaying ? "Pause YouTube Video" : "Play YouTube Video"}
            </Text>
            <Text style={s.mutedText}>
              Uses embedded YouTube player. If blocked, open externally below.
            </Text>
          </Pressable>
        ) : null}

        {hasYouTubeVideo ? (
          <Pressable style={s.plainCard} onPress={openYoutubeExternal}>
            <Text style={s.rowTitle}>Watch on YouTube</Text>
            <Text style={s.mutedText}>Fallback for videos that block embedded playback.</Text>
          </Pressable>
        ) : null}

        {hasAudio ? (
          <Pressable style={s.plainCard} onPress={() => go("AudioPlayer", sermon)}>
            <Text style={s.rowTitle}>Audio sermon available</Text>
            <Text style={s.mutedText}>Tap to open audio player.</Text>
          </Pressable>
        ) : null}

        {hasDirectVideo ? (
          <Pressable style={s.plainCard} onPress={downloadVideo}>
            <View style={s.rowTight}>
              <Ionicons
                name={downloadedUri ? "checkmark-circle-outline" : "download-outline"}
                size={20}
                color={C.gold}
              />

              <View style={{ flex: 1 }}>
                <Text style={[s.rowTitle, { color: C.white }]}>
                  {downloadedUri ? "Video downloaded" : "Download video"}
                </Text>

                <Text style={[s.mutedText, { color: C.muted }]}>
                  Save this uploaded sermon video for offline playback.
                </Text>
              </View>
            </View>

            {downloadProgress > 0 && downloadProgress < 100 ? (
              <Text style={[s.goldSmall, { color: C.gold, marginTop: 8 }]}>
                Downloading... {downloadProgress}%
              </Text>
            ) : null}

            {downloadStatus ? (
              <Text style={[s.goldSmall, { color: C.gold, marginTop: 8 }]}>
                {downloadStatus}
              </Text>
            ) : null}

            {downloadError ? (
              <Text style={[s.mutedText, { color: C.gold, marginTop: 8 }]}>
                {downloadError}
              </Text>
            ) : null}
          </Pressable>
        ) : null}

        {hasYouTubeVideo ? (
          <View style={s.plainCard}>
            <Text style={[s.rowTitle, { color: C.white }]}>Download unavailable</Text>
            <Text style={[s.mutedText, { color: C.muted }]}>
              YouTube videos cannot be downloaded inside the app. Use Watch on YouTube.
            </Text>
          </View>
        ) : null}

        {!hasDirectVideo && !hasYouTubeVideo && !hasAudio ? (
          <View style={s.plainCard}>
            <Text style={s.rowTitle}>No playable media</Text>
            <Text style={s.mutedText}>
              Upload a video/audio file or add a YouTube link in the admin dashboard.
            </Text>
          </View>
        ) : null}

        <Text style={s.detailTitle}>{sermon?.title}</Text>

        <Text style={s.goldSmall}>
          {sermon?.speaker} - {sermon?.date || sermon?.sermonDate}
        </Text>

        <Text style={s.detailBody}>{sermon?.description}</Text>

        <SectionHeader title="Related Sermons" />

        {related.map(item => (
          <Pressable key={item.id} style={s.listRow} onPress={() => openSermon(item)}>
            <Image
              source={{ uri: sermonThumbnail(item, PHASE1_IMAGES.sermon) }}
              style={s.rowImage}
            />

            <View style={s.rowBody}>
              <Text style={s.rowTitle}>{item.title}</Text>
              <Text style={s.mutedText}>{item.date || item.sermonDate}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
