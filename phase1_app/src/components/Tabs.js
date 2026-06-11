import React from "react";
import { Pressable, Text, View } from "react-native";

import { tr } from "../i18n/labels";
import { s } from "../styles/appStyles";

export function Tabs({ tabs, active, setActive, appLanguage = "en" }) {
  return (
    <View style={s.tabs}>
      {tabs.map(tab => (
        <Pressable key={tab} style={s.tabBtn} onPress={() => setActive(tab)}>
          <Text style={[s.tabText, active === tab && s.tabActiveText]}>
            {tr(appLanguage, tab)}
          </Text>

          {active === tab ? <View style={s.tabUnderline} /> : null}
        </Pressable>
      ))}
    </View>
  );
}
