import React from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Ionicons } from "./Icon";

import { brandMark } from "../constants/assets";
import { C } from "../constants/theme";
import { tr } from "../i18n/labels";
import { useNav } from "../navigation/NavContext";
import { s } from "../styles/appStyles";

// Root screens (opened from tabs/drawer) show the menu + brand lockup.
// Pushed screens show a back arrow + left-aligned title, Android style.
export function TopBar({ title, go, right, back, onBack, onMenu, appLanguage = "en" }) {
  const { goBack } = useNav();
  const isPushed = Boolean(back || onBack);

  const handleLeftPress = () => {
    if (typeof onBack === "function") {
      onBack();
      return;
    }

    if (back) {
      goBack(back);
      return;
    }

    if (onMenu) {
      onMenu();
    }
  };

  const showLeft = isPushed || Boolean(onMenu);

  return (
    <View style={s.topBar}>
      {showLeft ? (
        <Pressable
          style={({ pressed }) => [s.topIcon, pressed && s.topIconPressed]}
          onPress={handleLeftPress}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={isPushed ? "Go back" : "Open menu"}
        >
          <Ionicons name={isPushed ? "arrow-back" : "menu-outline"} size={24} color={C.white} />
        </Pressable>
      ) : null}

      {isPushed ? (
        <Text style={s.topTitle} numberOfLines={1} accessibilityRole="header">
          {tr(appLanguage, title || "")}
        </Text>
      ) : (
        <View style={s.brandLockup}>
          <Image source={brandMark} style={s.brandMark} resizeMode="contain" />
          {title ? (
            <Text style={s.brandTitle} numberOfLines={1} accessibilityRole="header">
              {tr(appLanguage, title)}
            </Text>
          ) : (
            <View>
              <Text style={s.brandName}>SHEKINAH</Text>
              <Text style={s.brandSub}>SONS GLOBAL</Text>
            </View>
          )}
        </View>
      )}

      <View style={s.topRight}>{right}</View>
    </View>
  );
}
