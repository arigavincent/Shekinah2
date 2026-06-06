import React from "react";
import { Pressable, Text, View } from "react-native";

import { s } from "../styles/appStyles";

export function SectionHeader({ title, onPress }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{title}</Text>

      {onPress ? (
        <Pressable style={s.viewAll} onPress={onPress}>
          <Text style={s.viewAllText}>View All</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
