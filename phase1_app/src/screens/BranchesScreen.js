import React, { useMemo, useState } from "react";
import {
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { PHASE1_IMAGES } from "../content";
import { C } from "../constants/theme";
import { useContent } from "../providers/ContentProvider";
import { s } from "../styles/appStyles";
import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { resolveMediaUrl } from "../utils/mediaUrl";

function branchImage(branch) {
  return resolveMediaUrl(branch?.imageUrl || branch?.image || "") || PHASE1_IMAGES.branch;
}

function branchLat(branch) {
  return Number(branch?.lat ?? branch?.latitude);
}

function branchLng(branch) {
  return Number(branch?.lng ?? branch?.longitude);
}

function hasCoordinates(branch) {
  return Number.isFinite(branchLat(branch)) && Number.isFinite(branchLng(branch));
}

function mapUrl(branch) {
  if (hasCoordinates(branch)) {
    return `https://www.google.com/maps/search/?api=1&query=${branchLat(branch)},${branchLng(branch)}`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(branch?.address || branch?.name || "Shekinah Sons Global")}`;
}

function phoneUrl(branch) {
  const phone = String(branch?.phone || "").replace(/\s+/g, "");
  return phone ? `tel:${phone}` : "";
}

function whatsappUrl(branch) {
  const phone = String(branch?.phone || "").replace(/[^\d+]/g, "");
  if (!phone) return "";

  const normalized = phone.startsWith("+") ? phone.slice(1) : phone;
  return `https://wa.me/${normalized}`;
}

function matchesQuery(branch, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  return [
    branch?.name,
    branch?.address,
    branch?.services,
    branch?.phone
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(q);
}

function BranchAction({ icon, label, disabled, onPress }) {
  return (
    <Pressable
      style={{
        flex: 1,
        minHeight: 48,
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
      disabled={disabled}
      onPress={onPress}
    >
      <Ionicons name={icon} size={17} color={disabled ? C.muted : C.gold} />
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

export function BranchesScreen({ go, appLanguage = "en" }) {
  const [query, setQuery] = useState("");
  const { data, loading, reload } = useContent();

  const branches = Array.isArray(data.branches) ? data.branches : [];

  const visible = useMemo(() => {
    return branches
      .filter(branch => branch?.id && branch?.name)
      .filter(branch => matchesQuery(branch, query));
  }, [branches, query]);

  return (
    <Screen>
      <TopBar title="Branches" go={go} back="Home" appLanguage={appLanguage} />

      <View style={s.pad}>
        <TextInput
          style={s.searchInput}
          placeholder="Search branches"
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
          <View style={s.plainCard}>
            <Text style={s.rowTitle}>No branches found</Text>
            <Text style={s.mutedText}>Church branch locations will appear here.</Text>
          </View>
        ) : (
          visible.map(branch => {
            const call = phoneUrl(branch);
            const whatsapp = whatsappUrl(branch);

            return (
              <View key={branch.id} style={s.branchCard}>
                <Image source={{ uri: branchImage(branch) }} style={s.branchImage} />

                <Text style={s.cardTitle}>{branch.name}</Text>

                <View style={[s.rowTight, { marginTop: 8 }]}>
                  <Ionicons name="location-outline" size={17} color={C.gold} />
                  <Text style={s.mutedText}>{branch.address}</Text>
                </View>

                <View style={[s.rowTight, { marginTop: 8 }]}>
                  <Ionicons name="time-outline" size={17} color={C.gold} />
                  <Text style={s.mutedText}>{branch.services}</Text>
                </View>

                <View style={[s.rowTight, { marginTop: 8 }]}>
                  <Ionicons name="call-outline" size={17} color={C.gold} />
                  <Text style={s.goldSmall}>{branch.phone}</Text>
                </View>

                <View style={[s.stats, { marginTop: 14 }]}>
                  <BranchAction
                    icon="navigate-outline"
                    label="Directions"
                    onPress={() => Linking.openURL(mapUrl(branch))}
                  />

                  <BranchAction
                    icon="call-outline"
                    label="Call"
                    disabled={!call}
                    onPress={() => Linking.openURL(call)}
                  />

                  <BranchAction
                    icon="logo-whatsapp"
                    label="WhatsApp"
                    disabled={!whatsapp}
                    onPress={() => Linking.openURL(whatsapp)}
                  />
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}
