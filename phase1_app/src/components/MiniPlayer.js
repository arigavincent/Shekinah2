import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  Text,
  View
} from "react-native";
import { Ionicons } from "./Icon";
import { useNavBarHeight } from "./BottomNav";

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
  const navHeight = useNavBarHeight();
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
    <View style={[styles.root, { bottom: navHeight + 8 }]}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      <Pressable
        style={({ pressed }) => [styles.info, pressed && { opacity: 0.75 }]}
        onPress={() => onOpen?.()}
        accessibilityRole="button"
        accessibilityLabel={`Open player, ${activeItem.title || "Audio Sermon"}`}
      >
        <Image source={{ uri: thumbnail }} style={styles.image} />

        <View style={styles.textBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {activeItem.title || "Audio Sermon"}
          </Text>

          <Text style={styles.meta} numberOfLines={1}>
            {activeItem.speaker || activeItem.preacher || (audioState.playing ? "Playing" : "Paused")} · {formatTime(audioState.positionMs)}
          </Text>
        </View>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: C.accentPressed }]}
        onPress={toggle}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={audioState.playing ? "Pause" : "Play"}
      >
        <Ionicons name={audioState.playing ? "pause" : "play"} size={20} color="#FFFFFF" />
      </Pressable>

      <Pressable style={styles.closeButton} onPress={close} hitSlop={6} accessibilityRole="button" accessibilityLabel="Stop and close player">
        <Ionicons name="close" size={20} color={C.muted} />
      </Pressable>
    </View>
  );
}

const styles = makeThemedStyles(C => ({
  root: {
    position: "absolute",
    left: 12,
    right: 12,
    minHeight: 64,
    borderRadius: 16,
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.lineStrong,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 8,
    paddingRight: 6,
    paddingVertical: 8,
    gap: 6,
    zIndex: 50,
    overflow: "hidden",
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }
  },
  info: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  image: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: C.surface3
  },
  textBlock: {
    flex: 1
  },
  title: {
    color: C.white,
    fontSize: 14,
    fontFamily: C.fontBold
  },
  meta: {
    color: C.muted,
    fontSize: 12,
    fontFamily: C.fontBody,
    marginTop: 2
  },
  progressTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: C.line
  },
  progressFill: {
    height: 2,
    backgroundColor: C.accent
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center"
  },
  closeButton: {
    width: 40,
    height: 44,
    alignItems: "center",
    justifyContent: "center"
  }
}));
