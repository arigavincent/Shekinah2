import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants from "expo-constants";
import { Ionicons } from "./Icon";

import { brandLogo } from "../constants/assets";
import { C, GOLD_GRADIENT } from "../constants/theme";
import { DRAWER_GROUPS } from "../constants/drawerGroups";
import { tr } from "../i18n/labels";
import { s } from "../styles/appStyles";

const APP_VERSION = Constants.expoConfig?.version || "1.0.0";

export function Drawer({ visible, close, go, appLanguage = "en" }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const drawerWidth = Math.min(340, Math.round(width * 0.84));
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);

    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 260 : 200,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, progress]);

  if (!mounted) return null;

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-drawerWidth, 0] });

  const onItem = target => {
    if (target === "Share") {
      Share.share({ message: tr(appLanguage, "Shekinah Sons Global Church App") });
      return;
    }
    go(target);
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={close} statusBarTranslucent>
      <Animated.View style={[s.drawerBackdrop, { opacity: progress }]}>
        <Pressable style={{ flex: 1 }} onPress={close} accessibilityLabel="Close menu" />
      </Animated.View>

      <Animated.View style={[s.drawer, { width: drawerWidth, transform: [{ translateX }] }]}>
        <View style={[s.drawerHeader, { paddingTop: insets.top }]}>
          <Image source={brandLogo} style={s.drawerHeaderImage} resizeMode="cover" />
          <LinearGradient
            colors={["transparent", C.backgroundElevated]}
            style={s.drawerHeaderFade}
            pointerEvents="none"
          />
        </View>
        <LinearGradient
          colors={["transparent", GOLD_GRADIENT[1], "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.goldHairline}
        />

        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
          {DRAWER_GROUPS.map(([title, items]) => (
            <View key={title} style={s.drawerGroup}>
              <Text style={s.drawerGroupTitle}>{tr(appLanguage, title)}</Text>

              {items.map(([label, target, icon]) => (
                <Pressable
                  key={label}
                  style={({ pressed }) => [s.drawerItem, pressed && s.drawerItemPressed]}
                  onPress={() => onItem(target)}
                  accessibilityRole="button"
                >
                  <View style={s.drawerItemIcon}>
                    <Ionicons name={icon} size={20} color={C.gold} />
                  </View>
                  <Text style={s.drawerItemText} numberOfLines={1}>{tr(appLanguage, label)}</Text>
                  {target !== "Share" ? (
                    <Ionicons name="chevron-forward" size={16} color={C.faint} />
                  ) : null}
                </Pressable>
              ))}
            </View>
          ))}

          <Text style={s.drawerVersion}>Version {APP_VERSION}</Text>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}
