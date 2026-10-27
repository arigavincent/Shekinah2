import React, { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import { makeThemedStyles } from "../../constants/theme";

const AnimatedImage = Animated.createAnimatedComponent(Image);

// Image that fades in over a shimmering placeholder instead of popping in.
export function FadeImage({ uri, style, imageStyle, resizeMode = "cover", blurRadius, children }) {
  const [loaded, setLoaded] = useState(false);
  const opacity = useSharedValue(0);
  const sheen = useSharedValue(-1);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion || loaded) return;
    sheen.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, false);
  }, [reduceMotion, loaded, sheen]);

  // Reset only when the image actually changes. Cached images can report
  // onLoad before effects run, so resetting on mount would hide them.
  const shownUri = useRef(uri);
  useEffect(() => {
    if (shownUri.current === uri) return;
    shownUri.current = uri;
    setLoaded(false);
    opacity.value = 0;
  }, [uri, opacity]);

  const imageAnimated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const sheenAnimated = useAnimatedStyle(() => ({ transform: [{ translateX: `${sheen.value * 100}%` }] }));

  return (
    <View style={[styles.frame, style]}>
      {!loaded ? (
        <Animated.View style={[StyleSheet.absoluteFill, sheenAnimated]} pointerEvents="none">
          <LinearGradient
            colors={["transparent", "rgba(255,255,255,0.07)", "transparent"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
      {uri ? (
        <AnimatedImage
          source={{ uri }}
          resizeMode={resizeMode}
          blurRadius={blurRadius}
          style={[StyleSheet.absoluteFill, imageStyle, imageAnimated]}
          onLoad={() => {
            setLoaded(true);
            opacity.value = withTiming(1, { duration: reduceMotion ? 0 : 420, easing: Easing.out(Easing.cubic) });
          }}
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = makeThemedStyles(C => ({
  frame: { overflow: "hidden", backgroundColor: C.surface2 }
}));
