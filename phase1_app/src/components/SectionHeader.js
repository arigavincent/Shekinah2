import React from "react";
import { Pressable, Text, View } from "react-native";

import { tr } from "../i18n/labels";
import { s } from "../styles/appStyles";

export function SectionHeader({ title, onPress, appLanguage = "en" }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle}>{tr(appLanguage, title)}</Text>

      {onPress ? (
        <Pressable style={s.viewAll} onPress={onPress}>
          <Text style={s.viewAllText}>{tr(appLanguage, "View All")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
