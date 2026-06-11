import React, { useMemo, useState } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useContent } from "../providers/ContentProvider";
import { PHASE1_IMAGES } from "../content";
import { resolveMediaUrl } from "../utils/mediaUrl";
import { C } from "../constants/theme";
import { tr } from "../i18n/labels";
import { s } from "../styles/appStyles";
import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { Tabs } from "../components/Tabs";
import { EmptyState } from "../components/Cards";

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

function DevotionListRow({ item, favorites, setFavorites, onPress }) {
  const saved = favorites.includes(item.id);

  return (
    <Pressable style={s.listRow} onPress={onPress}>
      <Image source={{ uri: devotionImage(item) }} style={s.rowImage} />

      <View style={s.rowBody}>
        <Text style={s.rowTitle}>{item.title}</Text>

        <Text style={s.mutedText} numberOfLines={2}>
          {item.excerpt || item.body || "Open to read this devotion."}
        </Text>

        <Text style={s.goldSmall}>{devotionDate(item)}</Text>
      </View>

      <Pressable
        style={s.playDot}
        onPress={event => {
          event?.stopPropagation?.();
          toggleFavorite(item, favorites, setFavorites);
        }}
      >
        <Ionicons
          name={saved ? "heart" : "heart-outline"}
          size={18}
          color={saved ? C.gold : C.white}
        />
      </Pressable>
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

      <View style={s.pad}>
        <TextInput
          style={s.searchInput}
          placeholder={tab === "Latest" ? tr(appLanguage, "Search latest") : tr(appLanguage, "Search favourites")}
          placeholderTextColor={C.faint}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <ScrollView
        contentContainerStyle={s.scrollPad}
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
          <EmptyState
            title={tab === "Favourites" ? tr(appLanguage, "No Favourites") : tr(appLanguage, "No Devotions")}
            text={
              tab === "Favourites"
                ? tr(appLanguage, "Tap the heart icon on a devotion to save it here.")
                : tr(appLanguage, "New devotions will appear here.")
            }
          />
        ) : (
          visible.map(item => (
            <DevotionListRow
              key={item.id}
              item={item}
              favorites={favorites}
              setFavorites={setFavorites}
              onPress={() => go("DevotionDetail", item)}
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
