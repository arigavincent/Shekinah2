import React from "react";
import { Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { C } from "../constants/theme";
import { s } from "../styles/appStyles";

export function ActionButton({ icon, label, onPress }) {
  return (
    <Pressable style={s.actionBtn} onPress={onPress}>
      <Ionicons name={icon} size={14} color={C.white} />
      <Text style={s.actionText}>{label}</Text>
    </Pressable>
  );
}
