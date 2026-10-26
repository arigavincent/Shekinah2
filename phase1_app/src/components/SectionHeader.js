import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "./Icon";

import { C } from "../constants/theme";
import { tr } from "../i18n/labels";
import { s } from "../styles/appStyles";

export function SectionHeader({ title, onPress, appLanguage = "en" }) {
  return (
    <View style={s.sectionHeader}>
      <View style={s.sectionTitleWrap}>
        <View style={s.sectionAccent} />
        <Text style={s.sectionTitle} accessibilityRole="header" numberOfLines={1}>
          {tr(appLanguage, title)}
        </Text>
      </View>

      {onPress ? (
        <Pressable
          style={({ pressed }) => [s.viewAll, pressed && { opacity: 0.6 }]}
          onPress={onPress}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`${tr(appLanguage, "View All")} ${tr(appLanguage, title)}`}
        >
          <Text style={s.viewAllText}>{tr(appLanguage, "View All")}</Text>
          <Ionicons name="chevron-forward" size={14} color={C.accentText} />
        </Pressable>
      ) : null}
    </View>
  );
}
