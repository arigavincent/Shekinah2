import React, { useMemo } from "react";
import {
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "../components/Icon";

import { ANDROID_STATUS_BAR_HEIGHT, C, GOLD_GRADIENT, makeThemedStyles } from "../constants/theme";
import { brandMark } from "../constants/assets";
import { useNav } from "../navigation/NavContext";
import { tr } from "../i18n/labels";
import { useContent } from "../providers/ContentProvider";
import { s } from "../styles/appStyles";
import { Screen } from "../components/Screen";

function cleanPhone(value) {
  return String(value || "").replace(/\s+/g, "");
}

function whatsappUrl(phone, message = "Hello Shekinah Sons Global, I would like to connect.") {
  const cleaned = String(phone || "").replace(/[^\d+]/g, "");
  if (!cleaned) return "";

  const normalized = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;

  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

function callUrl(phone) {
  const cleaned = cleanPhone(phone);
  return cleaned ? `tel:${cleaned}` : "";
}

function mailUrl(email) {
  return email ? `mailto:${email}` : "";
}

function mapUrl(branch) {
  const lat = Number(branch?.lat ?? branch?.latitude);
  const lng = Number(branch?.lng ?? branch?.longitude);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    branch?.address || branch?.name || "Shekinah Sons Global"
  )}`;
}

function openUrl(url) {
  if (!url) return;
  Linking.openURL(url).catch(() => {});
}

const MARBLE = require("../../assets/branding/marble.jpg");

function Eyebrow({ label, title }) {
  return (
    <View style={ab.eyebrowWrap}>
      <View style={ab.eyebrowRow}>
        <View style={ab.eyebrowLine} />
        <Text style={ab.eyebrow}>{label}</Text>
      </View>
      <Text style={ab.sectionTitle} accessibilityRole="header">{title}</Text>
    </View>
  );
}

function IconTile({ icon }) {
  return (
    <View style={ab.iconTile}>
      <Ionicons name={icon} size={20} color={C.gold} />
    </View>
  );
}

function BranchCard({ branch }) {
  const call = callUrl(branch.phone);
  const whatsapp = whatsappUrl(branch.phone);

  return (
    <View style={ab.card}>
      <View style={ab.cardRow}>
        <IconTile icon="location-outline" />
        <View style={{ flex: 1 }}>
          <Text style={ab.cardTitle}>{branch.name}</Text>
          {branch.address ? <Text style={ab.cardText}>{branch.address}</Text> : null}
          {branch.services ? (
            <View style={ab.timeChip}>
              <Ionicons name="time-outline" size={13} color={C.accentText} />
              <Text style={ab.timeChipText}>{branch.services}</Text>
            </View>
          ) : null}
          <View style={ab.linkRow}>
            <Pressable onPress={() => openUrl(mapUrl(branch))} hitSlop={8} style={ab.link} accessibilityRole="link">
              <Ionicons name="navigate-outline" size={14} color={C.gold} />
              <Text style={ab.linkText}>Get directions</Text>
            </Pressable>
            {call ? (
              <Pressable onPress={() => openUrl(call)} hitSlop={8} style={ab.link} accessibilityRole="link">
                <Ionicons name="call-outline" size={14} color={C.gold} />
                <Text style={ab.linkText}>Call</Text>
              </Pressable>
            ) : null}
            {whatsapp ? (
              <Pressable onPress={() => openUrl(whatsapp)} hitSlop={8} style={ab.link} accessibilityRole="link">
                <Ionicons name="logo-whatsapp" size={14} color={C.gold} />
                <Text style={ab.linkText}>WhatsApp</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

function ContactRow({ icon, title, value, onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [ab.card, ab.contactRow, disabled && { opacity: 0.45 }, pressed && { backgroundColor: C.surface2 }]}
      accessibilityRole="button"
      accessibilityLabel={`${title}${value ? `, ${value}` : ""}`}
    >
      <IconTile icon={icon} />
      <View style={{ flex: 1 }}>
        <Text style={ab.cardTitle}>{title}</Text>
        {value ? <Text style={ab.cardText} numberOfLines={1}>{value}</Text> : null}
      </View>
      <Ionicons name="open-outline" size={18} color={C.faint} />
    </Pressable>
  );
}

export function AboutScreen({ go, appLanguage = "en" }) {
  const { data, loading, reload } = useContent();
  const { goBack } = useNav();

  const branches = Array.isArray(data.branches) ? data.branches : [];
  const about = data.about || {};
  const primaryPhone = branches[0]?.phone || "";
  const primaryEmail = about.email || data.contactEmail || "info@shekinahsonsglobal.org";

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 150 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={reload} tintColor={C.gold} colors={[C.gold]} progressBackgroundColor={C.surface2} />
        }
      >
        <View style={ab.hero}>
          <Image source={MARBLE} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <LinearGradient
            colors={["rgba(212,175,55,0.22)", "rgba(0,0,0,0.2)", C.background]}
            locations={[0, 0.55, 1]}
            style={StyleSheet.absoluteFill}
          />
          <Image source={brandMark} style={ab.heroWatermark} />

          <Pressable
            onPress={() => goBack("Home")}
            style={({ pressed }) => [ab.backBtn, pressed && { opacity: 0.6 }]}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </Pressable>

          <View style={ab.heroBody}>
            <View style={ab.pill}>
              <Text style={ab.pillText}>ABOUT US</Text>
            </View>
            <Text style={ab.heroTitle}>SHEKINAH</Text>
            <Text style={ab.heroSub}>SONS GLOBAL</Text>
            <Text style={ab.heroLine}>{tr(appLanguage, "Raising sons who carry the presence of God to the nations.")}</Text>
          </View>
        </View>

        <View style={ab.content}>
          <LinearGradient colors={[GOLD_GRADIENT[0], GOLD_GRADIENT[1], GOLD_GRADIENT[2]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={ab.defCard}>
            <Text style={ab.defQuote}>”</Text>
            <View style={ab.defHead}>
              <Text style={ab.defWord}>shekinah</Text>
              <View style={ab.defTag}>
                <Text style={ab.defTagText}>HEBREW · NOUN</Text>
              </View>
            </View>
            <Text style={ab.defSay}>/shə-ˈkī-nə/</Text>
            <View style={ab.defRule} />
            <Text style={ab.defMeaning}>The glory of God dwelling among His people; His manifest, abiding presence.</Text>
          </LinearGradient>

          <Eyebrow label="WHO WE ARE" title="Our Vision" />
          <Text style={ab.body}>{about.vision || "To raise a generation that walks in the presence of God."}</Text>
          <Text style={[ab.body, { marginTop: 12 }]}>
            {about.description || "Shekinah Sons Global is a Christ-centered ministry devoted to worship, prayer, discipleship, and the teaching of God’s word."}
          </Text>

          {branches.length > 0 ? (
            <>
              <Eyebrow label="FIND US" title="Visit Us" />
              {branches.map(branch => (
                <BranchCard key={branch.id || branch.name} branch={branch} />
              ))}
            </>
          ) : null}

          <Eyebrow label="SAY HELLO" title="Get In Touch" />
          <ContactRow icon="call-outline" title="Call us" value={primaryPhone} disabled={!primaryPhone} onPress={() => openUrl(callUrl(primaryPhone))} />
          <ContactRow icon="logo-whatsapp" title="WhatsApp" value={primaryPhone} disabled={!primaryPhone} onPress={() => openUrl(whatsappUrl(primaryPhone))} />
          <ContactRow icon="mail-outline" title="Email us" value={primaryEmail} disabled={!primaryEmail} onPress={() => openUrl(mailUrl(primaryEmail))} />
          <ContactRow icon="globe-outline" title="Our platforms" value="YouTube, social media and more" onPress={() => go("Platforms")} />
        </View>
      </ScrollView>
      <LinearGradient colors={["rgba(0,0,0,0.92)", "rgba(0,0,0,0)"]} style={ab.statusScrim} pointerEvents="none" />
    </Screen>
  );
}

const ab = makeThemedStyles(C => ({
  hero: { height: 340, justifyContent: "flex-end", overflow: "hidden" },
  heroWatermark: { position: "absolute", width: 260, height: 260, right: -50, top: ANDROID_STATUS_BAR_HEIGHT + 10, opacity: 0.16 },
  backBtn: { position: "absolute", top: ANDROID_STATUS_BAR_HEIGHT + 8, left: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  heroBody: { paddingHorizontal: 18, paddingBottom: 18 },
  pill: { alignSelf: "flex-start", backgroundColor: C.accentPressed, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 12 },
  pillText: { color: "#FFFFFF", fontSize: 11, fontFamily: C.fontBold, letterSpacing: 1.2 },
  heroTitle: { color: C.gold, fontSize: 38, fontFamily: C.fontBrand, letterSpacing: 4, lineHeight: 44 },
  heroSub: { color: C.gold2, fontSize: 18, fontFamily: C.fontBrand, letterSpacing: 7 },
  heroLine: { color: "rgba(255,255,255,0.78)", fontSize: 14.5, lineHeight: 21, fontFamily: C.fontBody, marginTop: 12 },
  content: { paddingHorizontal: 16 },
  defCard: { borderRadius: 20, padding: 20, marginTop: 8, overflow: "hidden" },
  defQuote: { position: "absolute", right: 16, top: -18, fontSize: 120, color: "rgba(0,0,0,0.12)", fontFamily: C.fontBrand },
  defHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  defWord: { color: "#1A1405", fontSize: 28, fontFamily: C.fontScripture },
  defTag: { backgroundColor: "rgba(0,0,0,0.12)", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  defTagText: { color: "#1A1405", fontSize: 10, fontFamily: C.fontBold, letterSpacing: 1 },
  defSay: { color: "rgba(26,20,5,0.7)", fontSize: 13, fontFamily: C.fontScripture, marginTop: 2 },
  defRule: { width: 42, height: 2, backgroundColor: "rgba(26,20,5,0.35)", marginVertical: 12 },
  defMeaning: { color: "#1A1405", fontSize: 15.5, lineHeight: 22, fontFamily: C.fontBold },
  eyebrowWrap: { marginTop: 32, marginBottom: 12 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  eyebrowLine: { width: 18, height: 2, backgroundColor: C.gold },
  eyebrow: { color: C.gold, fontSize: 11, fontFamily: C.fontBold, letterSpacing: 1.6 },
  sectionTitle: { color: C.white, fontSize: 22, fontFamily: C.fontBold, marginTop: 6 },
  body: { color: C.white, opacity: 0.82, fontSize: 15, lineHeight: 23, fontFamily: C.fontBody },
  card: { backgroundColor: C.surface, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: C.lineStrong },
  cardRow: { flexDirection: "row", gap: 14 },
  contactRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  iconTile: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.goldSoft, alignItems: "center", justifyContent: "center" },
  cardTitle: { color: C.white, fontSize: 15.5, fontFamily: C.fontBold },
  cardText: { color: C.muted, fontSize: 13.5, lineHeight: 19, fontFamily: C.fontBody, marginTop: 3 },
  timeChip: { alignSelf: "flex-start", maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.accentSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginTop: 8 },
  timeChipText: { color: C.accentText, fontSize: 12, lineHeight: 17, fontFamily: C.fontMedium, flexShrink: 1 },
  statusScrim: { position: "absolute", top: 0, left: 0, right: 0, height: ANDROID_STATUS_BAR_HEIGHT + 18 },
  linkRow: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 10 },
  link: { flexDirection: "row", alignItems: "center", gap: 5 },
  linkText: { color: C.gold, fontSize: 13, fontFamily: C.fontBold }
}));
