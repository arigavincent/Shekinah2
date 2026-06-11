import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { C } from "../constants/theme";
import { completeReadingPlanDay, getReadingPlan, listReadingPlans } from "../api/readingPlansApi";
import { s } from "../styles/appStyles";

export function ReadingPlansScreen({ go, openDrawer, appLanguage = "en" }) {
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadPlans(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      let response;
      try {
        response = await listReadingPlans({ mine: true });
      } catch {
        response = await listReadingPlans();
      }

      setPlans(Array.isArray(response?.plans) ? response.plans : []);
    } catch (error) {
      Alert.alert("Reading Plans", error instanceof Error ? error.message : "Unable to load reading plans.");
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
      } catch {
        response = await getReadingPlan(id);
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
      setSelectedPlan(response?.plan || null);
      setPlans(current =>
        current.map(item =>
          item.id === selectedPlan.id
            ? {
                ...item,
                completedDays: Math.max(item.completedDays || 0, dayNumber)
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

                {!day.completed ? (
                  <Pressable style={s.primaryBtn} onPress={() => completeDay(day.dayNumber)}>
                    <Text style={s.primaryText}>Mark Complete</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
