import React from "react";
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { useContent } from "../providers/ContentProvider";
import { C, makeThemedStyles } from "../constants/theme";
import { tr } from "../i18n/labels";
import { s } from "../styles/appStyles";
import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { Tabs } from "../components/Tabs";
import { Ionicons } from "../components/Icon";

// Brand icon and colour from the platform's link or name.
function brandFor(item, tab) {
  const text = `${item?.link || ""} ${item?.name || ""}`.toLowerCase();
  if (text.includes("youtu")) return { icon: "logo-youtube", color: "#FF0000" };
  if (text.includes("facebook")) return { icon: "logo-facebook", color: "#1877F2" };
  if (text.includes("instagram")) return { icon: "logo-instagram", color: "#E4405F" };
  if (text.includes("twitter") || text.includes("x.com")) return { icon: "logo-twitter", color: C.white };
  if (text.includes("tiktok")) return { icon: "logo-tiktok", color: C.white };
  if (text.includes("whatsapp")) return { icon: "logo-whatsapp", color: "#25D366" };
  if (tab === "TV") return { icon: "tv", color: C.gold };
  if (tab === "Radio") return { icon: "radio-set", color: C.gold };
  return { icon: "globe-outline", color: C.gold };
}

function displayLink(link) {
  return String(link || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

function PlatformRow({ item, tab }) {
  const brand = brandFor(item, tab);
  const link = item?.link || item?.url || "";

  return (
    <Pressable
      disabled={!link}
      onPress={() => Linking.openURL(link).catch(() => {})}
      style={({ pressed }) => [pl.row, pressed && { backgroundColor: C.surface }]}
      accessibilityRole={link ? "link" : "text"}
      accessibilityLabel={`${item?.name}${link ? `, ${displayLink(link)}` : ""}`}
    >
      <View style={pl.icon}>
        <Ionicons name={brand.icon} size={24} color={brand.color} weight="fill" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={pl.name}>{item?.name}</Text>
        <Text style={pl.sub} numberOfLines={2}>{link ? displayLink(link) : item?.description}</Text>
        {item?.schedule ? <Text style={pl.schedule}>{item.schedule}</Text> : null}
      </View>
      {link ? <Ionicons name="link" size={20} color={C.muted} /> : null}
    </Pressable>
  );
}

export function PlatformsScreen({ go, tab, setTab, appLanguage = "en" }) {
  const { data, loading, reload } = useContent();
  const platforms = data.platforms || {};
  const items = Array.isArray(platforms[tab]) ? platforms[tab] : [];

  return (
    <Screen>
      <TopBar title="Our Platforms" go={go} back="Home" appLanguage={appLanguage} />
      <Tabs tabs={["Web", "TV", "Radio"]} active={tab} setActive={setTab} appLanguage={appLanguage} />

      <ScrollView
        contentContainerStyle={s.scrollPad}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={reload} tintColor={C.gold} colors={[C.gold]} progressBackgroundColor={C.surface2} />
        }
      >
        {items.length === 0 ? (
          <View style={pl.empty}>
            <Ionicons name="globe-outline" size={44} color={C.faint} />
            <Text style={pl.emptyTitle}>{tr(appLanguage, "Nothing listed yet")}</Text>
          </View>
        ) : (
          items.map(item => <PlatformRow key={item.id} item={item} tab={tab} />)
        )}
      </ScrollView>
    </Screen>
  );
}

const pl = makeThemedStyles(C => ({
  row: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.lineStrong },
  icon: { width: 46, height: 46, borderRadius: 14, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" },
  name: { color: C.white, fontSize: 16, fontFamily: C.fontBold },
  sub: { color: C.muted, fontSize: 13.5, lineHeight: 19, fontFamily: C.fontBody, marginTop: 2 },
  schedule: { color: C.accentText, fontSize: 12.5, fontFamily: C.fontMedium, marginTop: 4 },
  empty: { alignItems: "center", paddingVertical: 80, gap: 10 },
  emptyTitle: { color: C.white, fontSize: 17, fontFamily: C.fontBold }
}));
