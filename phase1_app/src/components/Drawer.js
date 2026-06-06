import React from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { brandLogo } from "../constants/assets";
import { C } from "../constants/theme";
import { DRAWER_GROUPS } from "../constants/drawerGroups";
import { s } from "../styles/appStyles";

export function Drawer({ visible, close, go }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={s.drawerBackdrop} onPress={close} />

      <View style={s.drawer}>
        <View style={s.drawerLogoWrap}>
          <Image source={brandLogo} style={s.drawerLogo} resizeMode="contain" />
          <Text style={s.cardTitle}>Shekinah Sons Global</Text>
        </View>

        <ScrollView>
          {DRAWER_GROUPS.map(([title, items]) => (
            <View key={title} style={s.drawerGroup}>
              <Text style={s.drawerGroupTitle}>{title}</Text>

              {items.map(([label, target]) => (
                <Pressable
                  key={label}
                  style={s.drawerItem}
                  onPress={() =>
                    target === "Share"
                      ? Share.share({ message: "Shekinah Sons Global Church App" })
                      : go(target)
                  }
                >
                  <Text style={s.drawerItemText}>{label}</Text>
                  <Ionicons name="chevron-forward-outline" size={18} color={C.muted} />
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}
