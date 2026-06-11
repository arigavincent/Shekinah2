import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  View
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";

import { C } from "../constants/theme";
import { s } from "../styles/appStyles";
import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { EmptyState } from "../components/Cards";
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
      style={[
        s.plainCard,
        {
          flex: 1,
          minHeight: 72,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.45 : 1,
          borderColor: active ? C.gold : C.line
        }
      ]}
    >
      <Ionicons name={icon} size={22} color={active ? C.gold : C.white} />
      <Text
        style={[
          s.mutedText,
          {
            marginTop: 6,
            color: active ? C.gold : C.muted,
            fontWeight: "800"
          }
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function AudioPlayer({ sermon, go, setMiniPlayer, setDownloadsTab, appLanguage = "en" }) {
  const { data } = useContent();

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

  function keepPlaying() {
    setMiniPlayer(sermon);
    go("Sermons");
  }

  if (!sermon) {
    return (
      <Screen>
        <EmptyState title="No Audio Selected" text="Choose an audio sermon first." />
      </Screen>
    );
  }

  return (
    <Screen>
      <Image source={{ uri: thumbnail }} style={s.audioBg} />
      <View style={s.audioShade} />

      <TopBar title="Audio Player" go={go} back="Sermons" appLanguage={appLanguage} />

      <ScrollView contentContainerStyle={s.audioContent}>
        <Image source={{ uri: thumbnail }} style={s.albumLarge} />

        <Text style={s.audioTitle}>{sermon.title}</Text>
        <Text style={s.mutedText}>{sermon.speaker}</Text>

        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${progress}%` }]} />
        </View>

        <View style={s.timeRow}>
          <Text style={s.mutedText}>{formatTime(positionMs)}</Text>
          <Text style={s.mutedText}>
            {durationMs > 0 ? formatTime(durationMs) : sermon.duration || "0:00"}
          </Text>
        </View>

        {error ? <Text style={s.mutedText}>{error}</Text> : null}
        {statusText ? <Text style={s.mutedText}>{statusText}</Text> : null}
        {!remoteMediaUrl ? (
          <Text style={[s.mutedText, { color: C.gold }]}>No backend audio URL detected.</Text>
        ) : null}
        {downloadProgress > 0 && downloadProgress < 100 ? (
          <Text style={s.mutedText}>Downloading... {downloadProgress}%</Text>
        ) : null}
        {!playbackUrl ? <Text style={s.mutedText}>No uploaded audio URL found.</Text> : null}

        <View style={s.controls}>
          <Pressable style={s.controlBtn} onPress={previousTrack}>
            <Ionicons name="play-skip-back-outline" size={20} color={C.white} />
          </Pressable>

          <Pressable style={s.controlBtn} onPress={() => seekBy(-15000)}>
            <Ionicons name="play-back-outline" size={20} color={C.white} />
          </Pressable>

          <Pressable style={s.controlPrimary} onPress={togglePlay} disabled={loading || !playbackUrl}>
            <Ionicons
              name={loading ? "hourglass-outline" : playing ? "pause" : "play"}
              size={28}
              color={C.black}
            />
          </Pressable>

          <Pressable style={s.controlBtn} onPress={() => seekBy(15000)}>
            <Ionicons name="play-forward-outline" size={20} color={C.white} />
          </Pressable>

          <Pressable style={s.controlBtn} onPress={nextTrack}>
            <Ionicons name="play-skip-forward-outline" size={20} color={C.white} />
          </Pressable>
        </View>

        <Text style={s.categoryPill}>{sermon.category}</Text>

        <Text style={s.mutedText}>
          {currentIndex >= 0 ? `${currentIndex + 1} / ${audioQueue.length} From Audio Sermons` : "Audio Sermon"}
        </Text>

        {downloadedUri ? (
          <Text style={s.mutedText}>Offline audio ready.</Text>
        ) : null}

        <View style={s.bottomActions}>
          <PlayerAction
            icon="repeat-outline"
            label="Repeat"
            active={repeatEnabled}
            disabled={!playbackUrl}
            onPress={toggleRepeat}
          />

          <PlayerAction
            icon={downloadedUri ? "checkmark-circle-outline" : "download-outline"}
            label={downloadedUri ? "Downloaded" : "Download"}
            active={Boolean(downloadedUri)}
            disabled={!remoteMediaUrl}
            onPress={downloadAudio}
          />

          <PlayerAction
            icon="list-outline"
            label="Queue"
            active={showQueue}
            disabled={audioQueue.length === 0}
            onPress={() => setShowQueue(current => !current)}
          />
        </View>

        {showQueue ? (
          <View style={[s.plainCard, { alignSelf: "stretch" }]}>
            <Text style={s.rowTitle}>Audio Queue</Text>

            {audioQueue.map((item, index) => (
              <Pressable
                key={item.id}
                style={[
                  s.listRow,
                  {
                    marginHorizontal: 0,
                    borderColor: item.id === sermon.id ? C.gold : C.line
                  }
                ]}
                onPress={() => switchTrack(item)}
              >
                <Image
                  source={{ uri: sermonThumbnail(item, PHASE1_IMAGES.sermon) }}
                  style={s.rowImage}
                />

                <View style={s.rowBody}>
                  <Text style={s.rowTitle}>
                    {index + 1}. {item.title}
                  </Text>
                  <Text style={s.mutedText}>{item.speaker}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Pressable style={s.primaryBtn} onPress={keepPlaying}>
          <Text style={s.primaryText}>Keep Playing</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}
