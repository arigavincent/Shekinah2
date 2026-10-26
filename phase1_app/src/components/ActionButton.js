import React from "react";
import { Pressable, Text } from "react-native";
import { Ionicons } from "./Icon";

import { C } from "../constants/theme";
import { s } from "../styles/appStyles";

export function ActionButton({ icon, label, onPress }) {
  return (
    <Pressable
      style={({ pressed }) => [s.actionBtn, pressed && s.actionBtnPressed]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={16} color={C.white} />
      <Text style={s.actionText}>{label}</Text>
    </Pressable>
  );
}
