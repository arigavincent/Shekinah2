import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { C } from "../constants/theme";
import {
  completeReadingPlanDay,
  getReadingPlan,
  listReadingPlans,
  saveReadingPlanNote,
  updateReadingPlanReminder
} from "../api/readingPlansApi";
import { s } from "../styles/appStyles";

export function ReadingPlansScreen({ go, openDrawer, appLanguage = "en" }) {
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingNoteFor, setSavingNoteFor] = useState(0);
  const [savingReminder, setSavingReminder] = useState(false);
  const [canTrackProgress, setCanTrackProgress] = useState(false);
  const [loadError, setLoadError] = useState("");

  async function loadPlans(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      setLoadError("");
      let response;
      try {
        response = await listReadingPlans({ mine: true });
        setCanTrackProgress(true);
      } catch {
        response = await listReadingPlans();
        setCanTrackProgress(false);
      }

      setPlans(Array.isArray(response?.plans) ? response.plans : []);
    } catch (error) {
      setPlans([]);
      setCanTrackProgress(false);
      setLoadError(error instanceof Error ? error.message : "Unable to load reading plans.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function openPlan(id) {
    try {
      let response;
      try {
        response = await getReadingPlan(id, { mine: true });
        setCanTrackProgress(true);
      } catch {
        response = await getReadingPlan(id);
        setCanTrackProgress(false);
      }
      setSelectedPlan(response?.plan || null);
    } catch (error) {
      Alert.alert("Reading Plan", error instanceof Error ? error.message : "Unable to load the plan.");
    }
  }

  useEffect(() => {
    loadPlans();
  }, []);

  async function completeDay(dayNumber) {
    if (!selectedPlan?.id) return;

    try {
      await completeReadingPlanDay(selectedPlan.id, dayNumber);
      const response = await getReadingPlan(selectedPlan.id, { mine: true });
      const refreshedPlan = response?.plan || null;
      setSelectedPlan(refreshedPlan);
      setPlans(current =>
        current.map(item =>
          item.id === selectedPlan.id
            ? {
                ...item,
                completedDays: refreshedPlan?.completedDays ?? item.completedDays ?? 0
              }
            : item
        )
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save reading progress.";
      if (/sign in/i.test(message) || /authorization/i.test(message)) {
        Alert.alert("Sign In Required", "Sign in first to track reading plan progress.", [
          { text: "Cancel", style: "cancel" },
          { text: "Open Profile", onPress: () => go("Profile") }
        ]);
        return;
      }

      Alert.alert("Progress Not Saved", message);
    }
  }

  return (
    <Screen>
      <TopBar
        title="Reading Plans"
        go={go}
        back={selectedPlan ? "ReadingPlans" : undefined}
        onMenu={selectedPlan ? undefined : openDrawer}
        appLanguage={appLanguage}
      />

      <ScrollView
        contentContainerStyle={s.scrollPad}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              if (selectedPlan?.id) {
                openPlan(selectedPlan.id);
                return;
              }

              loadPlans(true);
            }}
            tintColor={C.gold}
            colors={[C.gold]}
            progressBackgroundColor={C.surface2}
          />
        }
      >
        {!selectedPlan ? (
          <>
            <View style={s.plainCard}>
              <Text style={[s.rowTitle, { color: C.white }]}>Bible Reading Plans</Text>
              <Text style={[s.mutedText, { color: C.muted }]}>
                Guided multi-day scripture and prayer plans for members.
              </Text>
            </View>

            {loading ? (
              <View style={s.plainCard}>
                <Text style={[s.mutedText, { color: C.muted }]}>Loading plans...</Text>
              </View>
            ) : loadError ? (
              <View style={s.plainCard}>
                <Text style={[s.rowTitle, { color: C.white }]}>Reading plans unavailable</Text>
                <Text style={[s.mutedText, { color: C.muted }]}>
                  We could not load reading plans right now. Pull down to refresh after a moment.
                </Text>
              </View>
            ) : plans.length === 0 ? (
              <View style={s.plainCard}>
                <Text style={[s.rowTitle, { color: C.white }]}>No reading plans yet</Text>
                <Text style={[s.mutedText, { color: C.muted }]}>
                  Plans will appear here after they are added.
                </Text>
              </View>
            ) : (
              plans.map(plan => (
                <Pressable key={plan.id} style={s.eventLarge} onPress={() => openPlan(plan.id)}>
                  {plan.imageUrl ? (
                    <Image source={{ uri: plan.imageUrl }} style={s.eventLargeImage} resizeMode="cover" />
                  ) : null}

                  <View style={{ paddingHorizontal: 14 }}>
                    <Text style={[s.rowTitle, { color: C.white }]}>{plan.title}</Text>
                    <Text style={[s.mutedText, { color: C.muted, marginTop: 6 }]}>
                      {plan.description}
                    </Text>
                    <Text style={[s.goldSmall, { marginTop: 10 }]}>
                      {plan.completedDays || 0} / {plan.durationDays} completed
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </>
        ) : (
          <>
            <View style={s.plainCard}>
              <Text style={[s.detailTitle, { color: C.white, marginTop: 0 }]}>{selectedPlan.title}</Text>
              <Text style={[s.mutedText, { color: C.muted }]}>
                {selectedPlan.description}
              </Text>
              <Text style={[s.goldSmall, { marginTop: 12 }]}>
                {selectedPlan.completedDays || 0} / {selectedPlan.durationDays} completed
              </Text>
              <Text style={[s.mutedText, { color: C.muted, marginTop: 6 }]}>
                Current streak: {selectedPlan.streakDays || 0} day(s)
              </Text>
              {canTrackProgress ? (
              <View style={[s.plainCard, { marginTop: 16, backgroundColor: C.surface2 }]}>
                <View style={[s.rowTight, { justifyContent: "space-between" }]}>
                  <Text style={[s.rowTitle, { color: C.white }]}>Reminder</Text>
                  <Switch
                    value={Boolean(selectedPlan.reminderOn)}
                    onValueChange={async value => {
                      try {
                        setSavingReminder(true);
                        await updateReadingPlanReminder(
                          selectedPlan.id,
                          value,
                          selectedPlan.reminderTime || "06:00"
                        );
                        const response = await getReadingPlan(selectedPlan.id, { mine: true });
                        setSelectedPlan(response?.plan || null);
                      } catch (error) {
                        Alert.alert("Reminder", error instanceof Error ? error.message : "Unable to update reminder.");
                      } finally {
                        setSavingReminder(false);
                      }
                    }}
                    thumbColor={C.gold}
                  />
                </View>
                <Text style={[s.mutedText, { color: C.muted, marginBottom: 8 }]}>
                  Daily reminder time (24h format)
                </Text>
                <TextInput
                  style={[s.searchInput, { color: C.white }]}
                  placeholder="06:00"
                  placeholderTextColor={C.muted}
                  selectionColor={C.gold}
                  value={selectedPlan.reminderTime || "06:00"}
                  editable={!savingReminder}
                  onChangeText={value =>
                    setSelectedPlan(current => (current ? { ...current, reminderTime: value } : current))
                  }
                  onEndEditing={async () => {
                    try {
                      setSavingReminder(true);
                      await updateReadingPlanReminder(
                        selectedPlan.id,
                        Boolean(selectedPlan.reminderOn),
                        selectedPlan.reminderTime || "06:00"
                      );
                    } catch (error) {
                      Alert.alert("Reminder", error instanceof Error ? error.message : "Unable to save reminder time.");
                    } finally {
                      setSavingReminder(false);
                    }
                  }}
                />
              </View>
              ) : (
                <View style={[s.plainCard, { marginTop: 16, backgroundColor: C.surface2 }]}>
                  <Text style={[s.rowTitle, { color: C.white }]}>Track your progress</Text>
                  <Text style={[s.mutedText, { color: C.muted }]}>
                    Sign in to mark days complete, save notes, and set reading reminders.
                  </Text>
                  <Pressable style={s.primaryBtn} onPress={() => go("Profile")}>
                    <Text style={s.primaryText}>Sign In</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {selectedPlan.days?.map(day => (
              <View key={day.id} style={s.plainCard}>
                <View style={[s.rowTight, { justifyContent: "space-between" }]}>
                  <Text style={[s.rowTitle, { color: C.white, flex: 1 }]}>
                    Day {day.dayNumber} · {day.title}
                  </Text>
                  {day.completed ? <Ionicons name="checkmark-circle" size={22} color="#4ade80" /> : null}
                </View>

                <Text style={[s.goldSmall, { marginTop: 8 }]}>{day.reference}</Text>
                <Text style={s.detailBody}>{day.description}</Text>
                {day.prayerPrompt ? (
                  <Text style={[s.mutedText, { color: C.muted, marginTop: 10 }]}>
                    Prayer: {day.prayerPrompt}
                  </Text>
                ) : null}

                {canTrackProgress ? (
                <>
                <Text style={s.inputLabel}>My Note</Text>
                <TextInput
                  style={[
                    s.searchInput,
                    {
                      minHeight: 100,
                      textAlignVertical: "top",
                      paddingTop: 12,
                      color: C.white
                    }
                  ]}
                  placeholder="Write what stood out, a prayer, or next step..."
                  placeholderTextColor={C.muted}
                  selectionColor={C.gold}
                  multiline
                  value={day.note || ""}
                  onChangeText={value =>
                    setSelectedPlan(current =>
                      current
                        ? {
                            ...current,
                            days: current.days.map(item =>
                              item.dayNumber === day.dayNumber ? { ...item, note: value } : item
                            )
                          }
                        : current
                    )
                  }
                />

                <Pressable
                  style={[s.secondaryBtn, savingNoteFor === day.dayNumber && { opacity: 0.65 }]}
                  onPress={async () => {
                    try {
                      setSavingNoteFor(day.dayNumber);
                      await saveReadingPlanNote(selectedPlan.id, day.dayNumber, day.note || "");
                      showSaved(day.dayNumber);
                    } catch (error) {
                      Alert.alert("Reading Note", error instanceof Error ? error.message : "Unable to save this note.");
                    } finally {
                      setSavingNoteFor(0);
                    }
                  }}
                  disabled={savingNoteFor === day.dayNumber}
                >
                  <Text style={s.secondaryText}>
                    {savingNoteFor === day.dayNumber ? "Saving..." : "Save Note"}
                  </Text>
                </Pressable>

                {!day.completed ? (
                  <Pressable style={s.primaryBtn} onPress={() => completeDay(day.dayNumber)}>
                    <Text style={s.primaryText}>Mark Complete</Text>
                  </Pressable>
                ) : null}
                </>
                ) : null}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function showSaved(dayNumber) {
  Alert.alert("Saved", `Your note for day ${dayNumber} was saved.`);
}
