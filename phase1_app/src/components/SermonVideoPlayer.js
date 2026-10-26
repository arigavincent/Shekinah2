import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useEvent } from "expo";
import { VideoView, useVideoPlayer } from "expo-video";
import * as ScreenOrientation from "expo-screen-orientation";

import { C, makeThemedStyles } from "../constants/theme";
import { getPlaybackProgress, savePlaybackProgress } from "../services/playbackProgressStore";
import { Ionicons } from "./Icon";

const SAVE_EVERY_SECONDS = 5;

// Our own sermon video player for Cloudflare Stream (HLS) and uploaded MP4s.
// Resumes from the last saved position and keeps it updated while playing.
export function SermonVideoPlayer({ sermon, source, poster, height }) {
  const lastSaved = useRef(0);
  const [resumeFrom, setResumeFrom] = useState(null);

  const player = useVideoPlayer(source, instance => {
    instance.timeUpdateEventInterval = 1;
    instance.staysActiveInBackground = false;
  });

  const { status, error } = useEvent(player, "statusChange", { status: player.status });
  const { isPlaying } = useEvent(player, "playingChange", { isPlaying: player.playing });

  // Resume where the viewer stopped, unless they had nearly finished.
  useEffect(() => {
    let cancelled = false;
    getPlaybackProgress(sermon?.id).then(entry => {
      if (cancelled) return;
      const position = (entry?.positionMs || 0) / 1000;
      const duration = (entry?.durationMs || 0) / 1000;
      const resumable = position > 15 && (!duration || position < duration - 30);
      setResumeFrom(resumable ? position : 0);
    });
    return () => {
      cancelled = true;
    };
  }, [sermon?.id]);

  useEffect(() => {
    if (resumeFrom === null || status !== "readyToPlay") return;
    if (resumeFrom > 0) player.currentTime = resumeFrom;
    player.play();
  }, [resumeFrom, status, player]);

  useEffect(() => {
    const subscription = player.addListener("timeUpdate", ({ currentTime }) => {
      if (!sermon?.id || Math.abs(currentTime - lastSaved.current) < SAVE_EVERY_SECONDS) return;
      lastSaved.current = currentTime;
      savePlaybackProgress({
        sermonId: sermon.id,
        title: sermon.title,
        speaker: sermon.speaker,
        type: "video",
        thumbnail: poster,
        positionMs: Math.round(currentTime * 1000),
        durationMs: Math.round((player.duration || 0) * 1000)
      }).catch(() => {});
    });
    return () => subscription.remove();
  }, [player, sermon?.id, sermon?.title, sermon?.speaker, poster]);

  const loading = status === "loading" || (status === "idle" && resumeFrom === null);
  const failed = status === "error";

  return (
    <View style={[styles.frame, { height }]}>
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        nativeControls
        allowsFullscreen
        allowsPictureInPicture
        contentFit="contain"
        onFullscreenEnter={() => ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {})}
        onFullscreenExit={() => ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {})}
      />

      {loading && !isPlaying ? (
        <View style={styles.overlay} pointerEvents="none">
          {poster ? <Image source={{ uri: poster }} style={[StyleSheet.absoluteFill, { opacity: 0.35 }]} blurRadius={2} /> : null}
          <ActivityIndicator size="large" color={C.gold} />
          {resumeFrom > 0 ? <Text style={styles.overlayText}>Resuming where you left off</Text> : null}
        </View>
      ) : null}

      {failed ? (
        <View style={styles.overlay}>
          <Ionicons name="alert-circle-outline" size={32} color="#FFFFFF" />
          <Text style={styles.overlayText}>This video couldn't play.</Text>
          <Text style={styles.overlaySub}>{error?.message ? "Check your connection and try again." : ""}</Text>
          <Pressable
            onPress={() => {
              player.replace(source);
              player.play();
            }}
            style={({ pressed }) => [styles.retry, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
          >
            <Ionicons name="repeat-outline" size={16} color={C.textOnAccent} />
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = makeThemedStyles(C => ({
  frame: { width: "100%", backgroundColor: "#000" },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "rgba(0,0,0,0.55)" },
  overlayText: { color: "#FFFFFF", fontSize: 14, fontFamily: C.fontBold },
  overlaySub: { color: "rgba(255,255,255,0.7)", fontSize: 12.5, fontFamily: C.fontBody },
  retry: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.gold, borderRadius: 999, paddingHorizontal: 16, height: 38, marginTop: 6 },
  retryText: { color: C.textOnAccent, fontSize: 13.5, fontFamily: C.fontBold }
}));
