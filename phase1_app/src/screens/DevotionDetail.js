import React, { useEffect, useMemo, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import * as Speech from "expo-speech";
import { LinearGradient } from "expo-linear-gradient";

import { PHASE1_IMAGES } from "../content";
import { resolveMediaUrl } from "../utils/mediaUrl";
import { ANDROID_STATUS_BAR_HEIGHT, C, makeThemedStyles } from "../constants/theme";
import { tr } from "../i18n/labels";
import { Screen } from "../components/Screen";
import { Ionicons } from "../components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNav } from "../navigation/NavContext";
import { AmbientGlow } from "../components/motion/AmbientGlow";
import { FadeImage } from "../components/motion/FadeImage";

const FONT_STEPS = [14, 15.5, 17, 18.5, 20, 22];

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function paragraphs(text) {
  return clean(text)
    .split(/\n\s*\n|\r\n\s*\r\n/)
    .map(part => part.trim())
    .filter(Boolean);
}

function studyRefs(value) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  return clean(value).split(/[;,]/).map(part => part.trim()).filter(Boolean);
}

function formatDate(value) {
  const raw = clean(value);
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.toUpperCase();
  return date
    .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
    .replace(/,/g, "")
    .toUpperCase();
}

function HeaderAction({ icon, label, onPress, active, activeColor }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [st.headerBtn, active && st.headerBtnActive, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: Boolean(active) }}
    >
      <Ionicons name={icon} size={20} color={active ? activeColor || C.accent : C.white} />
    </Pressable>
  );
}

export function DevotionDetail({ devotion, favorites = [], setFavorites, go, appLanguage = "en" }) {
  const { goBack } = useNav();
  const { width: screenWidth } = useWindowDimensions();
  const heroWidth = screenWidth - 32;
  const insets = useSafeAreaInsets();
  const navHeight = Math.max(insets.bottom, 12);
  const [fontStep, setFontStep] = useState(1);
  const [speaking, setSpeaking] = useState(false);
  const [section, setSection] = useState(null);

  const saved = favorites.includes(devotion?.id);
  const image = resolveMediaUrl(devotion?.imageUrl || devotion?.image || devotion?.thumbnailUrl || "") || PHASE1_IMAGES.devotion;
  const title = clean(devotion?.title);
  const author = clean(devotion?.author || devotion?.speaker || devotion?.by);
  const verse = clean(devotion?.scripture || devotion?.verse);
  const verseRef = clean(devotion?.scriptureReference || devotion?.reference);
  const lead = clean(devotion?.excerpt);
  const bodyParts = paragraphs(devotion?.body);
  const nugget = clean(devotion?.goldenNugget || devotion?.nugget);
  const study = studyRefs(devotion?.furtherStudy);
  const prayer = clean(devotion?.prayer);
  const fontSize = FONT_STEPS[fontStep];

  // Read-aloud sections, in reading order; only those with content.
  const sections = useMemo(() => {
    return [
      ["Introduction", [title, lead].filter(Boolean).join(". ")],
      ["Scripture", [verse, verseRef].filter(Boolean).join(". ")],
      ["Body", bodyParts.join(" ")],
      ["Golden Nugget", nugget],
      ["Prayer", prayer]
    ].filter(([, text]) => Boolean(text));
  }, [title, lead, verse, verseRef, bodyParts.join(" "), nugget, prayer]);

  useEffect(() => () => Speech.stop(), []);

  const speakFrom = startIndex => {
    Speech.stop();
    const queue = sections.slice(startIndex);
    if (queue.length === 0) return;

    setSpeaking(true);
    queue.forEach(([name, text], offset) => {
      Speech.speak(text, {
        language: appLanguage === "sw" ? "sw" : "en",
        rate: 0.95,
        onStart: () => setSection(name),
        onDone: offset === queue.length - 1 ? () => { setSpeaking(false); setSection(null); } : undefined,
        onStopped: () => { setSpeaking(false); setSection(null); },
        onError: () => { setSpeaking(false); setSection(null); }
      });
    });
  };

  const toggleListen = () => {
    if (speaking) {
      Speech.stop();
      setSpeaking(false);
      setSection(null);
    } else {
      speakFrom(0);
    }
  };

  const toggleFavourite = () => {
    if (!devotion || typeof setFavorites !== "function") return;
    setFavorites(saved ? favorites.filter(id => id !== devotion.id) : [...favorites, devotion.id]);
  };

  const share = () => {
    Share.share({ message: [title, verse && `“${verse}” ${verseRef}`, lead].filter(Boolean).join("\n\n") });
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: navHeight + 120 }} showsVerticalScrollIndicator={false}>
        <View style={st.heroWrap}>
          <Image source={{ uri: image }} style={StyleSheet.absoluteFill} blurRadius={30} />
          <LinearGradient colors={["rgba(0,0,0,0.55)", "rgba(0,0,0,0.25)", C.background]} style={StyleSheet.absoluteFill} />

          <View style={st.header}>
            <Pressable
              onPress={() => goBack("Devotions")}
              hitSlop={6}
              style={({ pressed }) => [st.headerBtn, pressed && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={22} color={C.white} />
            </Pressable>
            <Text style={st.headerDate} numberOfLines={1}>
              {formatDate(devotion?.date || devotion?.devotionDate)}
            </Text>
            <HeaderAction icon={speaking ? "pause" : "volume-high-outline"} label={speaking ? "Stop reading" : "Listen to the devotional"} onPress={toggleListen} active={speaking} />
            <HeaderAction icon={saved ? "heart" : "heart-outline"} label={saved ? "Remove from favourites" : "Add to favourites"} onPress={toggleFavourite} active={saved} activeColor={C.red} />
            <HeaderAction icon="share-social-outline" label="Share devotional" onPress={share} />
          </View>

          <View style={st.heroWrap}>
            <AmbientGlow uri={image} width={heroWidth} height={Math.round(heroWidth / 1.6)} blur={34} drop={16} />
            <FadeImage uri={image} style={st.heroImage} />
          </View>
          {author ? <Text style={st.credit}>{author}</Text> : null}
        </View>

        <View style={st.sheet}>
          <Text style={st.title} accessibilityRole="header">{title}</Text>

          {verse ? (
            <View style={st.verseCard}>
              <Text style={st.cardLabel}>{tr(appLanguage, "TODAY'S VERSE")}</Text>
              <Text style={[st.verseText, { fontSize: fontSize + 1, lineHeight: (fontSize + 1) * 1.5 }]}>{`“${verse}”`}</Text>
              {verseRef ? <Text style={st.verseRef}>— {verseRef}</Text> : null}
            </View>
          ) : null}

          {lead ? (
            <Text style={[st.lead, { fontSize: fontSize + 1, lineHeight: (fontSize + 1) * 1.5 }]}>{lead}</Text>
          ) : null}

          {bodyParts.length > 0 ? (
            bodyParts.map((part, index) => (
              <Text key={index} style={[st.body, { fontSize, lineHeight: fontSize * 1.62 }]}>{part}</Text>
            ))
          ) : !lead ? (
            <Text style={[st.body, { fontSize }]}>{tr(appLanguage, "No devotion body available.")}</Text>
          ) : null}

          {nugget ? (
            <View style={st.nuggetCard}>
              <Text style={st.cardLabel}>{tr(appLanguage, "GOLDEN NUGGET")}</Text>
              <Text style={[st.nuggetText, { fontSize, lineHeight: fontSize * 1.5 }]}>{nugget}</Text>
            </View>
          ) : null}

          {study.length > 0 ? (
            <View style={st.studyCard}>
              <Text style={st.cardLabelBlue}>{tr(appLanguage, "FURTHER STUDY")}</Text>
              <View style={st.chips}>
                {study.map(ref => (
                  <View key={ref} style={st.chip}>
                    <Text style={st.chipText}>{ref}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {prayer ? (
            <View style={st.prayerCard}>
              <Text style={st.cardLabel}>{tr(appLanguage, "PRAYER")}</Text>
              <Text style={[st.prayerText, { fontSize, lineHeight: fontSize * 1.55 }]}>{prayer}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {speaking ? (
        <View style={[st.listenBar, { bottom: navHeight + 8 }]}>
          <View style={{ flex: 1 }}>
            <Text style={st.listenLabel}>{tr(appLanguage, section || "Introduction")}</Text>
            <Text style={st.listenTitle} numberOfLines={1}>{title}</Text>
          </View>
          <View style={st.jumpRow}>
            {sections.map(([name], index) => (
              <Pressable
                key={name}
                onPress={() => speakFrom(index)}
                style={[st.jumpChip, section === name && st.jumpChipActive]}
                accessibilityRole="button"
                accessibilityLabel={`Read from ${name}`}
              >
                <Text style={[st.jumpText, section === name && st.jumpTextActive]}>{index + 1}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={toggleListen} style={st.stopBtn} accessibilityRole="button" accessibilityLabel="Stop reading">
            <Ionicons name="pause" size={20} color={C.textOnAccent} />
          </Pressable>
        </View>
      ) : (
        <View style={[st.fontControls, { bottom: navHeight + 10 }]}>
          <Pressable
            onPress={() => setFontStep(step => Math.max(0, step - 1))}
            style={({ pressed }) => [st.fontBtn, fontStep === 0 && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel="Smaller text"
          >
            <Text style={st.fontBtnText}>A−</Text>
          </Pressable>
          <Pressable
            onPress={() => setFontStep(step => Math.min(FONT_STEPS.length - 1, step + 1))}
            style={({ pressed }) => [st.fontBtn, fontStep === FONT_STEPS.length - 1 && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel="Larger text"
          >
            <Text style={st.fontBtnText}>A+</Text>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

const st = makeThemedStyles(C => ({
  heroWrap: { paddingTop: ANDROID_STATUS_BAR_HEIGHT + 6, paddingBottom: 36, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, height: 56 },
  headerBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  headerBtnActive: { backgroundColor: "rgba(255,255,255,0.12)" },
  headerDate: { flex: 1, color: "rgba(255,255,255,0.75)", fontSize: 12, fontFamily: C.fontBold, letterSpacing: 1, marginLeft: 4 },
  heroWrap: { marginHorizontal: 16, marginTop: 6 },
  heroImage: { aspectRatio: 16 / 10, borderRadius: 16, backgroundColor: C.surface2 },
  credit: { color: "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: C.fontBody, marginHorizontal: 16, marginTop: 8 },
  sheet: {
    marginTop: -20,
    backgroundColor: C.background,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 24
  },
  title: { color: C.white, fontSize: 25, lineHeight: 32, fontFamily: C.fontBold, letterSpacing: -0.3 },
  verseCard: { marginTop: 20, backgroundColor: C.surface, borderRadius: 16, padding: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineStrong },
  cardLabel: { color: C.gold, fontSize: 11.5, fontFamily: C.fontBold, letterSpacing: 1.3, marginBottom: 10 },
  cardLabelBlue: { color: C.accentText, fontSize: 11.5, fontFamily: C.fontBold, letterSpacing: 1.3, marginBottom: 12 },
  verseText: { color: C.white, fontFamily: C.fontScripture },
  verseRef: { color: C.gold, fontSize: 13.5, fontFamily: C.fontBold, marginTop: 10 },
  lead: { color: C.white, fontFamily: C.fontBold, marginTop: 22 },
  body: { color: "rgba(255,255,255,0.78)", fontFamily: C.fontBody, marginTop: 16 },
  nuggetCard: { marginTop: 24, backgroundColor: C.goldSoft, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: "rgba(212,175,55,0.35)" },
  nuggetText: { color: C.gold2, fontFamily: C.fontBold },
  studyCard: { marginTop: 16, backgroundColor: C.surface, borderRadius: 16, padding: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineStrong },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { backgroundColor: C.accentSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { color: C.accentText, fontSize: 13, fontFamily: C.fontMedium },
  prayerCard: { marginTop: 16, backgroundColor: C.surface, borderRadius: 16, padding: 18, borderLeftWidth: 3, borderLeftColor: C.gold },
  prayerText: { color: C.white, fontFamily: C.fontScripture },
  fontControls: { position: "absolute", right: 16, flexDirection: "row", gap: 10 },
  fontBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.gold,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }
  },
  fontBtnText: { color: C.textOnAccent, fontSize: 14, fontFamily: C.fontBold },
  listenBar: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.surface2,
    borderRadius: 18,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineStrong,
    elevation: 10
  },
  listenLabel: { color: C.accentText, fontSize: 11, fontFamily: C.fontBold, letterSpacing: 0.8, textTransform: "uppercase" },
  listenTitle: { color: C.white, fontSize: 14, fontFamily: C.fontBold, marginTop: 2 },
  jumpRow: { flexDirection: "row", gap: 6 },
  jumpChip: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.surface3, alignItems: "center", justifyContent: "center" },
  jumpChipActive: { backgroundColor: C.accent },
  jumpText: { color: C.muted, fontSize: 12, fontFamily: C.fontBold },
  jumpTextActive: { color: "#FFFFFF" },
  stopBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.gold, alignItems: "center", justifyContent: "center" }
}));
