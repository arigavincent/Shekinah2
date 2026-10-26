import React, { useState } from "react";
import { Image, LayoutAnimation, Platform, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, UIManager, View } from "react-native";

import { useContent } from "../providers/ContentProvider";
import { PHASE1_IMAGES } from "../content";
import { C, makeThemedStyles } from "../constants/theme";
import { s } from "../styles/appStyles";
import { resolveMediaUrl } from "../utils/mediaUrl";
import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { Ionicons } from "../components/Icon";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function imageFor(item) {
  return resolveMediaUrl(item?.image || item?.imageUrl || "") || PHASE1_IMAGES.event;
}

// Phaneroo-style update rows; tapping one opens it in place.
function UpdateRow({ item, open, onToggle }) {
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [up.row, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={item.title}
    >
      {open ? (
        <View>
          <Image source={{ uri: imageFor(item) }} style={up.heroImage} />
          <Text style={up.titleOpen}>{item.title}</Text>
          {item.date ? <Text style={up.date}>{item.date}</Text> : null}
          <Text style={up.bodyOpen}>{item.body || item.excerpt}</Text>
          <Pressable
            onPress={() => Share.share({ message: `${item.title}\n\n${item.body || item.excerpt || ""}` })}
            style={({ pressed }) => [up.share, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
          >
            <Ionicons name="share-social-outline" size={16} color={C.textOnAccent} />
            <Text style={up.shareText}>Share</Text>
          </Pressable>
        </View>
      ) : (
        <View style={up.compact}>
          <Image source={{ uri: imageFor(item) }} style={up.thumb} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={up.title} numberOfLines={2}>{item.title}</Text>
            {item.excerpt ? <Text style={up.excerpt} numberOfLines={2}>{item.excerpt}</Text> : null}
            {item.date ? <Text style={up.date}>{item.date}</Text> : null}
          </View>
        </View>
      )}
    </Pressable>
  );
}

export function UpdatesScreen({ go, appLanguage = "en" }) {
  const { data, loading, reload } = useContent();
  const updates = Array.isArray(data.updates) ? data.updates : [];
  const [openId, setOpenId] = useState(null);

  const toggle = id => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenId(current => (current === id ? null : id));
  };

  return (
    <Screen>
      <TopBar title="Updates" go={go} back="Home" appLanguage={appLanguage} />

      <ScrollView
        contentContainerStyle={s.scrollPad}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={reload} tintColor={C.gold} colors={[C.gold]} progressBackgroundColor={C.surface2} />
        }
      >
        {updates.length === 0 ? (
          <View style={up.empty}>
            <Ionicons name="megaphone-outline" size={44} color={C.faint} />
            <Text style={up.emptyTitle}>No updates yet</Text>
            <Text style={up.emptyText}>Church announcements will appear here.</Text>
          </View>
        ) : (
          updates.map(item => (
            <UpdateRow key={item.id} item={item} open={openId === item.id} onToggle={() => toggle(item.id)} />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const up = makeThemedStyles(C => ({
  row: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.lineStrong },
  compact: { flexDirection: "row", gap: 14 },
  thumb: { width: 92, height: 92, borderRadius: 14, backgroundColor: C.surface2 },
  title: { color: C.white, fontSize: 15.5, lineHeight: 21, fontFamily: C.fontBold },
  excerpt: { color: C.muted, fontSize: 13.5, lineHeight: 19, fontFamily: C.fontBody, marginTop: 4 },
  date: { color: C.faint, fontSize: 12.5, fontFamily: C.fontBody, marginTop: 6 },
  heroImage: { width: "100%", aspectRatio: 16 / 10, borderRadius: 16, backgroundColor: C.surface2 },
  titleOpen: { color: C.white, fontSize: 19, lineHeight: 25, fontFamily: C.fontBold, marginTop: 14 },
  bodyOpen: { color: C.white, opacity: 0.85, fontSize: 15, lineHeight: 23, fontFamily: C.fontBody, marginTop: 10 },
  share: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.gold, borderRadius: 999, paddingHorizontal: 16, height: 38, marginTop: 14 },
  shareText: { color: C.textOnAccent, fontSize: 13.5, fontFamily: C.fontBold },
  empty: { alignItems: "center", paddingVertical: 80, gap: 10 },
  emptyTitle: { color: C.white, fontSize: 18, fontFamily: C.fontBold },
  emptyText: { color: C.muted, fontSize: 14, fontFamily: C.fontBody }
}));
