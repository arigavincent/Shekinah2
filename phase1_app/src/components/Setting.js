import React from "react";
import { Pressable, Text } from "react-native";

import { s } from "../styles/appStyles";

export function Setting({ label, value, onPress }) {
  return (
    <Pressable style={s.settingRow} onPress={onPress}>
      <Text style={s.rowTitle}>{label}</Text>
      <Text style={s.goldSmall}>{value}</Text>
    </Pressable>
  );
}
