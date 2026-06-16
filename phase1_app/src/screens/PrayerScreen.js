import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useContent } from "../providers/ContentProvider";
import { C } from "../constants/theme";
import { tr } from "../i18n/labels";
import { s } from "../styles/appStyles";
import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { Tabs } from "../components/Tabs";
import { EmptyState } from "../components/Cards";
import { loadSavedSession } from "../features/profile/authSession";
import {
  createPrayerRequest,
  listMyPrayerRequests,
  listPublicPrayerRequests,
  prayForRequest
} from "../api/prayerRequestsApi";

const CATEGORIES = ["Personal", "Family", "Healing", "Provision", "Salvation", "Thanksgiving"];

const INITIAL_FORM = {
  category: "Personal",
  text: "",
  isPublic: true,
  anonymous: false
};

function visibilityLabel(prayer) {
  return prayer?.isPublic ? "Public" : "Private";
}

function prayerStatusLabel(prayer) {
  switch (prayer?.status) {
    case "reviewed":
      return "Reviewed";
    case "prayed_for":
      return "Prayed For";
    case "contacted":
      return "Contacted";
    case "hidden":
      return "Hidden";
    default:
      return "Under Review";
  }
}

function PrayerCard({ prayer, onPray, disabled, appLanguage }) {
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
            {prayer?.name || tr(appLanguage, "Anonymous")}
          </Text>

          <Text style={[s.goldSmall, { color: C.gold }]}>
            {prayer?.date || tr(appLanguage, "Today")} · {tr(appLanguage, prayer?.category || "Prayer")}
          </Text>
        </View>
      </View>

      <Text style={[s.detailBody, { color: C.white, marginTop: 12 }]}>
        {prayer?.text || tr(appLanguage, "Prayer request")}
      </Text>

      <Pressable
        onPress={onPray}
        disabled={disabled}
        style={{
          marginTop: 14,
          minHeight: 46,
          borderRadius: 999,
          backgroundColor: disabled ? C.surface2 : "rgba(212, 175, 55, 0.12)",
          borderWidth: 1,
          borderColor: disabled ? C.line : C.gold,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 8
        }}
      >
        <Ionicons name="flame-outline" size={18} color={disabled ? C.muted : C.gold} />
        <Text
          style={{
            color: disabled ? C.muted : C.gold,
            fontSize: 13,
            fontWeight: "900"
          }}
        >
          {disabled ? tr(appLanguage, "Sign in to pray") : `${tr(appLanguage, "Praying")} · ${Number(prayer?.count || 0)}`}
        </Text>
      </Pressable>
    </View>
  );
}

function MyRequestCard({ request, appLanguage }) {
  return (
    <View style={s.plainCard}>
      <View style={s.rowTight}>
        <Text style={[s.rowTitle, { color: C.white, flex: 1 }]} numberOfLines={1}>
          {request?.category || "Prayer"}
        </Text>

        <Text style={[s.goldSmall, { color: C.gold }]}>
          {tr(appLanguage, visibilityLabel(request))}
        </Text>
      </View>

      <Text style={[s.detailBody, { color: C.white, marginTop: 8 }]}>
        {request?.text}
      </Text>

      <Text style={[s.mutedText, { color: C.muted, marginTop: 10 }]}>
        {request?.date || tr(appLanguage, "Today")} · {Number(request?.count || 0)} {tr(appLanguage, "Praying").toLowerCase()}
      </Text>

      <Text style={[s.goldSmall, { color: C.gold, marginTop: 8 }]}>
        {tr(appLanguage, "Status")} · {tr(appLanguage, prayerStatusLabel(request))}
      </Text>
    </View>
  );
}

function SignedOutNotice({ go, appLanguage }) {
  return (
    <View style={s.formSection}>
      <Text style={s.formSectionTitle}>{tr(appLanguage, "Member Access")}</Text>
      <Text style={s.formHelp}>
        {tr(appLanguage, "Sign in to post your own prayer requests, choose public or private visibility, and support others with Praying.")}
      </Text>

      <Pressable style={s.primaryBtn} onPress={() => go("Profile")}>
        <Text style={s.primaryText}>{tr(appLanguage, "Sign In")}</Text>
      </Pressable>
    </View>
  );
}

export function PrayerScreen({ go, tab, setTab, appLanguage = "en" }) {
  const { data, reload } = useContent();
  const fallbackPrayers = Array.isArray(data.prayers) ? data.prayers : [];

  const [session, setSession] = useState({ token: null, user: null });
  const [publicPrayers, setPublicPrayers] = useState(fallbackPrayers);
  const [myRequests, setMyRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

  const signedIn = Boolean(session?.token && session?.user);
  const showStickySubmit = signedIn && tab === "My Requests";

  const visiblePrayers = useMemo(() => {
    return publicPrayers.filter(item => item?.id && item?.text);
  }, [publicPrayers]);

  const visibleMine = useMemo(() => {
    return myRequests.filter(item => item?.id && item?.text);
  }, [myRequests]);

  async function loadPrayerWall() {
    setLoading(true);

    try {
      const savedSession = await loadSavedSession().catch(() => ({
        token: null,
        user: null
      }));

      setSession(savedSession);

      const publicResponse = await listPublicPrayerRequests().catch(() => null);
      if (publicResponse?.prayers) {
        setPublicPrayers(publicResponse.prayers);
      } else {
        setPublicPrayers(fallbackPrayers);
      }

      if (savedSession?.token) {
        const mineResponse = await listMyPrayerRequests().catch(() => null);
        setMyRequests(Array.isArray(mineResponse?.prayers) ? mineResponse.prayers : []);
      } else {
        setMyRequests([]);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPrayerWall();
  }, []);

  function updateField(key, value) {
    setForm(current => ({
      ...current,
      [key]: value
    }));
  }

  function mergePrayer(list, prayer) {
    const next = Array.isArray(list) ? [...list] : [];
    const index = next.findIndex(item => item.id === prayer.id);

    if (index >= 0) {
      next[index] = prayer;
      return next;
    }

    return [prayer, ...next];
  }

  async function handlePray(prayer) {
    if (!signedIn) {
      Alert.alert(tr(appLanguage, "Sign In Required"), tr(appLanguage, "Sign in first to support prayer requests."));
      go("Profile");
      return;
    }

    try {
      const response = await prayForRequest(prayer.id);

      if (response?.prayer) {
        setPublicPrayers(current => mergePrayer(current, response.prayer));
      }

      if (response?.prayed === false) {
        Alert.alert(tr(appLanguage, "Already Prayed"), tr(appLanguage, "You have already marked this prayer request as prayed for."));
      }
    } catch (error) {
      Alert.alert(
        tr(appLanguage, "Prayer Support Failed"),
        error instanceof Error ? error.message : tr(appLanguage, "Could not record your prayer support.")
      );
    }
  }

  async function submitPrayerRequest() {
    if (!signedIn) {
      Alert.alert(tr(appLanguage, "Sign In Required"), tr(appLanguage, "Sign in first to post your prayer request."));
      go("Profile");
      return;
    }

    const text = form.text.trim();
    if (text.length < 10) {
      Alert.alert(tr(appLanguage, "Check Prayer Request"), tr(appLanguage, "Prayer request should be at least 10 characters."));
      return;
    }

    setSubmitting(true);

    try {
      const response = await createPrayerRequest({
        category: form.category,
        text,
        isPublic: form.isPublic,
        anonymous: form.anonymous
      });

      if (response?.prayer) {
        setMyRequests(current => mergePrayer(current, response.prayer));

        if (response.prayer.isPublic) {
          setPublicPrayers(current => mergePrayer(current, response.prayer));
        }
      }

      setForm(INITIAL_FORM);
      await reload().catch(() => {});

      Alert.alert(
        tr(appLanguage, "Prayer Request Submitted"),
        form.isPublic
          ? tr(appLanguage, "Your public prayer request has been sent for review. It will appear on the Prayer Wall after approval.")
          : tr(appLanguage, "Your private prayer request has been saved to My Requests and is available to the church team in admin review.")
      );
    } catch (error) {
      Alert.alert(
        tr(appLanguage, "Submission Failed"),
        error instanceof Error ? error.message : tr(appLanguage, "Could not submit prayer request.")
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <TopBar title="Prayer Wall" go={go} back="Home" appLanguage={appLanguage} />

      <Tabs
        tabs={["All Prayers", "My Requests"]}
        active={tab}
        setActive={setTab}
        appLanguage={appLanguage}
      />

      <ScrollView
        contentContainerStyle={[s.scrollPad, { paddingBottom: showStickySubmit ? 320 : 210 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadPrayerWall}
            tintColor={C.gold}
            colors={[C.gold]}
            progressBackgroundColor={C.surface2}
          />
        }
      >
        {tab === "All Prayers" ? (
          visiblePrayers.length === 0 ? (
            <EmptyState
              title={tr(appLanguage, "No Prayer Requests")}
              text={tr(appLanguage, "Public prayer requests will appear here.")}
            />
          ) : (
            visiblePrayers.map(prayer => (
              <PrayerCard
                key={prayer.id}
                prayer={prayer}
                appLanguage={appLanguage}
                onPray={() => handlePray(prayer)}
                disabled={!signedIn}
              />
            ))
          )
        ) : (
          <>
            {!signedIn ? <SignedOutNotice go={go} appLanguage={appLanguage} /> : null}

            {signedIn ? (
              <View style={s.formSection}>
                <Text style={s.formSectionTitle}>{tr(appLanguage, "Submit A Prayer Request")}</Text>
                <Text style={s.formHelp}>
                  {tr(appLanguage, "Public requests appear on the wall after church team review. Private requests stay off the wall and can be reviewed by the church team in admin.")}
                </Text>

                <Text style={s.inputLabel}>{tr(appLanguage, "Category")}</Text>
                <View style={s.ministryGrid}>
                  {CATEGORIES.map(category => {
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
                        <Text
                          style={[
                            s.ministryChipText,
                            active && s.ministryChipTextActive
                          ]}
                        >
                          {tr(appLanguage, category)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={s.inputLabel}>{tr(appLanguage, "Visibility")}</Text>
                <View style={s.rowTight}>
                  {[
                    { label: "Public", value: true },
                    { label: "Private", value: false }
                  ].map(option => {
                    const active = form.isPublic === option.value;

                    return (
                      <Pressable
                        key={option.label}
                        style={[
                          s.compactChipBtn,
                          active && s.activeChip
                        ]}
                        onPress={() => updateField("isPublic", option.value)}
                      >
                        <Text
                          style={[
                            s.compactChipText,
                            active && { color: C.black }
                          ]}
                        >
                          {tr(appLanguage, option.label)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={s.inputLabel}>{tr(appLanguage, "Display Name")}</Text>
                <View style={s.rowTight}>
                  {[
                    { label: "My Name", value: false },
                    { label: "Anonymous", value: true }
                  ].map(option => {
                    const active = form.anonymous === option.value;

                    return (
                      <Pressable
                        key={option.label}
                        style={[
                          s.compactChipBtn,
                          active && s.activeChip
                        ]}
                        onPress={() => updateField("anonymous", option.value)}
                      >
                        <Text
                          style={[
                            s.compactChipText,
                            active && { color: C.black }
                          ]}
                        >
                          {tr(appLanguage, option.label)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={s.inputLabel}>{tr(appLanguage, "Prayer Request")}</Text>
                <TextInput
                  style={[
                    s.formInput,
                    {
                      minHeight: 116,
                      textAlignVertical: "top",
                      paddingTop: 12
                    }
                  ]}
                  placeholder={tr(appLanguage, "Share what you would like the church to pray with you about.")}
                  placeholderTextColor={C.faint}
                  multiline
                  value={form.text}
                  onChangeText={value => updateField("text", value)}
                />

              </View>
            ) : null}

            {signedIn && visibleMine.length === 0 ? (
              <EmptyState
                title={tr(appLanguage, "No Requests Yet")}
                text={tr(appLanguage, "Your public and private prayer requests will appear here.")}
              />
            ) : null}

            {signedIn
              ? visibleMine.map(request => (
                  <MyRequestCard key={request.id} request={request} appLanguage={appLanguage} />
                ))
              : null}
          </>
        )}
      </ScrollView>

      {showStickySubmit ? (
        <View
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 132
          }}
        >
          <Pressable
            style={[
              s.primaryBtn,
              {
                marginTop: 0,
                borderRadius: 18,
                minHeight: 54
              },
              submitting && { opacity: 0.65 }
            ]}
            onPress={submitPrayerRequest}
            disabled={submitting}
          >
            <Text style={s.primaryText}>
              {submitting ? tr(appLanguage, "Submitting...") : tr(appLanguage, "Submit Prayer Request")}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}
