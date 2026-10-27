import React from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { Blur, Canvas, Image as SkiaImage, useImage } from "@shopify/react-native-skia";
import { LinearGradient } from "expo-linear-gradient";

// "Ambient mode": a blurred copy of the artwork drawn with Skia so its
// edges fade to nothing, spilling the image's colours around the card like
// light. Pass the size of the artwork it sits behind.
export function AmbientGlow({ uri, width, height, blur = 20, drop = 12, intensity = 0.7, animatedStyle }) {
  const image = useImage(uri || null);
  if (!uri || !width || !height) return null;

  // The blur spreads about three times its radius; the canvas must be that
  // much larger than the artwork or the glow gets a hard, clipped edge.
  const margin = Math.ceil(blur * 3);
  const canvasWidth = width + margin * 2;
  const canvasHeight = height + margin * 2;

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", left: -margin, top: -margin + drop, width: canvasWidth, height: canvasHeight }, animatedStyle]}
    >
      {image ? (
        <Canvas style={{ width: canvasWidth, height: canvasHeight, opacity: intensity }}>
          <SkiaImage image={image} x={margin} y={margin} width={width} height={height} fit="cover">
            <Blur blur={blur} mode="decal" />
          </SkiaImage>
        </Canvas>
      ) : null}
    </Animated.View>
  );
}

// Page-level ambience: the featured artwork washes the top of the screen in
// its colours, fading into the background.
export function AmbientBackdrop({ uri, height = 460, background = "#000000", strength = 0.42 }) {
  if (!uri) return null;

  return (
    <View pointerEvents="none" style={[styles.backdrop, { height }]}>
      <Image source={{ uri }} blurRadius={60} resizeMode="cover" style={[StyleSheet.absoluteFill, { opacity: strength, transform: [{ scale: 1.3 }] }]} />
      <LinearGradient
        colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.55)", background]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: "absolute", top: 0, left: 0, right: 0 }
});
