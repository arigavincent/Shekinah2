import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { C, makeThemedStyles } from "../constants/theme";
import { PHASE1_IMAGES } from "../content";
import { sermonThumbnail } from "../utils/mediaUrl";
import {
  getAudioPlaybackState,
  stopAudioCompletely,
  subscribeAudioPlayback,
  toggleAudio
} from "../services/audioPlayback";

function formatTime(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "0:00";

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function MiniPlayer({ item, sermon, onOpen, onClose }) {
  const [audioState, setAudioState] = useState(getAudioPlaybackState());

  useEffect(() => {
    return subscribeAudioPlayback(setAudioState);
  }, []);

  const activeItem = audioState.sermon || item || sermon;

  const thumbnail = useMemo(() => {
    return sermonThumbnail(activeItem, PHASE1_IMAGES.sermon);
  }, [activeItem]);

  const progress =
    audioState.durationMs > 0
      ? Math.min(100, (audioState.positionMs / audioState.durationMs) * 100)
      : 0;

  async function toggle() {
    if (!activeItem) return;

    try {
      await toggleAudio(activeItem);
    } catch (error) {
      console.warn("Mini player toggle failed", error);
    }
  }

  async function close() {
    try {
      await stopAudioCompletely();
    } finally {
      onClose?.();
    }
  }

  if (!activeItem) return null;

  return (
    <View style={styles.root}>
      <Pressable style={styles.info} onPress={() => onOpen?.()}>
        <Image source={{ uri: thumbnail }} style={styles.image} />

        <View style={styles.textBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {activeItem.title || "Audio Sermon"}
          </Text>

          <Text style={styles.meta} numberOfLines={1}>
            {audioState.playing ? "Playing" : "Paused"} · {formatTime(audioState.positionMs)}
          </Text>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>
      </Pressable>

      <Pressable style={styles.iconButton} onPress={toggle}>
        <Ionicons
          name={audioState.playing ? "pause" : "play"}
          size={22}
          color={C.black}
        />
      </Pressable>

      <Pressable style={styles.closeButton} onPress={close}>
        <Ionicons name="close" size={22} color={C.white} />
      </Pressable>
    </View>
  );
}

const styles = makeThemedStyles(C => ({
  root: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 86,
    minHeight: 76,
    borderRadius: 18,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    gap: 10,
    zIndex: 50
  },
  info: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  image: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: C.surface2
  },
  textBlock: {
    flex: 1
  },
  title: {
    color: C.white,
    fontSize: 14,
    fontWeight: "900"
  },
  meta: {
    color: C.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3
  },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: C.surface2,
    marginTop: 8,
    overflow: "hidden"
  },
  progressFill: {
    height: 4,
    borderRadius: 999,
    backgroundColor: C.gold
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.gold,
    alignItems: "center",
    justifyContent: "center"
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.surface2,
    alignItems: "center",
    justifyContent: "center"
  }
}));
