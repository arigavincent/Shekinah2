import React from "react";
import { Pressable } from "react-native";
import { Ionicons } from "./Icon";

import { C } from "../constants/theme";
import { s } from "../styles/appStyles";

export function IconButton({ name, onPress, color = C.white, accessibilityLabel }) {
  return (
    <Pressable
      style={({ pressed }) => [s.topIcon, pressed && s.topIconPressed]}
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || name.replace(/-outline$/, "").replace(/-/g, " ")}
    >
      <Ionicons name={name} size={22} color={color} />
    </Pressable>
  );
}
