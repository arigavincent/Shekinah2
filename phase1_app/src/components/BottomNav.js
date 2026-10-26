import React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Ionicons } from "./Icon";

import { C } from "../constants/theme";
import { tr } from "../i18n/labels";
import { s, NAV_BAR_HEIGHT } from "../styles/appStyles";
import { useContent } from "../providers/ContentProvider";

const TABS = [
  { key: "Home", icon: "home", match: [] },
  { key: "Sermons", icon: "play-circle", match: ["VideoDetail", "AudioPlayer"] },
  { key: "Bible", icon: "book", match: [] },
  { key: "Devotions", icon: "sunny", match: ["DevotionDetail"] },
  { key: "Live", icon: "radio", match: [] }
];

// Space the floating bar occupies from the bottom edge (bar + its margin).
export function useNavBarHeight() {
  const insets = useSafeAreaInsets();
  return NAV_BAR_HEIGHT + 10 + Math.max(insets.bottom, 8);
}

export function BottomNav({ current, go, appLanguage = "en" }) {
  const { data } = useContent();
  const insets = useSafeAreaInsets();
  const isLive = Boolean(data?.live?.isLive);

  return (
    <View style={[s.bottomNav, { height: NAV_BAR_HEIGHT, bottom: Math.max(insets.bottom, 8) + 2 }]}>
      {TABS.map(tab => {
        const active = current === tab.key || tab.match.includes(current);
        const label = tr(appLanguage, tab.key);

        return (
          <Pressable
            key={tab.key}
            style={s.navItem}
            onPress={() => {
              if (!active) Haptics.selectionAsync().catch(() => {});
              go(tab.key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.key === "Live" && isLive ? `${label}, live now` : label}
          >
            <View style={[s.navPill, active && s.navPillActive]}>
              <View>
                <Ionicons
                  name={active ? tab.icon : `${tab.icon}-outline`}
                  size={21}
                  color={active ? C.accent : C.muted}
                />
                {tab.key === "Live" && isLive ? <View style={s.liveDot} /> : null}
              </View>
              <Text style={[s.navLabel, active && s.navActive]} numberOfLines={1}>
                {label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
