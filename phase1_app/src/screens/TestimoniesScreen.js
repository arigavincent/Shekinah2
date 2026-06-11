import React, { useEffect, useState } from "react";
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

import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { Tabs } from "../components/Tabs";
import { C } from "../constants/theme";
import { likeTestimony, listMyTestimonies, listTestimonies, submitTestimony } from "../api/testimoniesApi";
import { s } from "../styles/appStyles";

const TABS = ["Feed", "My Testimonies"];

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
}

function statusStyle(status) {
  if (status === "approved") return { color: "#4ade80" };
  if (status === "rejected") return { color: C.red };
  return { color: C.gold };
}

export function TestimoniesScreen({ go, openDrawer, appLanguage = "en" }) {
  const [tab, setTab] = useState("Feed");
  const [feed, setFeed] = useState([]);
  const [mine, setMine] = useState([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function load(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await listTestimonies();
      setFeed(Array.isArray(response?.testimonies) ? response.testimonies : []);

      try {
        const mineResponse = await listMyTestimonies();
        setMine(Array.isArray(mineResponse?.testimonies) ? mineResponse.testimonies : []);
      } catch {
        setMine([]);
      }
    } catch (error) {
      Alert.alert("Testimonies", error instanceof Error ? error.message : "Unable to load testimonies.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleLike(id) {
    try {
      const response = await likeTestimony(id);
      setFeed(current =>
        current.map(item => (item.id === id ? { ...item, likeCount: response.likeCount } : item))
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to record your testimony reaction.";
      if (/sign in/i.test(message) || /authorization/i.test(message)) {
        Alert.alert("Sign In Required", "Sign in first to support testimonies.", [
          { text: "Cancel", style: "cancel" },
          { text: "Open Profile", onPress: () => go("Profile") }
        ]);
        return;
      }

      Alert.alert("Like Failed", message);
    }
  }

  async function handleSubmit() {
    if (title.trim().length < 4) {
      Alert.alert("Testimony", "Add a short title for the testimony.");
      return;
    }

    if (body.trim().length < 20) {
      Alert.alert("Testimony", "Write at least a few lines so the testimony is meaningful.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await submitTestimony({
        title: title.trim(),
        body: body.trim()
      });

      setMine(current => [response.testimony, ...current]);
      setTitle("");
      setBody("");
      setTab("My Testimonies");
      Alert.alert("Submitted", "Your testimony was submitted for review.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to submit your testimony right now.";
      if (/sign in/i.test(message) || /authorization/i.test(message)) {
        Alert.alert("Sign In Required", "Sign in first to share your testimony.", [
          { text: "Cancel", style: "cancel" },
          { text: "Open Profile", onPress: () => go("Profile") }
        ]);
        return;
      }

      Alert.alert("Submission Failed", message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <TopBar title="Testimonies" go={go} onMenu={openDrawer} appLanguage={appLanguage} />
      <Tabs tabs={TABS} active={tab} setActive={setTab} appLanguage={appLanguage} />

      <ScrollView
        contentContainerStyle={s.scrollPad}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={C.gold}
            colors={[C.gold]}
            progressBackgroundColor={C.surface2}
          />
        }
      >
        {tab === "Feed" ? (
          <>
            <View style={s.plainCard}>
              <Text style={[s.rowTitle, { color: C.white }]}>Public Testimonies</Text>
              <Text style={[s.mutedText, { color: C.muted }]}>
                Encouragement from members after admin review.
              </Text>
            </View>

            {loading ? (
              <View style={s.plainCard}>
                <Text style={[s.mutedText, { color: C.muted }]}>Loading testimonies...</Text>
              </View>
            ) : feed.length === 0 ? (
              <View style={s.plainCard}>
                <Text style={[s.rowTitle, { color: C.white }]}>No testimonies yet</Text>
                <Text style={[s.mutedText, { color: C.muted }]}>
                  Approved testimonies will appear here.
                </Text>
              </View>
            ) : (
              feed.map(item => (
                <View key={item.id} style={s.plainCard}>
                  <View style={[s.rowTight, { justifyContent: "space-between" }]}>
                    <Text style={[s.rowTitle, { color: C.white, flex: 1 }]}>{item.title}</Text>
                    <Text style={[s.mutedText, { color: C.muted }]}>{formatDate(item.createdAt)}</Text>
                  </View>

                  <Text style={[s.goldSmall, { marginTop: 8 }]}>{item.displayName || "Member"}</Text>
                  <Text style={s.detailBody}>{item.body}</Text>

                  <Pressable style={[s.secondaryBtn, { marginTop: 12 }]} onPress={() => handleLike(item.id)}>
                    <Ionicons name="heart-outline" size={18} color={C.gold} />
                    <Text style={[s.secondaryText, { color: C.gold }]}>Amen · {item.likeCount || 0}</Text>
                  </Pressable>
                </View>
              ))
            )}
          </>
        ) : (
          <>
            <View style={s.plainCard}>
              <Text style={[s.rowTitle, { color: C.white }]}>Share Your Testimony</Text>
              <Text style={[s.mutedText, { color: C.muted }]}>
                New testimonies go through admin review before they are published.
              </Text>
            </View>

            <Text style={s.inputLabel}>Title</Text>
            <TextInput
              style={[s.searchInput, { color: C.white }]}
              placeholder="Example: God answered our family prayer"
              placeholderTextColor={C.muted}
              selectionColor={C.gold}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={s.inputLabel}>Testimony</Text>
            <TextInput
              style={[
                s.searchInput,
                {
                  minHeight: 150,
                  textAlignVertical: "top",
                  paddingTop: 12,
                  color: C.white
                }
              ]}
              placeholder="Write what the Lord has done..."
              placeholderTextColor={C.muted}
              selectionColor={C.gold}
              multiline
              value={body}
              onChangeText={setBody}
            />

            <Pressable style={[s.primaryBtn, submitting && { opacity: 0.65 }]} onPress={handleSubmit} disabled={submitting}>
              <Text style={s.primaryText}>{submitting ? "Submitting..." : "Submit Testimony"}</Text>
            </Pressable>

            <View style={[s.sectionHeader, { marginTop: 28 }]}>
              <Text style={s.sectionTitle}>My Submissions</Text>
            </View>

            {mine.length === 0 ? (
              <View style={s.plainCard}>
                <Text style={[s.mutedText, { color: C.muted }]}>
                  Your pending and approved testimonies will appear here after you sign in.
                </Text>
              </View>
            ) : (
              mine.map(item => (
                <View key={item.id} style={s.plainCard}>
                  <View style={[s.rowTight, { justifyContent: "space-between" }]}>
                    <Text style={[s.rowTitle, { color: C.white, flex: 1 }]}>{item.title}</Text>
                    <Text style={[s.goldSmall, statusStyle(item.status)]}>{item.status}</Text>
                  </View>
                  <Text style={[s.mutedText, { color: C.muted }]}>{formatDate(item.createdAt)}</Text>
                  <Text style={s.detailBody}>{item.body}</Text>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
