import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import { brandMark } from "../constants/assets";
import { GOLD_GRADIENT, makeThemedStyles } from "../constants/theme";
import { AUDIO_COVER } from "../content";
import { getAudioPlaybackState, subscribeAudioPlayback } from "../services/audioPlayback";
import { resolveMediaUrl } from "../utils/mediaUrl";

export function useNowPlaying() {
  const [state, setState] = useState(getAudioPlaybackState());
  useEffect(() => subscribeAudioPlayback(setState), []);
  return state;
}

const BAR_SHAPE = [0.45, 0.8, 1, 0.65, 0.9, 0.5, 0.75, 0.4];

// Gold equaliser: idles as a static waveform, dances while this item plays.
export function Waveform({ playing, height = 18, barWidth = 3, gap = 2, color = GOLD_GRADIENT[1], bars = 8 }) {
  const values = useRef(Array.from({ length: bars }, () => new Animated.Value(0))).current;

  useEffect(() => {
    if (!playing) {
      values.forEach(value => value.stopAnimation());
      return undefined;
    }

    const loops = values.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, { toValue: 1, duration: 260 + index * 45, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(value, { toValue: 0, duration: 300 + index * 35, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
        ])
      )
    );
    loops.forEach(loop => loop.start());
    return () => loops.forEach(loop => loop.stop());
  }, [playing, values]);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", height, gap }}>
      {values.map((value, index) => {
        const base = BAR_SHAPE[index % BAR_SHAPE.length];
        return (
          <Animated.View
            key={index}
            style={{
              width: barWidth,
              height,
              borderRadius: barWidth,
              backgroundColor: color,
              transform: [
                {
                  scaleY: playing
                    ? value.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] })
                    : base
                }
              ]
            }}
          />
        );
      })}
    </View>
  );
}

const MARBLE = require("../../assets/branding/marble.jpg");

function hasOwnPhoto(item) {
  const own = resolveMediaUrl(item?.image || item?.imageUrl || item?.thumbnail || "");
  return Boolean(own && own !== AUDIO_COVER) ? own : "";
}

// "S.14 Why Jesus Came" -> { code: "S.14", title: "Why Jesus Came" }
function splitTitle(raw) {
  const text = String(raw || "").trim();
  const match = text.match(/^([A-Z]{1,3}\.?\s?\d{1,4})[\s.:-]+(.*)$/i);
  return match ? { code: match[1].replace(/\s/g, ""), title: match[2] } : { code: "", title: text };
}

// Branded audio artwork. Without a photo it is typographic: black marble,
// a gold glow, a large dove watermark and the sermon title in Cinzel, so
// every card is distinct. With a photo, the photo gets the same treatment.
// variant "card" (rails, player) shows the glass label; "thumb" is compact.
export function AudioArt({ item, size, variant = "card", radius = 14 }) {
  const nowPlaying = useNowPlaying();
  const playing = Boolean(nowPlaying.playing && nowPlaying.sermon?.id && nowPlaying.sermon.id === item?.id);
  const photo = useMemo(() => hasOwnPhoto(item), [item?.image, item?.imageUrl, item?.thumbnail]);
  const { code, title } = useMemo(() => splitTitle(item?.title), [item?.title]);
  const compact = variant === "thumb";
  const titleSize = compact ? Math.round(size * 0.13) : Math.round(size * 0.105);

  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: radius }]}>
      {photo ? (
        <>
          <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <LinearGradient
            colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.5)", "rgba(0,0,0,0.92)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : (
        <>
          <Image source={MARBLE} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <LinearGradient
            colors={["rgba(212,175,55,0.38)", "rgba(212,175,55,0.06)", "rgba(0,0,0,0)"]}
            start={{ x: 0, y: 1 }}
            end={{ x: 0.9, y: 0.1 }}
            style={StyleSheet.absoluteFill}
          />
          <Image
            source={brandMark}
            style={[styles.watermark, { width: size * 0.78, height: size * 0.78, right: -size * 0.2, top: -size * 0.08 }]}
          />
        </>
      )}

      <View style={[styles.header, { top: compact ? 6 : 10, left: compact ? 6 : 10 }]}>
        <Image source={brandMark} style={{ width: compact ? 16 : 22, height: compact ? 16 : 22 }} />
        {!compact ? <Text style={styles.brandText}>SHEKINAH</Text> : null}
      </View>

      {!photo && !compact ? (
        <View style={[styles.titleBlock, { left: 12, right: 12, top: size * 0.26 }]}>
          {code ? <Text style={[styles.code, { fontSize: Math.max(9, titleSize * 0.62) }]}>{code}</Text> : null}
          <Text style={[styles.title, { fontSize: titleSize, lineHeight: titleSize * 1.18 }]} numberOfLines={3}>
            {title}
          </Text>
        </View>
      ) : null}
      {/* Small thumbnails carry only the sermon code; the row shows the title. */}
      {!photo && compact && code ? (
        <Text style={[styles.thumbCode, { fontSize: Math.round(size * 0.24), top: size * 0.32 }]} numberOfLines={1}>
          {code}
        </Text>
      ) : null}

      {compact ? (
        <View style={styles.thumbWave}>
          <Waveform playing={playing} height={12} barWidth={2.5} bars={6} />
        </View>
      ) : (
        <View style={styles.glassWrap}>
          <BlurView intensity={30} tint="dark" experimentalBlurMethod="dimezisBlurView" style={styles.glass}>
            <Text style={[styles.glassLabel, { flex: 1 }]} numberOfLines={1}>{playing ? "NOW PLAYING" : "AUDIO SERMON"}</Text>
            <Waveform playing={playing} height={Math.max(14, Math.round(size * 0.1))} />
          </BlurView>
        </View>
      )}

      <View style={[styles.rim, { borderRadius: radius }]} pointerEvents="none" />
    </View>
  );
}

const styles = makeThemedStyles(C => ({
  wrap: { overflow: "hidden", backgroundColor: "#050505" },
  watermark: { position: "absolute", opacity: 0.1 },
  header: { position: "absolute", flexDirection: "row", alignItems: "center", gap: 6 },
  brandText: { color: "#F0D27A", fontSize: 9, fontFamily: C.fontBrand, letterSpacing: 2 },
  titleBlock: { position: "absolute" },
  code: { color: "#F0D27A", fontFamily: C.fontBold, letterSpacing: 1, marginBottom: 2 },
  title: { color: "#D4AF37", fontFamily: C.fontBrand },
  thumbCode: { position: "absolute", left: 8, right: 6, color: "#D4AF37", fontFamily: C.fontBrand },
  thumbWave: { position: "absolute", right: 7, bottom: 7 },
  glassWrap: { position: "absolute", left: 8, right: 8, bottom: 8, borderRadius: 12, overflow: "hidden" },
  glass: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.22)",
    borderRadius: 12
  },
  glassLabel: { color: "#F0D27A", fontSize: 9.5, fontFamily: C.fontBold, letterSpacing: 1.2 },
  rim: { ...StyleSheet.absoluteFillObject, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(212,175,55,0.4)" }
}));
