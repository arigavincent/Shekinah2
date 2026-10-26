import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { VideoView, useVideoPlayer } from "expo-video";

import { C, makeThemedStyles } from "../constants/theme";
import { PHASE1_IMAGES } from "../content";
import { tr } from "../i18n/labels";
import { Ionicons } from "./Icon";

export function PulsingDot({ size = 8, color = "#FFFFFF" }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }]
        }}
      />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

function HlsPreview({ source }) {
  const player = useVideoPlayer(source, instance => {
    instance.muted = true;
    instance.loop = true;
    instance.play();
  });

  return <VideoView style={StyleSheet.absoluteFill} player={player} nativeControls={false} contentFit="cover" />;
}

// Muted, auto-playing mini player shown at the top of Home while a service
// is live. Tapping anywhere opens the full Live screen with sound and chat.
export function LivePreview({ live, onOpen, appLanguage = "en", fallbackImage }) {
  const { width } = useWindowDimensions();
  const playerWidth = width - 32;
  const playerHeight = Math.round((playerWidth * 9) / 16);

  const provider = String(live?.provider || "").trim().toLowerCase();
  const hls = String(live?.playbackHlsUrl || "").trim();
  const useHls = provider === "cloudflare_stream" && Boolean(hls);
  const viewers = String(live?.viewers || "").trim();
  const title = String(live?.title || "").trim() || tr(appLanguage, "Live Stream");

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [styles.card, pressed && { transform: [{ scale: 0.985 }] }]}
      accessibilityRole="button"
      accessibilityLabel={`${tr(appLanguage, "LIVE NOW")}: ${title}. ${tr(appLanguage, "Tap to watch")}`}
    >
      <View style={{ height: playerHeight, backgroundColor: "#000" }} pointerEvents="none">
        {useHls ? (
          <HlsPreview source={hls} />
        ) : (
          <Image source={{ uri: fallbackImage || PHASE1_IMAGES.crowd }} style={StyleSheet.absoluteFill} />
        )}

        <LinearGradient
          colors={["rgba(0,0,0,0.55)", "rgba(0,0,0,0)", "rgba(0,0,0,0)", "rgba(0,0,0,0.85)"]}
          locations={[0, 0.3, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.topRow}>
          <View style={styles.livePill}>
            <PulsingDot size={7} />
            <Text style={styles.livePillText}>{tr(appLanguage, "LIVE")}</Text>
          </View>
          {viewers ? (
            <View style={styles.glassPill}>
              <Ionicons name="eye-outline" size={13} color="#FFFFFF" />
              <Text style={styles.glassText}>{viewers}</Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          <View style={styles.glassPill}>
            <Ionicons name="volume-mute-outline" size={13} color="#FFFFFF" />
          </View>
        </View>

        <View style={styles.bottomRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{tr(appLanguage, "Tap to watch with sound and join the chat")}</Text>
          </View>
          <View style={styles.watchBtn}>
            <Ionicons name="play" size={14} color={C.textOnAccent} />
            <Text style={styles.watchText}>{tr(appLanguage, "Watch")}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = makeThemedStyles(C => ({
  card: {
    borderRadius: 18,
    overflow: "hidden",
    marginTop: 4,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "rgba(229,57,53,0.55)",
    backgroundColor: "#000"
  },
  topRow: { position: "absolute", top: 10, left: 10, right: 10, flexDirection: "row", alignItems: "center", gap: 6 },
  livePill: { flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: C.red, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 5 },
  livePillText: { color: "#FFFFFF", fontSize: 11, fontFamily: C.fontBold, letterSpacing: 1 },
  glassPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.28)",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5
  },
  glassText: { color: "#FFFFFF", fontSize: 11.5, fontFamily: C.fontBold },
  bottomRow: { position: "absolute", left: 12, right: 12, bottom: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  title: { color: "#FFFFFF", fontSize: 16, fontFamily: C.fontBold },
  subtitle: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontFamily: C.fontBody, marginTop: 2 },
  watchBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.gold, borderRadius: 999, paddingHorizontal: 14, height: 36 }
  ,
  watchText: { color: C.textOnAccent, fontSize: 13, fontFamily: C.fontBold }
}));
