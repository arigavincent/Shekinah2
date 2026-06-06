import React from "react";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { C } from "../constants/theme";
import { s } from "../styles/appStyles";

export function IconButton({ name, onPress, color = C.white }) {
  return (
    <Pressable style={s.topIcon} onPress={onPress}>
      <Ionicons name={name} size={22} color={color} />
    </Pressable>
  );
}
