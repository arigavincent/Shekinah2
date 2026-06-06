import React from "react";
import { Text, View } from "react-native";

import { s } from "../styles/appStyles";

export function Stat({ label, value }) {
  return (
    <View style={s.statBox}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.mutedText}>{label}</Text>
    </View>
  );
}
