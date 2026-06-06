import React, { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Linking,
  Text,
  TextInput,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useContent } from "../providers/ContentProvider";
import { C } from "../constants/theme";
import { s } from "../styles/appStyles";
import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { Tabs } from "../components/Tabs";
import { EmptyState } from "../components/Cards";
import { createPrayerRequest } from "../api/prayerRequestsApi";

const PRAYER_AUTHORITY_WHATSAPP = "254700000000";

function normalizePhone(value) {
  return String(value || "").replace(/\s+/g, "");
}

function PrayerCard({ prayer, prayedCount, onPray }) {
  const count = Number(prayer?.count || 0) + Number(prayedCount || 0);

  return (
    <View style={s.plainCard}>
      <View style={s.rowTight}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: "rgba(212, 175, 55, 0.14)",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: C.gold
          }}
        >
          <Ionicons name="heart-outline" size={21} color={C.gold} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[s.rowTitle, { color: C.white }]}>
            {prayer?.name || "Anonymous"}
          </Text>

          <Text style={[s.goldSmall, { color: C.gold }]}>
            {prayer?.date || "Today"}
          </Text>
        </View>
      </View>

      <Text style={[s.detailBody, { color: C.white, marginTop: 12 }]}>
        {prayer?.text || "Prayer request"}
      </Text>

      <Pressable
        onPress={onPray}
        style={{
          marginTop: 14,
          minHeight: 46,
          borderRadius: 999,
          backgroundColor: "rgba(212, 175, 55, 0.12)",
          borderWidth: 1,
          borderColor: C.gold,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8
        }}
      >
        <Ionicons name="flame-outline" size={18} color={C.gold} />
        <Text
          style={{
            color: C.gold,
            fontSize: 13,
            fontWeight: "900"
          }}
        >
          I Prayed · {count}
        </Text>
      </Pressable>
    </View>
  );
}

function MyRequestCard({ request }) {
  return (
    <View style={s.plainCard}>
      <Text style={[s.rowTitle, { color: C.white }]}>{request.name}</Text>
      <Text style={[s.goldSmall, { color: C.gold }]}>{request.category}</Text>
      <Text style={[s.detailBody, { color: C.white, marginTop: 8 }]}>
        {request.text}
      </Text>
      <Text style={[s.mutedText, { color: C.muted }]}>Submitted locally</Text>
    </View>
  );
}

export function PrayerScreen({ go, tab, setTab }) {
  const { data, source, loading, reload } = useContent();

  const [localPrays, setLocalPrays] = useState({});
  const [myRequests, setMyRequests] = useState([]);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    category: "Personal",
    text: ""
  });

  const prayers = Array.isArray(data.prayers) ? data.prayers : [];

  const categories = ["Personal", "Family", "Healing", "Provision", "Salvation", "Thanksgiving"];

  const visiblePrayers = useMemo(() => {
    return prayers.filter(item => item?.id && item?.text);
  }, [prayers]);

  function updateField(key, value) {
    setForm(current => ({
      ...current,
      [key]: value
    }));
  }

  function handlePray(prayer) {
    if (!prayer?.id) return;

    setLocalPrays(current => ({
      ...current,
      [prayer.id]: (current[prayer.id] || 0) + 1
    }));
  }

  function validate(cleaned) {
    if (!cleaned.name) return "Name is required. Use Anonymous if you prefer.";
    if (!cleaned.phone) return "Phone number is required.";
    if (!cleaned.email) return "Email is required.";
    if (!cleaned.text) return "Prayer request is required.";

    if (!/^(?:\+254|254|0)?[17]\d{8}$/.test(cleaned.phone)) {
      return "Use a valid Kenyan phone number, for example 0712345678 or +254712345678.";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned.email)) {
      return "Enter a valid email address.";
    }

    if (cleaned.text.length < 10) {
      return "Prayer request should be at least 10 characters.";
    }

    return "";
  }

  async function submitPrayerRequest() {
    const cleaned = {
      name: form.name.trim(),
      phone: normalizePhone(form.phone),
      email: form.email.trim(),
      category: form.category.trim(),
      text: form.text.trim()
    };

    const validationError = validate(cleaned);

    if (validationError) {
      Alert.alert("Check Prayer Request", validationError);
      return;
    }

    const message = [
      "Prayer Request - Shekinah Sons Global",
      "",
      `Name: ${cleaned.name}`,
      `Phone: ${cleaned.phone}`,
      `Email: ${cleaned.email}`,
      `Category: ${cleaned.category}`,
      "",
      cleaned.text
    ].join("\n");

    try {
      const response = await createPrayerRequest(cleaned);

      setMyRequests(current => [
        {
          id: response?.prayer?.id || `local-${Date.now()}`,
          ...cleaned
        },
        ...current
      ]);

      await reload();

      setForm({
        name: "",
        phone: "",
        email: "",
        category: "Personal",
        text: ""
      });

      const whatsappUrl = `https://wa.me/${PRAYER_AUTHORITY_WHATSAPP}?text=${encodeURIComponent(message)}`;
      await Linking.openURL(whatsappUrl);

      Alert.alert(
        "Prayer Request Submitted",
        "Your prayer request has been saved and WhatsApp has opened for sharing with the prayer team."
      );
    } catch (error) {
      Alert.alert(
        "Submission Failed",
        error instanceof Error ? error.message : "Could not submit prayer request."
      );
    }
  }

  return (
    <Screen>
      <TopBar title="Prayer Request" go={go} back="Home" />

      <Tabs
        tabs={["All Prayers", "My Requests"]}
        active={tab}
        setActive={setTab}
      />

      <View style={s.contentSourceRow}>
        <Text style={[s.contentSourceText, { color: C.muted }]}>
          {loading
            ? "Loading prayer wall..."
            : source === "api"
              ? `Prayer wall from backend · ${visiblePrayers.length}`
              : "Prayer wall from local fallback"}
        </Text>

        <Pressable onPress={reload}>
          <Text style={[s.contentReloadText, { color: C.gold }]}>Refresh</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={s.scrollPad}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {tab === "All Prayers" ? (
          visiblePrayers.length === 0 ? (
            <EmptyState
              title="No Prayer Requests"
              text="Prayer requests will appear here."
            />
          ) : (
            visiblePrayers.map(prayer => (
              <PrayerCard
                key={prayer.id}
                prayer={prayer}
                prayedCount={localPrays[prayer.id] || 0}
                onPray={() => handlePray(prayer)}
              />
            ))
          )
        ) : (
          <>
            <View style={s.formSection}>
              <Text style={s.formSectionTitle}>Submit A Prayer Request</Text>
              <Text style={s.formHelp}>
                Your request will be prepared for sending through your phone share menu.
              </Text>

              <Text style={s.inputLabel}>Name</Text>
              <TextInput
                style={s.formInput}
                placeholder="Anonymous or your name"
                placeholderTextColor={C.faint}
                value={form.name}
                onChangeText={value => updateField("name", value)}
              />

              <Text style={s.inputLabel}>Phone Number</Text>
              <TextInput
                style={s.formInput}
                placeholder="0712345678"
                placeholderTextColor={C.faint}
                keyboardType="phone-pad"
                value={form.phone}
                onChangeText={value => updateField("phone", value)}
              />

              <Text style={s.inputLabel}>Email Address</Text>
              <TextInput
                style={s.formInput}
                placeholder="name@example.com"
                placeholderTextColor={C.faint}
                keyboardType="email-address"
                autoCapitalize="none"
                value={form.email}
                onChangeText={value => updateField("email", value)}
              />

              <Text style={s.inputLabel}>Category</Text>
              <View style={s.ministryGrid}>
                {categories.map(category => {
                  const active = form.category === category;

                  return (
                    <Pressable
                      key={category}
                      style={[s.ministryChip, active && s.ministryChipActive]}
                      onPress={() => updateField("category", category)}
                    >
                      <Ionicons
                        name={active ? "checkmark-circle" : "ellipse-outline"}
                        size={17}
                        color={active ? C.black : C.gold}
                      />

                      <Text style={[s.ministryChipText, active && s.ministryChipTextActive]}>
                        {category}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={s.inputLabel}>Prayer Request</Text>
              <TextInput
                style={[s.formInput, { minHeight: 120, textAlignVertical: "top" }]}
                placeholder="Write your prayer request..."
                placeholderTextColor={C.faint}
                multiline
                value={form.text}
                onChangeText={value => updateField("text", value)}
              />

              <Pressable style={s.primaryBtn} onPress={submitPrayerRequest}>
                <Text style={s.primaryText}>Submit Prayer Request</Text>
              </Pressable>
            </View>

            {myRequests.length > 0 ? (
              <>
                <Text style={[s.sectionTitle, { marginTop: 12 }]}>My Local Requests</Text>

                {myRequests.map(request => (
                  <MyRequestCard key={request.id} request={request} />
                ))}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
