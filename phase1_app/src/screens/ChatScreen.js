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

import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { Tabs } from "../components/Tabs";
import { C } from "../constants/theme";
import { listCommunityMessages, sendCommunityMessage } from "../api/communityApi";
import { s } from "../styles/appStyles";

const TABS = ["Global", "Live"];

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function ChatScreen({ go, openDrawer, appLanguage = "en" }) {
  const [tab, setTab] = useState("Global");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);

  const channel = useMemo(() => (tab === "Live" ? "live" : "global"), [tab]);

  async function load(showSpinner = false) {
    if (showSpinner) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await listCommunityMessages(channel);
      setMessages(Array.isArray(response?.messages) ? response.messages : []);
    } catch (error) {
      if (!showSpinner) {
        Alert.alert("Chat Unavailable", error instanceof Error ? error.message : "Unable to load chat messages.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();

    const timer = setInterval(() => {
      load(true);
    }, 5000);

    return () => clearInterval(timer);
  }, [channel]);

  async function submit() {
    const message = text.trim();
    if (message.length < 2) {
      Alert.alert("Chat Message", "Enter at least a short message before sending.");
      return;
    }

    setSending(true);

    try {
      const response = await sendCommunityMessage({
        channel,
        message
      });

      setMessages(current => [response.message, ...current].slice(0, 120));
      setText("");
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : "Unable to send your message right now.";
      if (/sign in/i.test(messageText) || /authorization/i.test(messageText)) {
        Alert.alert("Sign In Required", "Sign in first to join the community chat.", [
          { text: "Cancel", style: "cancel" },
          { text: "Open Profile", onPress: () => go("Profile") }
        ]);
        return;
      }

      Alert.alert("Message Not Sent", messageText);
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen>
      <TopBar title="Chat" go={go} onMenu={openDrawer} appLanguage={appLanguage} />

      <Tabs tabs={TABS} active={tab} setActive={setTab} appLanguage={appLanguage} />

      <ScrollView
        contentContainerStyle={s.scrollPad}
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
        <View style={s.plainCard}>
          <Text style={[s.rowTitle, { color: C.white }]}>
            {tab === "Live" ? "Live Service Chat" : "Community Chat"}
          </Text>
          <Text style={[s.mutedText, { color: C.muted }]}>
            Short encouragement, prayer points, and reactions from members.
          </Text>
        </View>

        <View style={[s.plainCard, { marginBottom: 16 }]}>
          <TextInput
            style={[
              s.searchInput,
              {
                minHeight: 92,
                textAlignVertical: "top",
                paddingTop: 12,
                color: C.white
              }
            ]}
            placeholder={tab === "Live" ? "Share a live response..." : "Write a short message..."}
            placeholderTextColor={C.muted}
            multiline
            selectionColor={C.gold}
            value={text}
            onChangeText={setText}
          />

          <Pressable style={[s.primaryBtn, sending && { opacity: 0.65 }]} onPress={submit} disabled={sending}>
            <Text style={s.primaryText}>{sending ? "Sending..." : "Send Message"}</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={s.plainCard}>
            <Text style={[s.mutedText, { color: C.muted }]}>Loading chat messages...</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={s.plainCard}>
            <Text style={[s.rowTitle, { color: C.white }]}>No messages yet</Text>
            <Text style={[s.mutedText, { color: C.muted }]}>
              Start the conversation with a short greeting or prayer point.
            </Text>
          </View>
        ) : (
          messages.map(item => (
            <View key={item.id} style={s.plainCard}>
              <View style={[s.rowTight, { justifyContent: "space-between" }]}>
                <Text style={[s.rowTitle, { color: C.white, flex: 1 }]}>{item.displayName || "Member"}</Text>
                <Text style={[s.mutedText, { color: C.muted }]}>{formatDate(item.createdAt)}</Text>
              </View>
              <Text style={[s.detailBody, { marginTop: 10 }]}>{item.message}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
