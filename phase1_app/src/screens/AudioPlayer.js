import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "../components/Icon";

import { ANDROID_STATUS_BAR_HEIGHT, C, makeThemedStyles } from "../constants/theme";
import { s } from "../styles/appStyles";
import { Screen } from "../components/Screen";
import { AudioArt } from "../components/AudioArt";
import { toggleSermonFavourite, useSermonFavourites } from "../services/sermonFavorites";
import { useNav } from "../navigation/NavContext";
import { PHASE1_IMAGES } from "../content";
import { useContent } from "../providers/ContentProvider";
import {
  isAudioUrl,
  resolveMediaUrl,
  sermonMediaUrl,
  sermonThumbnail
} from "../utils/mediaUrl";
import {
  DOWNLOAD_TYPES,
  registerDownload
} from "../services/downloadsStore";
import {
  getAudioPlaybackState,
  restartAudio,
  seekAudioBy,
  setAudioRepeat,
  subscribeAudioPlayback,
  toggleAudio
} from "../services/audioPlayback";

const FILE_ROOT = FileSystem.documentDirectory || FileSystem.cacheDirectory || "";
const DOWNLOAD_DIR = `${FILE_ROOT}shekinah-audio/`;

function formatTime(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "0:00";

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getExtension(url) {
  const clean = String(url || "").split("?")[0];
  const match = clean.match(/\.(mp3|m4a|aac|wav|ogg)$/i);
  return match ? match[1].toLowerCase() : "mp3";
}

function safeFileName(sermon, mediaUrl) {
  const id = sermon?.id || sermon?.title || mediaUrl || "audio";
  const ext = getExtension(mediaUrl);
  const safe = String(id).replace(/[^a-z0-9_-]/gi, "_").toLowerCase();

  return `${safe}.${ext}`;
}

function PlayerAction({ icon, label, active, disabled, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [ap.action, disabled && { opacity: 0.4 }, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: Boolean(active), disabled: Boolean(disabled) }}
    >
      <Ionicons name={icon} size={22} color={active ? C.accent : "#FFFFFF"} />
      <Text style={[ap.actionLabel, active && { color: C.accentText }]}>{label}</Text>
    </Pressable>
  );
}

function ControlButton({ icon, size = 24, onPress, label }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [ap.control, pressed && { backgroundColor: "rgba(255,255,255,0.12)" }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={size} color="#FFFFFF" />
    </Pressable>
  );
}

export function AudioPlayer({ sermon, go, setMiniPlayer, setDownloadsTab, appLanguage = "en" }) {
  const { data } = useContent();
  const { goBack } = useNav();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [trackWidth, setTrackWidth] = useState(1);
  const { isFavourite } = useSermonFavourites();
  const artScale = React.useRef(new Animated.Value(1)).current;

  const [audioState, setAudioState] = useState(getAudioPlaybackState());
  const [showQueue, setShowQueue] = useState(false);
  const [downloadedUri, setDownloadedUri] = useState("");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    return subscribeAudioPlayback(setAudioState);
  }, []);

  const audioQueue = useMemo(() => {
    const sermons = Array.isArray(data?.sermons) ? data.sermons : [];

    return sermons.filter(item => {
      const url = sermonMediaUrl(item);
      return item?.type === "audio" || isAudioUrl(url);
    });
  }, [data]);

  const currentIndex = useMemo(() => {
    return audioQueue.findIndex(item => item.id === sermon?.id);
  }, [audioQueue, sermon]);

  const sourceSermon = useMemo(() => {
    const fromBackend = audioQueue.find(item => item?.id === sermon?.id);

    return {
      ...(fromBackend || {}),
      ...(sermon || {})
    };
  }, [audioQueue, sermon]);

  const remoteMediaUrl = useMemo(() => {
    return resolveMediaUrl(
      sermonMediaUrl(sermon) ||
        sermonMediaUrl(sourceSermon)
    );
  }, [sermon, sourceSermon]);

  const thumbnail = useMemo(() => {
    return sermonThumbnail(sermon, PHASE1_IMAGES.sermon);
  }, [sermon]);

  const isCurrentActive = audioState.sermon?.id === sermon?.id;
  const playing = isCurrentActive && audioState.playing;
  const loading = isCurrentActive && audioState.loading;
  const positionMs = isCurrentActive ? audioState.positionMs : 0;
  const durationMs = isCurrentActive ? audioState.durationMs : 0;
  const repeatEnabled = audioState.repeatEnabled;
  const playbackUrl = downloadedUri || remoteMediaUrl;
  const progress = durationMs > 0 ? Math.min(100, (positionMs / durationMs) * 100) : 0;
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < audioQueue.length - 1;
  const error = localError || (isCurrentActive ? audioState.error : "");

  useEffect(() => {
    if (remoteMediaUrl) {
      setLocalError("");
    }
  }, [remoteMediaUrl]);

  // Opening a sermon starts it, unless it is already the active track.
  const autoStarted = React.useRef(false);
  useEffect(() => {
    if (autoStarted.current || !sermon?.id || !playbackUrl || isCurrentActive) return;
    autoStarted.current = true;
    togglePlay();
  }, [sermon?.id, playbackUrl, isCurrentActive]);

  // Artwork settles back slightly when paused, like a record lifting.
  useEffect(() => {
    Animated.spring(artScale, { toValue: playing ? 1 : 0.9, friction: 7, tension: 60, useNativeDriver: true }).start();
  }, [playing, artScale]);

  async function seekToFraction(fraction) {
    if (!durationMs) return;
    const target = Math.max(0, Math.min(1, fraction)) * durationMs;
    await seekBy(target - positionMs);
  }

  useEffect(() => {
    async function hydrateDownloadedFile() {
      if (!sermon || !remoteMediaUrl || !FileSystem.documentDirectory) {
        setDownloadedUri("");
        return;
      }

      const localUri = `${DOWNLOAD_DIR}${safeFileName(sermon, remoteMediaUrl)}`;

      try {
        const info = await FileSystem.getInfoAsync(localUri);
        setDownloadedUri(info.exists ? localUri : "");
      } catch {
        setDownloadedUri("");
      }
    }

    hydrateDownloadedFile();
  }, [sermon, remoteMediaUrl]);

  async function togglePlay() {
    try {
      setLocalError("");
      await toggleAudio({ ...sermon, mediaUrl: playbackUrl });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to play audio.");
    }
  }

  async function seekBy(deltaMs) {
    try {
      setLocalError("");

      if (!isCurrentActive) {
        await toggleAudio({ ...sermon, mediaUrl: playbackUrl });
      }

      await seekAudioBy(deltaMs);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to seek audio.");
    }
  }

  async function restartTrack() {
    try {
      setLocalError("");
      await restartAudio({ ...sermon, mediaUrl: playbackUrl });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to restart audio.");
    }
  }

  async function toggleRepeat() {
    try {
      setLocalError("");
      const next = !repeatEnabled;
      await setAudioRepeat(next);
      setStatusText(next ? "Repeat enabled." : "Repeat disabled.");
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to toggle repeat.");
    }
  }

  async function downloadAudio() {
    setLocalError("");

    const baseSermon = {
      ...(sourceSermon || {}),
      ...(sermon || {})
    };

    const downloadUrl =
      remoteMediaUrl ||
      resolveMediaUrl(sermonMediaUrl(baseSermon));

    if (!downloadUrl || downloadUrl.startsWith("file://")) {
      setLocalError("No downloadable remote audio URL found.");
      return;
    }

    if (!FILE_ROOT) {
      setLocalError("Device file system is not available.");
      return;
    }

    const downloadId = `audio:${baseSermon.id || sermon?.id || Date.now()}`;
    const localUri = `${DOWNLOAD_DIR}${safeFileName(baseSermon, downloadUrl)}`;

    try {
      setStatusText("Preparing download...");
      setDownloadProgress(0);

      await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });

      const existing = await FileSystem.getInfoAsync(localUri);

      if (existing.exists) {
        await registerDownload({
          id: downloadId,
          type: DOWNLOAD_TYPES.SERMON_AUDIO,
          title: baseSermon.title || "Audio Sermon",
          speaker: baseSermon.speaker || "",
          thumbnail,
          localUri,
          remoteUri: downloadUrl,
          sermon: {
            ...baseSermon,
            mediaUrl: localUri,
            audioUrl: localUri
          }
        });

        setDownloadedUri(localUri);
        setDownloadProgress(100);
        setStatusText("Already downloaded for offline playback.");
        setDownloadsTab?.("Sermons");
        go("Downloads");
        return;
      }

      const download = FileSystem.createDownloadResumable(
        downloadUrl,
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
        throw new Error("Download failed.");
      }

      await registerDownload({
        id: downloadId,
        type: DOWNLOAD_TYPES.SERMON_AUDIO,
        title: baseSermon.title || "Audio Sermon",
        speaker: baseSermon.speaker || "",
        thumbnail,
        localUri: result.uri,
        remoteUri: downloadUrl,
        sermon: {
          ...baseSermon,
          mediaUrl: result.uri,
          audioUrl: result.uri
        }
      });

      setDownloadedUri(result.uri);
      setDownloadProgress(100);
      setStatusText("Downloaded for offline playback.");
      setDownloadsTab?.("Sermons");
      go("Downloads");
    } catch (err) {
      setStatusText("");
      setDownloadProgress(0);
      setLocalError(err instanceof Error ? err.message : "Failed to download audio.");
    }
  }

  function switchTrack(nextSermon) {
    if (!nextSermon) return;
    setStatusText("");
    setLocalError("");
    go("AudioPlayer", nextSermon);
  }

  function previousTrack() {
    if (!hasPrevious) {
      restartTrack();
      return;
    }

    switchTrack(audioQueue[currentIndex - 1]);
  }

  function nextTrack() {
    if (!hasNext) {
      seekBy(durationMs || 0);
      return;
    }

    switchTrack(audioQueue[currentIndex + 1]);
  }

  function minimise() {
    setMiniPlayer(sermon);
    goBack("Sermons");
  }

  if (!sermon) {
    return (
      <Screen>
        <View style={ap.emptyWrap}>
          <Ionicons name="musical-notes-outline" size={46} color={C.faint} />
          <Text style={ap.emptyTitle}>No audio selected</Text>
          <Text style={ap.emptyText}>Choose an audio sermon to start listening.</Text>
        </View>
      </Screen>
    );
  }

  const artSize = Math.min(width - 64, 360);
  const status = error || statusText || (!remoteMediaUrl ? "Audio is not available for this item yet." : "");

  return (
    <Screen>
      <Image source={{ uri: thumbnail }} style={StyleSheet.absoluteFill} blurRadius={40} />
      <LinearGradient
        colors={["rgba(212,175,55,0.30)", "rgba(10,8,2,0.82)", "#000000"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[ap.header, { paddingTop: ANDROID_STATUS_BAR_HEIGHT + 6 }]}>
        <ControlButton icon="chevron-down" label="Minimise player" onPress={minimise} />
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={ap.eyebrow}>PLAYING FROM</Text>
          <Text style={ap.headerTitle} numberOfLines={1}>Audio Sermons</Text>
        </View>
        <Pressable
          onPress={() => toggleSermonFavourite(sermon)}
          hitSlop={8}
          style={({ pressed }) => [ap.control, pressed && { backgroundColor: "rgba(255,255,255,0.12)" }]}
          accessibilityRole="button"
          accessibilityState={{ selected: isFavourite(sermon.id) }}
          accessibilityLabel={isFavourite(sermon.id) ? "Remove from saved sermons" : "Save sermon"}
        >
          <Ionicons name={isFavourite(sermon.id) ? "heart" : "heart-outline"} size={22} color={isFavourite(sermon.id) ? C.red : "#FFFFFF"} />
        </Pressable>
        <ControlButton
          icon="share-social-outline"
          label="Share sermon"
          size={21}
          onPress={() => Share.share({ message: `${sermon.title}${sermon.speaker ? ` · ${sermon.speaker}` : ""}` })}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ alignItems: "center", paddingHorizontal: 24, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[ap.artShadow, { marginTop: 16, transform: [{ scale: artScale }] }]}>
          <AudioArt item={sermon} size={artSize} radius={22} />
        </Animated.View>

        <View style={ap.meta}>
          <Text style={ap.title} numberOfLines={3}>{sermon.title}</Text>
          {sermon.speaker ? <Text style={ap.speaker}>{sermon.speaker}</Text> : null}
        </View>

        <Pressable
          style={ap.seekArea}
          onLayout={event => setTrackWidth(event.nativeEvent.layout.width || 1)}
          onPress={event => seekToFraction(event.nativeEvent.locationX / trackWidth)}
          accessibilityRole="adjustable"
          accessibilityLabel={`Position ${formatTime(positionMs)} of ${formatTime(durationMs)}`}
        >
          <View style={ap.track}>
            <View style={[ap.trackFill, { width: `${progress}%` }]} />
            <View style={[ap.thumb, { left: `${progress}%` }]} />
          </View>
        </Pressable>
        <View style={ap.timeRow}>
          <Text style={ap.time}>{formatTime(positionMs)}</Text>
          <Text style={ap.time}>{durationMs > 0 ? formatTime(durationMs) : sermon.duration || "0:00"}</Text>
        </View>

        <View style={ap.controls}>
          <ControlButton icon="play-skip-back" label="Previous" onPress={previousTrack} />
          <ControlButton icon="play-back" label="Back 15 seconds" onPress={() => seekBy(-15000)} />
          <Pressable
            onPress={togglePlay}
            disabled={loading || !playbackUrl}
            style={({ pressed }) => [ap.playBtn, (loading || !playbackUrl) && { opacity: 0.5 }, pressed && { transform: [{ scale: 0.95 }] }]}
            accessibilityRole="button"
            accessibilityLabel={playing ? "Pause" : "Play"}
          >
            {loading ? (
              <ActivityIndicator size="large" color={C.textOnAccent} />
            ) : (
              <Ionicons name={playing ? "pause" : "play"} size={32} color={C.textOnAccent} />
            )}
          </Pressable>
          <ControlButton icon="play-forward" label="Forward 15 seconds" onPress={() => seekBy(15000)} />
          <ControlButton icon="play-skip-forward" label="Next" onPress={nextTrack} />
        </View>

        {status ? <Text style={ap.status}>{status}</Text> : null}
        {downloadProgress > 0 && downloadProgress < 100 ? (
          <Text style={ap.status}>Downloading… {downloadProgress}%</Text>
        ) : null}

        <View style={ap.glassRow}>
          <PlayerAction icon="repeat-outline" label="Repeat" active={repeatEnabled} disabled={!playbackUrl} onPress={toggleRepeat} />
          <PlayerAction
            icon={downloadedUri ? "checkmark-circle" : "download-outline"}
            label={downloadedUri ? "Offline" : "Download"}
            active={Boolean(downloadedUri)}
            disabled={!remoteMediaUrl}
            onPress={downloadAudio}
          />
          <PlayerAction icon="list-outline" label="Up next" active={showQueue} disabled={audioQueue.length === 0} onPress={() => setShowQueue(current => !current)} />
        </View>

        {currentIndex >= 0 ? (
          <Text style={ap.position}>{`${currentIndex + 1} of ${audioQueue.length} · Audio Sermons`}</Text>
        ) : null}

        {showQueue ? (
          <View style={ap.queue}>
            <Text style={ap.queueTitle}>Up next</Text>
            {audioQueue.map((item, index) => {
              const current = item.id === sermon.id;
              return (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [ap.queueRow, pressed && { opacity: 0.7 }]}
                  onPress={() => switchTrack(item)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: current }}
                >
                  <AudioArt item={item} size={52} variant="thumb" radius={10} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[ap.queueItem, current && { color: C.gold }]} numberOfLines={2}>{item.title}</Text>
                    <Text style={ap.queueMeta} numberOfLines={1}>{[item.speaker, item.date].filter(Boolean).join(" · ")}</Text>
                  </View>
                  {current ? <Ionicons name="volume-high-outline" size={18} color={C.gold} /> : <Text style={ap.queueIndex}>{index + 1}</Text>}
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const ap = makeThemedStyles(C => ({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingBottom: 4 },
  eyebrow: { color: "rgba(255,255,255,0.6)", fontSize: 10, fontFamily: C.fontBold, letterSpacing: 1.6 },
  headerTitle: { color: "#FFFFFF", fontSize: 14, fontFamily: C.fontBold, marginTop: 1 },
  artShadow: { borderRadius: 22, elevation: 18, shadowColor: "#000", shadowOpacity: 0.6, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } },
  meta: { alignSelf: "stretch", marginTop: 28 },
  title: { color: "#FFFFFF", fontSize: 22, lineHeight: 28, fontFamily: C.fontBold },
  speaker: { color: C.gold2, fontSize: 15, fontFamily: C.fontMedium, marginTop: 6 },
  seekArea: { alignSelf: "stretch", paddingVertical: 14, marginTop: 14 },
  track: { height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)" },
  trackFill: { height: 4, borderRadius: 2, backgroundColor: C.accent },
  thumb: { position: "absolute", top: -5, width: 14, height: 14, marginLeft: -7, borderRadius: 7, backgroundColor: "#FFFFFF" },
  timeRow: { alignSelf: "stretch", flexDirection: "row", justifyContent: "space-between" },
  time: { color: "rgba(255,255,255,0.65)", fontSize: 12, fontFamily: C.fontMedium, fontVariant: ["tabular-nums"] },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", alignSelf: "stretch", marginTop: 18 },
  control: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  playBtn: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: C.gold,
    alignItems: "center",
    justifyContent: "center",
    elevation: 10,
    shadowColor: C.gold,
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 }
  },
  status: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: C.fontBody, textAlign: "center", marginTop: 12 },
  glassRow: {
    flexDirection: "row",
    alignSelf: "stretch",
    marginTop: 26,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.18)"
  },
  action: { flex: 1, alignItems: "center", gap: 5, paddingVertical: 4 },
  actionLabel: { color: "rgba(255,255,255,0.75)", fontSize: 11.5, fontFamily: C.fontMedium },
  position: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontFamily: C.fontBody, marginTop: 14 },
  queue: { alignSelf: "stretch", marginTop: 20, borderRadius: 18, padding: 14, backgroundColor: "rgba(0,0,0,0.45)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.12)" },
  queueTitle: { color: "#FFFFFF", fontSize: 16, fontFamily: C.fontBold, marginBottom: 6 },
  queueRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  queueItem: { color: "#FFFFFF", fontSize: 14, lineHeight: 19, fontFamily: C.fontMedium },
  queueMeta: { color: "rgba(255,255,255,0.55)", fontSize: 12, fontFamily: C.fontBody, marginTop: 2 },
  queueIndex: { color: "rgba(255,255,255,0.45)", fontSize: 12, fontFamily: C.fontBold, width: 22, textAlign: "right" },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
  emptyTitle: { color: C.white, fontSize: 19, fontFamily: C.fontBold },
  emptyText: { color: C.muted, fontSize: 14, fontFamily: C.fontBody, textAlign: "center" }
}));
