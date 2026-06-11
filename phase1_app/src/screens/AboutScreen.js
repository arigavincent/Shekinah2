import React, { useMemo } from "react";
import {
  ImageBackground,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { PHASE1_IMAGES } from "../content";
import { C } from "../constants/theme";
import { useContent } from "../providers/ContentProvider";
import { s } from "../styles/appStyles";
import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { SectionHeader } from "../components/SectionHeader";
import { Horizontal } from "../components/Horizontal";

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

function ContactButton({ icon, label, disabled, onPress }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 44,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: disabled ? C.line : C.gold,
        backgroundColor: disabled ? C.surface2 : "rgba(212, 175, 55, 0.12)",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 6,
        opacity: disabled ? 0.45 : 1,
        paddingHorizontal: 8
      }}
    >
      <Ionicons name={icon} size={16} color={disabled ? C.muted : C.gold} />
      <Text
        style={{
          color: disabled ? C.muted : C.gold,
          fontSize: 12,
          fontWeight: "900"
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function InfoCard({ icon, title, body }) {
  return (
    <View style={s.plainCard}>
      <View style={s.rowTight}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: "rgba(212, 175, 55, 0.14)",
            borderWidth: 1,
            borderColor: C.gold,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Ionicons name={icon} size={20} color={C.gold} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[s.rowTitle, { color: C.white }]}>{title}</Text>
          <Text style={[s.mutedText, { color: C.muted }]}>{body}</Text>
        </View>
      </View>
    </View>
  );
}

function BranchContactCard({ branch }) {
  const call = callUrl(branch.phone);
  const whatsapp = whatsappUrl(branch.phone);
  const directions = mapUrl(branch);

  return (
    <View
      style={[
        s.contactCard,
        {
          width: 290,
          backgroundColor: C.surface,
          borderWidth: 1,
          borderColor: C.line
        }
      ]}
    >
      <Text style={[s.cardTitle, { color: C.white }]}>{branch.name}</Text>

      <View style={[s.rowTight, { marginTop: 10 }]}>
        <Ionicons name="location-outline" size={17} color={C.gold} />
        <Text style={[s.mutedText, { color: C.muted, flex: 1 }]}>{branch.address}</Text>
      </View>

      <View style={[s.rowTight, { marginTop: 10 }]}>
        <Ionicons name="time-outline" size={17} color={C.gold} />
        <Text style={[s.mutedText, { color: C.muted, flex: 1 }]}>{branch.services}</Text>
      </View>

      <View style={[s.rowTight, { marginTop: 10 }]}>
        <Ionicons name="call-outline" size={17} color={C.gold} />
        <Text style={[s.goldSmall, { color: C.gold, flex: 1 }]}>{branch.phone}</Text>
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
        <ContactButton
          icon="navigate-outline"
          label="Map"
          onPress={() => openUrl(directions)}
        />

        <ContactButton
          icon="call-outline"
          label="Call"
          disabled={!call}
          onPress={() => openUrl(call)}
        />

        <ContactButton
          icon="logo-whatsapp"
          label="WhatsApp"
          disabled={!whatsapp}
          onPress={() => openUrl(whatsapp)}
        />
      </View>
    </View>
  );
}

function PlatformCard({ item }) {
  const url = item?.url || item?.link || "";
  const title = item?.title || item?.name || "Platform";
  const description = item?.description || item?.handle || url;

  return (
    <Pressable
      style={[
        s.plainCard,
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 12
        }
      ]}
      onPress={() => openUrl(url)}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: "rgba(212, 175, 55, 0.14)",
          borderWidth: 1,
          borderColor: C.gold,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <Ionicons name="globe-outline" size={20} color={C.gold} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={[s.rowTitle, { color: C.white }]}>{title}</Text>
        <Text style={[s.mutedText, { color: C.muted }]} numberOfLines={2}>
          {description}
        </Text>
      </View>

      <Ionicons name="open-outline" size={18} color={C.muted} />
    </Pressable>
  );
}

export function AboutScreen({ go, appLanguage = "en" }) {
  const { data, loading, reload } = useContent();

  const branches = Array.isArray(data.branches) ? data.branches : [];
  const platforms = Array.isArray(data.platforms) ? data.platforms : [];
  const about = data.about || {};

  const primaryBranch = branches[0] || {};
  const primaryPhone = primaryBranch.phone || "";
  const primaryEmail =
    about.email ||
    data.contactEmail ||
    "info@shekinahsonsglobal.org";

  const contactSummary = useMemo(() => {
    return (
      about.contactSummary ||
      "Visit one of our branches, follow our platforms, or connect with the church through the contact details provided in the app."
    );
  }, [about]);

  return (
    <Screen>
      <TopBar title="About & Contact" go={go} back="Home" appLanguage={appLanguage} />

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
        <ImageBackground
          source={{ uri: PHASE1_IMAGES.crowd }}
          style={{
            minHeight: 250,
            borderRadius: 22,
            overflow: "hidden",
            justifyContent: "flex-end",
            backgroundColor: C.surface,
            marginBottom: 16
          }}
          imageStyle={{ opacity: 0.78 }}
        >
          <View
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: "rgba(0,0,0,0.52)"
            }}
          />

          <View style={{ padding: 18 }}>
            <Text style={{ color: C.gold, fontSize: 12, fontWeight: "900" }}>
              SHEKINAH SONS GLOBAL
            </Text>

            <Text style={{ color: C.white, fontSize: 30, fontWeight: "900", marginTop: 8 }}>
              Stay connected to the house.
            </Text>

            <Text style={{ color: C.muted, fontSize: 14, fontWeight: "700", marginTop: 10 }}>
              {contactSummary}
            </Text>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <Pressable
                style={{
                  flex: 1,
                  backgroundColor: C.gold,
                  borderRadius: 999,
                  paddingVertical: 12,
                  alignItems: "center"
                }}
                onPress={() => openUrl(callUrl(primaryPhone))}
              >
                <Text style={{ color: C.black, fontWeight: "900" }}>Call Church</Text>
              </Pressable>

              <Pressable
                style={{
                  flex: 1,
                  backgroundColor: "rgba(255,255,255,0.12)",
                  borderRadius: 999,
                  paddingVertical: 12,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.16)"
                }}
                onPress={() => openUrl(whatsappUrl(primaryPhone))}
              >
                <Text style={{ color: C.white, fontWeight: "900" }}>WhatsApp</Text>
              </Pressable>
            </View>
          </View>
        </ImageBackground>

        <InfoCard
          icon="eye-outline"
          title="Our Vision"
          body={about.vision || "To raise a generation that walks in the presence of God."}
        />

        <InfoCard
          icon="information-circle-outline"
          title="About The Ministry"
          body={
            about.description ||
            "Shekinah Sons Global is a Christ-centered ministry devoted to worship, prayer, discipleship, and the teaching of God’s word."
          }
        />

        <SectionHeader title="Main Contact" />

        <View style={s.plainCard}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <ContactButton
              icon="call-outline"
              label="Call"
              disabled={!primaryPhone}
              onPress={() => openUrl(callUrl(primaryPhone))}
            />

            <ContactButton
              icon="logo-whatsapp"
              label="WhatsApp"
              disabled={!primaryPhone}
              onPress={() => openUrl(whatsappUrl(primaryPhone))}
            />

            <ContactButton
              icon="mail-outline"
              label="Email"
              disabled={!primaryEmail}
              onPress={() => openUrl(mailUrl(primaryEmail))}
            />
          </View>
        </View>

        {branches.length > 0 ? (
          <>
            <SectionHeader title="Branches" onPress={() => go("Branches")} />

            <Horizontal>
              {branches.map(branch => (
                <BranchContactCard key={branch.id} branch={branch} />
              ))}
            </Horizontal>
          </>
        ) : null}

        {platforms.length > 0 ? (
          <>
            <SectionHeader title="Platforms" onPress={() => go("Platforms")} />

            {platforms.slice(0, 4).map(item => (
              <PlatformCard key={item.id || item.title || item.name} item={item} />
            ))}
          </>
        ) : null}

        <View style={s.formNote}>
          <Ionicons name="information-circle-outline" size={20} color={C.gold} />
          <Text style={s.formNoteText}>
            About content is loaded from the backend. Branch contact actions use the phone,
            WhatsApp, email, and maps apps installed on this device.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
