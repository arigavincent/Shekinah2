import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { C } from "../constants/theme";
import { tr } from "../i18n/labels";
import { s } from "../styles/appStyles";
import { useContent } from "../providers/ContentProvider";

export function BottomNav({ current, go, appLanguage = "en" }) {
  const { data } = useContent();
  const tabs = ["Home", "Sermons", "Devotions", "Live"];

  return (
    <View style={s.bottomNav}>
      {tabs.map(tab => {
        const active =
          current === tab ||
          (tab === "Sermons" && ["VideoDetail", "AudioPlayer"].includes(current)) ||
          (tab === "Devotions" && current === "DevotionDetail");

        return (
          <Pressable key={tab} style={s.navItem} onPress={() => go(tab)}>
            <Ionicons
              name={navIconFor(tab, active)}
              size={22}
              color={active ? C.gold : C.muted}
            />

            <View style={s.navLabelRow}>
              <Text style={[s.navLabel, active && s.navActive]}>{tr(appLanguage, tab)}</Text>
              {tab === "Live" && data.live.isLive ? <View style={s.redBadge} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function navIconFor(tab, active) {
  const icons = {
    Home: active ? "home" : "home-outline",
    Sermons: active ? "play-circle" : "play-circle-outline",
    Devotions: active ? "book" : "book-outline",
    Live: active ? "radio" : "radio-outline"
  };

  return icons[tab];
}
