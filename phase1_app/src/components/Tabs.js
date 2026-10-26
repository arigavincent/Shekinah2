import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { tr } from "../i18n/labels";
import { s } from "../styles/appStyles";

// Two tabs split the width (Latest / Favourites). Three or four sit centred at
// their natural width with the underline under the label, like Phaneroo's
// sermon tabs. Five or more scroll so long Kiswahili labels never truncate.
export function Tabs({ tabs, active, setActive, appLanguage = "en" }) {
  const mode = tabs.length <= 2 ? "split" : tabs.length <= 4 ? "compact" : "scroll";

  const items = tabs.map(tab => {
    const selected = active === tab;
    return (
      <Pressable
        key={tab}
        style={[s.tabBtn, mode !== "split" && s.tabBtnCompact]}
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

  if (mode === "scroll") {
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
