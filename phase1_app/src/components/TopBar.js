import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { brandLogo } from "../constants/assets";
import { C } from "../constants/theme";
import { tr } from "../i18n/labels";
import { s } from "../styles/appStyles";

export function TopBar({ title, go, right, back, onMenu, appLanguage = "en" }) {
  const handleLeftPress = () => {
    if (back) {
      go(back);
      return;
    }

    if (onMenu) {
      onMenu();
    }
  };

  return (
    <View style={s.topBar}>
      <Pressable style={s.topIcon} onPress={handleLeftPress}>
        {back ? (
          <Ionicons name="chevron-back-outline" size={24} color={C.white} />
        ) : onMenu ? (
          <Ionicons name="menu-outline" size={24} color={C.white} />
        ) : null}
      </Pressable>

      <View style={s.logoWrap}>
        <Image source={brandLogo} style={s.logo} resizeMode="contain" />
        <Text style={s.logoText}>{tr(appLanguage, title || "Shekinah Sons Global")}</Text>
      </View>

      <View style={s.topRight}>{right}</View>
    </View>
  );
}
