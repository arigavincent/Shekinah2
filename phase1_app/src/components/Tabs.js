import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { tr } from "../i18n/labels";
import { s } from "../styles/appStyles";

// Segmented top tabs. Up to 3 tabs share the width; more than that scroll
// horizontally so long labels (e.g. Kiswahili) never truncate.
export function Tabs({ tabs, active, setActive, appLanguage = "en" }) {
  const scrollable = tabs.length > 3;

  const items = tabs.map(tab => {
    const selected = active === tab;
    return (
      <Pressable
        key={tab}
        style={[s.tabBtn, scrollable && s.tabBtnScroll]}
        onPress={() => setActive(tab)}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
      >
        <Text style={[s.tabText, selected && s.tabActiveText]} numberOfLines={1}>
          {tr(appLanguage, tab)}
        </Text>
        {selected ? <View style={s.tabUnderline} /> : null}
      </Pressable>
    );
  });

  if (scrollable) {
    return (
      <View style={s.tabs}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabsScroll}>
          {items}
        </ScrollView>
      </View>
    );
  }

  return <View style={s.tabs}>{items}</View>;
}
