import React from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { Blur, Canvas, ColorMatrix, Image as SkiaImage, RoundedRect, useImage } from "@shopify/react-native-skia";
import { LinearGradient } from "expo-linear-gradient";

// Saturation matrix for Skia's ColorMatrix (1 = unchanged).
function saturate(amount) {
  const r = 0.2126, g = 0.7152, b = 0.0722;
  const s = amount;
  return [
    r + (1 - r) * s, g - g * s, b - b * s, 0, 0,
    r - r * s, g + (1 - g) * s, b - b * s, 0, 0,
    r - r * s, g - g * s, b + (1 - b) * s, 0, 0,
    0, 0, 0, 1, 0
  ];
}

// "Ambient mode": a blurred, colour-boosted copy of the artwork drawn with
// Skia so its edges fade to nothing, spilling the image's colours around
// the card like light. Pass the size of the artwork it sits behind. With
// `color` instead of `uri` it glows a solid colour (e.g. gold or live red).
export function AmbientGlow({
  uri,
  color,
  width,
  height,
  blur = 30,
  drop = 14,
  intensity = 1,
  saturation = 1.7,
  radius = 18,
  animatedStyle
}) {
  const image = useImage(uri || null);
  if ((!uri && !color) || !width || !height) return null;

  // The blur spreads about three times its radius; the canvas must be that
  // much larger than the artwork or the glow gets a hard, clipped edge.
  const margin = Math.ceil(blur * 3);
  const canvasWidth = width + margin * 2;
  const canvasHeight = height + margin * 2;
  const grow = Math.round(Math.min(width, height) * 0.04);

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", left: -margin, top: -margin + drop, width: canvasWidth, height: canvasHeight }, animatedStyle]}
    >
      <Canvas style={{ width: canvasWidth, height: canvasHeight, opacity: intensity }}>
        {color ? (
          <RoundedRect x={margin} y={margin} width={width} height={height} r={radius} color={color}>
            <Blur blur={blur} mode="decal" />
          </RoundedRect>
        ) : image ? (
          <SkiaImage
            image={image}
            x={margin - grow}
            y={margin - grow}
            width={width + grow * 2}
            height={height + grow * 2}
            fit="cover"
          >
            <ColorMatrix matrix={saturate(saturation)} />
            <Blur blur={blur} mode="decal" />
          </SkiaImage>
        ) : null}
      </Canvas>
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
