import React, { useMemo, useState } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Ionicons } from "../components/Icon";

import { useContent } from "../providers/ContentProvider";
import { PHASE1_IMAGES } from "../content";
import { resolveMediaUrl } from "../utils/mediaUrl";
import { C, makeThemedStyles } from "../constants/theme";
import { tr } from "../i18n/labels";
import { s } from "../styles/appStyles";
import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { Tabs } from "../components/Tabs";
import { SearchBar } from "../components/SearchBar";
import { FadeImage } from "../components/motion/FadeImage";

function devotionImage(devotion) {
  return resolveMediaUrl(devotion?.imageUrl || devotion?.image || devotion?.thumbnailUrl || "") || PHASE1_IMAGES.devotion;
}

function devotionDate(devotion) {
  return devotion?.date || devotion?.devotionDate || "";
}

function matchesQuery(devotion, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  return [
    devotion?.title,
    devotion?.excerpt,
    devotion?.body,
    devotionDate(devotion)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(q);
}

function toggleFavorite(devotion, favorites, setFavorites) {
  if (!devotion?.id || typeof setFavorites !== "function") return;

  const saved = favorites.includes(devotion.id);

  setFavorites(
    saved
      ? favorites.filter(id => id !== devotion.id)
      : [...favorites, devotion.id]
  );
}

// Phaneroo-style devotional row: text on the left, artwork on the right.
function DevotionListRow({ item, favorites, setFavorites, onPress, appLanguage }) {
  const saved = favorites.includes(item.id);
  const author = item.author || item.speaker || item.by;
  const tag = item.category || item.theme || item.series;

  return (
    <Pressable
      style={({ pressed }) => [dv.row, pressed && { opacity: 0.75 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      <View style={dv.body}>
        <Text style={dv.title} numberOfLines={2}>{item.title}</Text>
        <Text style={dv.excerpt} numberOfLines={2}>
          {`“${item.scripture || item.excerpt || item.body || tr(appLanguage, "Open to read this devotion.")}”`}
        </Text>
        {author ? <Text style={dv.author} numberOfLines={1}>{`${tr(appLanguage, "By")} ${author}`}</Text> : null}
        <View style={dv.metaRow}>
          <Text style={dv.date} numberOfLines={1}>{devotionDate(item)}</Text>
          {tag ? (
            <>
              <Text style={dv.date}>·</Text>
              <Text style={dv.tag} numberOfLines={1}>{tag}</Text>
            </>
          ) : null}
        </View>
      </View>

      <View>
        <FadeImage uri={devotionImage(item)} style={dv.image} />
        <Pressable
          style={({ pressed }) => [dv.heart, pressed && { opacity: 0.7 }]}
          hitSlop={8}
          onPress={event => {
            event?.stopPropagation?.();
            toggleFavorite(item, favorites, setFavorites);
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: saved }}
          accessibilityLabel={saved ? "Remove from favourites" : "Add to favourites"}
        >
          <Ionicons name={saved ? "heart" : "heart-outline"} size={17} color={saved ? C.red : "#FFFFFF"} />
        </Pressable>
      </View>
    </Pressable>
  );
}

export function DevotionsScreen({
  go,
  openDrawer,
  tab,
  setTab,
  favorites = [],
  setFavorites,
  appLanguage = "en"
}) {
  const [query, setQuery] = useState("");
  const { data, loading, reload } = useContent();

  const devotions = Array.isArray(data.devotions) ? data.devotions : [];

  const latest = useMemo(() => {
    return devotions.filter(item => item?.id && item?.title);
  }, [devotions]);

  const favoriteDevotions = useMemo(() => {
    return latest.filter(item => favorites.includes(item.id));
  }, [latest, favorites]);

  const items = tab === "Latest" ? latest : favoriteDevotions;
  const visible = items.filter(item => matchesQuery(item, query));

  function handleSetTab(nextTab) {
    setQuery("");
    setTab(nextTab);
  }

  return (
    <Screen>
      <TopBar
        title="Devotions"
        go={go}
        onMenu={openDrawer}
        appLanguage={appLanguage}
      />

      <Tabs
        tabs={["Latest", "Favourites"]}
        active={tab}
        setActive={handleSetTab}
        appLanguage={appLanguage}
      />

      <View style={dv.searchWrap}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder={tab === "Latest" ? tr(appLanguage, "Search all devotionals...") : tr(appLanguage, "Search favourites...")}
        />
      </View>

      <ScrollView
        contentContainerStyle={s.scrollPad}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={reload}
            tintColor={C.gold}
            colors={[C.gold]}
            progressBackgroundColor={C.surface2}
          />
        }
      >
        {visible.length === 0 ? (
          <View style={dv.empty}>
            <Ionicons name={tab === "Favourites" ? "heart-outline" : "sunny-outline"} size={48} color={C.faint} />
            <Text style={dv.emptyTitle}>
              {tab === "Favourites" ? tr(appLanguage, "No Favourites") : tr(appLanguage, "No Devotions")}
            </Text>
            <Text style={dv.emptyText}>
              {tab === "Favourites"
                ? tr(appLanguage, "Tap the heart icon on a devotion to save it here.")
                : tr(appLanguage, "New devotions will appear here.")}
            </Text>
          </View>
        ) : (
          visible.map(item => (
            <DevotionListRow
              key={item.id}
              item={item}
              favorites={favorites}
              setFavorites={setFavorites}
              onPress={() => go("DevotionDetail", item)}
              appLanguage={appLanguage}
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const dv = makeThemedStyles(C => ({
  searchWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.lineStrong
  },
  body: { flex: 1, minWidth: 0 },
  title: { color: C.white, fontSize: 15.5, lineHeight: 21, fontFamily: C.fontBold },
  excerpt: { color: C.muted, fontSize: 13.5, lineHeight: 19, fontFamily: C.fontBody, fontStyle: "italic", marginTop: 4 },
  author: { color: C.white, fontSize: 14, fontFamily: C.fontMedium, marginTop: 6, opacity: 0.85 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  date: { color: C.faint, fontSize: 13, fontFamily: C.fontBody },
  tag: { color: C.accentText, fontSize: 13, fontFamily: C.fontMedium, flexShrink: 1 },
  image: { width: 124, height: 84, borderRadius: 12, backgroundColor: C.surface2 },
  heart: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center"
  },
  empty: { alignItems: "center", paddingVertical: 96, paddingHorizontal: 32, gap: 10 },
  emptyTitle: { color: C.white, fontSize: 20, fontFamily: C.fontBold, textAlign: "center", marginTop: 6 },
  emptyText: { color: C.muted, fontSize: 14.5, lineHeight: 21, fontFamily: C.fontBody, textAlign: "center" }
}));
