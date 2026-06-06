import React from "react";
import {
  Image,
  ScrollView,
  Text
} from "react-native";

import { PHASE1_IMAGES } from "../content";
import { resolveMediaUrl } from "../utils/mediaUrl";
import { C } from "../constants/theme";
import { s } from "../styles/appStyles";
import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { IconButton } from "../components/IconButton";

export function DevotionDetail({ devotion, favorites = [], setFavorites, go }) {
  const saved = favorites.includes(devotion?.id);
  const toggle = () => {
    if (!devotion) return;
    if (typeof setFavorites !== "function") return;
    setFavorites(saved ? favorites.filter(x => x !== devotion.id) : [...favorites, devotion.id]);
  };
  return (
    <Screen>
      <TopBar title="Devotion" go={go} back="Devotions" right={<IconButton name={saved ? "heart" : "heart-outline"} color={saved ? C.gold : C.white} onPress={toggle} />} />
      <ScrollView contentContainerStyle={s.scrollPad}>
        <Image source={{ uri: resolveMediaUrl(devotion?.imageUrl || devotion?.image || devotion?.thumbnailUrl || "") || PHASE1_IMAGES.devotion }} style={s.detailImage} />
        <Text style={s.detailTitle}>{devotion?.title}</Text>
        <Text style={s.goldSmall}>{devotion?.date || devotion?.devotionDate}</Text>
        <Text style={s.detailBody}>{devotion?.body || devotion?.excerpt || "No devotion body available."}</Text>
      </ScrollView>
    </Screen>
  );
}
