import React from "react";
import { Pressable } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// A Pressable that springs down slightly while pressed.
export function PressableScale({ style, scaleTo = 0.965, children, ...props }) {
  const pressed = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressed.value }] }));

  return (
    <AnimatedPressable
      {...props}
      onPressIn={event => {
        if (!reduceMotion) pressed.value = withSpring(scaleTo, { damping: 18, stiffness: 320 });
        props.onPressIn?.(event);
      }}
      onPressOut={event => {
        pressed.value = withSpring(1, { damping: 14, stiffness: 260 });
        props.onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}
