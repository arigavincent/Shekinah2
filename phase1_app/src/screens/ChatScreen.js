import React, { useCallback, useEffect, useState } from "react";
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
import {
  listPrivateChatRequests,
  listPrivateChatThreads,
  respondPrivateChatRequest
} from "../api/privateChatApi";
import { loadSavedSession } from "../features/profile/authSession";
import { tr } from "../i18n/labels";
import {
  ensurePrivateChatDevice,
  publicKeyFingerprint
} from "../services/privateChatCrypto";
import { s } from "../styles/appStyles";

const TABS = ["Community", "Private"];

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function RequestRow({ item, onAccept, onReject, onOpenThread, appLanguage = "en", busy = false }) {
  const peer = item?.peer || {};
  const hasDevice = Boolean(peer?.hasDevice || peer?.deviceId);

  return (
    <View style={s.plainCard}>
      <View style={[s.rowTight, { justifyContent: "space-between" }]}>
        <Text style={[s.rowTitle, { color: C.white, flex: 1 }]}>{peer?.displayName || tr(appLanguage, "Member")}</Text>
        <Text style={[s.mutedText, { color: C.muted }]}>{formatDate(item?.updatedAt || item?.createdAt)}</Text>
      </View>
      <Text style={[s.mutedText, { color: hasDevice ? C.gold : C.muted, marginTop: 8 }]}>
        {hasDevice
          ? `${tr(appLanguage, "Encrypted Ready")} · ${peer?.fingerprint || ""}`
          : tr(appLanguage, "Encrypted chat will be ready once this member enables it on their device.")}
      </Text>

      <View style={[s.bottomActions, { marginTop: 14, flexWrap: "wrap" }]}>
        {typeof onOpenThread === "function" ? (
          <Pressable style={s.actionBtn} onPress={onOpenThread}>
            <Ionicons name="chatbubble-ellipses-outline" size={17} color={C.white} />
            <Text style={s.actionText}>{tr(appLanguage, "Open Chat")}</Text>
          </Pressable>
        ) : null}
        {typeof onAccept === "function" ? (
          <Pressable style={[s.actionBtn, busy && { opacity: 0.6 }]} onPress={onAccept} disabled={busy}>
            <Ionicons name="checkmark-outline" size={17} color={C.white} />
            <Text style={s.actionText}>{tr(appLanguage, "Accept Request")}</Text>
          </Pressable>
        ) : null}
        {typeof onReject === "function" ? (
          <Pressable style={[s.actionBtn, busy && { opacity: 0.6 }]} onPress={onReject} disabled={busy}>
            <Ionicons name="close-outline" size={17} color={C.white} />
            <Text style={s.actionText}>{tr(appLanguage, "Decline")}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function ChatScreen({ go, openDrawer, tab, setTab, detail, appLanguage = "en" }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [session, setSession] = useState({ token: null, user: null });
  const [privateThreads, setPrivateThreads] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [privateLoading, setPrivateLoading] = useState(true);
  const [privateRefreshing, setPrivateRefreshing] = useState(false);
  const [deviceFingerprint, setDeviceFingerprint] = useState("");
  const [requestBusyId, setRequestBusyId] = useState("");

  const activeTab = tab || "Community";
  const signedIn = Boolean(session?.token && session?.user);

  const loadCommunity = useCallback(
    async showSpinner => {
      if (showSpinner) setRefreshing(true);
      else setLoading(true);

      try {
        const response = await listCommunityMessages("global");
        setMessages(Array.isArray(response?.messages) ? response.messages : []);
      } catch (error) {
        if (!showSpinner) {
          Alert.alert(
            tr(appLanguage, "Chat Unavailable"),
            error instanceof Error ? error.message : tr(appLanguage, "Unable to load chat messages.")
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [appLanguage]
  );

  const loadPrivate = useCallback(
    async showSpinner => {
      if (showSpinner) setPrivateRefreshing(true);
      else setPrivateLoading(true);

      try {
        const savedSession = await loadSavedSession();
        setSession(savedSession);

        if (!savedSession?.token || !savedSession?.user) {
          setPrivateThreads([]);
          setIncomingRequests([]);
          setOutgoingRequests([]);
          setDeviceFingerprint("");
          return;
        }

        const identity = await ensurePrivateChatDevice(savedSession.user.id);
        setDeviceFingerprint(await publicKeyFingerprint(identity.identityPublicKey));

        const [threadsResponse, requestsResponse] = await Promise.all([
          listPrivateChatThreads(),
          listPrivateChatRequests()
        ]);

        setPrivateThreads(Array.isArray(threadsResponse?.threads) ? threadsResponse.threads : []);
        setIncomingRequests(Array.isArray(requestsResponse?.incoming) ? requestsResponse.incoming : []);
        setOutgoingRequests(Array.isArray(requestsResponse?.outgoing) ? requestsResponse.outgoing : []);
      } catch (error) {
        if (!showSpinner) {
          Alert.alert(
            tr(appLanguage, "Private Chat"),
            error instanceof Error ? error.message : tr(appLanguage, "Unable to load encrypted chat.")
          );
        }
      } finally {
        setPrivateLoading(false);
        setPrivateRefreshing(false);
      }
    },
    [appLanguage]
  );

  useEffect(() => {
    let active = true;

    (async () => {
      const savedSession = await loadSavedSession();
      if (!active) return;
      setSession(savedSession);
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (detail?.tab && typeof setTab === "function") {
      setTab(detail.tab);
    }
  }, [detail?.tab, setTab]);

  useEffect(() => {
    if (activeTab === "Private") {
      loadPrivate(false);
      const timer = setInterval(() => {
        loadPrivate(true);
      }, 7000);

      return () => clearInterval(timer);
    }

    loadCommunity(false);
    const timer = setInterval(() => {
      loadCommunity(true);
    }, 5000);

    return () => clearInterval(timer);
  }, [activeTab, loadCommunity, loadPrivate]);

  async function submitCommunity() {
    const message = text.trim();
    if (message.length < 2) {
      Alert.alert(tr(appLanguage, "Chat Message"), tr(appLanguage, "Enter at least a short message before sending."));
      return;
    }

    setSending(true);

    try {
      const response = await sendCommunityMessage({
        channel: "global",
        message
      });

      setMessages(current => [response.message, ...current].slice(0, 120));
      setText("");
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : tr(appLanguage, "Unable to send your message right now.");
      if (/sign in/i.test(messageText) || /authorization/i.test(messageText)) {
        Alert.alert(tr(appLanguage, "Sign In Required"), tr(appLanguage, "Sign in first to join the community chat."), [
          { text: tr(appLanguage, "Cancel"), style: "cancel" },
          { text: tr(appLanguage, "Open Profile"), onPress: () => go("Profile") }
        ]);
        return;
      }

      Alert.alert(tr(appLanguage, "Message Not Sent"), messageText);
    } finally {
      setSending(false);
    }
  }

  async function handleRequestAction(requestId, action) {
    setRequestBusyId(requestId);

    try {
      const response = await respondPrivateChatRequest(requestId, action);
      setIncomingRequests(current => current.filter(item => item.id !== requestId));
      if (response?.thread) {
        setPrivateThreads(current => {
          const others = current.filter(item => item?.id !== response.thread.id);
          return [response.thread, ...others];
        });
        go("PrivateChatThread", { thread: response.thread });
      }
    } catch (error) {
      Alert.alert(
        tr(appLanguage, "Private Chat"),
        error instanceof Error ? error.message : tr(appLanguage, "Unable to update the chat request.")
      );
    } finally {
      setRequestBusyId("");
    }
  }

  function renderCommunity() {
    return (
      <>
        <View style={s.plainCard}>
          <Text style={[s.rowTitle, { color: C.white }]}>{tr(appLanguage, "Community Chat")}</Text>
          <Text style={[s.mutedText, { color: C.muted }]}>
            {tr(appLanguage, "General church conversation, encouragement, and prayer points outside the active livestream.")}
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
            placeholder={tr(appLanguage, "Write a short message...")}
            placeholderTextColor={C.muted}
            multiline
            selectionColor={C.gold}
            value={text}
            onChangeText={setText}
          />

          <Pressable style={[s.primaryBtn, sending && { opacity: 0.65 }]} onPress={submitCommunity} disabled={sending}>
            <Text style={s.primaryText}>{sending ? tr(appLanguage, "Sending...") : tr(appLanguage, "Send Message")}</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={s.plainCard}>
            <Text style={[s.mutedText, { color: C.muted }]}>{tr(appLanguage, "Loading chat messages...")}</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={s.plainCard}>
            <Text style={[s.rowTitle, { color: C.white }]}>{tr(appLanguage, "No messages yet")}</Text>
            <Text style={[s.mutedText, { color: C.muted }]}>
              {tr(appLanguage, "Start the conversation with a short greeting or prayer point.")}
            </Text>
          </View>
        ) : (
          messages.map(item => (
            <View key={item.id} style={s.plainCard}>
              <View style={[s.rowTight, { justifyContent: "space-between" }]}>
                <Pressable onPress={() => go("MemberProfile", { memberId: item.userId, displayName: item.displayName })}>
                  <Text style={[s.rowTitle, { color: C.white }]}>{item.displayName || tr(appLanguage, "Member")}</Text>
                </Pressable>
                <Text style={[s.mutedText, { color: C.muted }]}>{formatDate(item.createdAt)}</Text>
              </View>
              <Text style={[s.detailBody, { marginTop: 10 }]}>{item.message}</Text>
            </View>
          ))
        )}
      </>
    );
  }

  function renderPrivate() {
    if (!signedIn) {
      return (
        <View style={s.plainCard}>
          <Text style={[s.rowTitle, { color: C.white }]}>{tr(appLanguage, "Private Chat")}</Text>
          <Text style={[s.mutedText, { color: C.muted }]}>
            {tr(appLanguage, "Private chat starts from a member profile. Send a request, wait for acceptance, then open the encrypted thread here.")}
          </Text>
          <Pressable style={s.primaryBtn} onPress={() => go("Profile")}>
            <Text style={s.primaryText}>{tr(appLanguage, "Sign In")}</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <>
        <View style={s.plainCard}>
          <Text style={[s.rowTitle, { color: C.white }]}>{tr(appLanguage, "Encrypted Chat")}</Text>
          <Text style={[s.mutedText, { color: C.muted }]}>
            {tr(appLanguage, "Tap a member name in Community Chat to open their profile and send a private chat request.")}
          </Text>
          {deviceFingerprint ? (
            <Text style={[s.goldSmall, { marginTop: 10 }]}>
              {tr(appLanguage, "Your Fingerprint")} · {deviceFingerprint}
            </Text>
          ) : null}
        </View>

        {privateLoading ? (
          <View style={s.plainCard}>
            <Text style={[s.mutedText, { color: C.muted }]}>{tr(appLanguage, "Loading encrypted chat...")}</Text>
          </View>
        ) : (
          <>
            <View style={s.plainCard}>
              <Text style={[s.rowTitle, { color: C.white }]}>{tr(appLanguage, "Incoming Requests")}</Text>
              <Text style={[s.mutedText, { color: C.muted }]}>
                {tr(appLanguage, "Accept a request to unlock a private encrypted thread with that member.")}
              </Text>
            </View>

            {incomingRequests.length === 0 ? (
              <View style={s.plainCard}>
                <Text style={[s.mutedText, { color: C.muted }]}>{tr(appLanguage, "No incoming requests")}</Text>
              </View>
            ) : (
              incomingRequests.map(item => (
                <RequestRow
                  key={item.id}
                  item={item}
                  onAccept={() => handleRequestAction(item.id, "accept")}
                  onReject={() => handleRequestAction(item.id, "reject")}
                  busy={requestBusyId === item.id}
                  appLanguage={appLanguage}
                />
              ))
            )}

            <View style={s.plainCard}>
              <Text style={[s.rowTitle, { color: C.white }]}>{tr(appLanguage, "Existing Threads")}</Text>
              <Text style={[s.mutedText, { color: C.muted }]}>
                {tr(appLanguage, "Accepted requests become encrypted private threads here.")}
              </Text>
            </View>

            {privateThreads.length === 0 ? (
              <View style={s.plainCard}>
                <Text style={[s.mutedText, { color: C.muted }]}>{tr(appLanguage, "No private threads yet")}</Text>
              </View>
            ) : (
              privateThreads.map(item => (
                <Pressable
                  key={item.id}
                  style={s.plainCard}
                  onPress={() => go("PrivateChatThread", { thread: item })}
                >
                  <View style={[s.rowTight, { justifyContent: "space-between" }]}>
                    <Text style={[s.rowTitle, { color: C.white, flex: 1 }]}>{item?.peer?.displayName || tr(appLanguage, "Member")}</Text>
                    <Text style={[s.mutedText, { color: C.muted }]}>{formatDate(item?.lastMessageAt)}</Text>
                  </View>
                  <Text style={[s.mutedText, { color: C.gold, marginTop: 8 }]}>
                    {tr(appLanguage, "Encrypted Ready")} · {item?.peer?.fingerprint || ""}
                  </Text>
                </Pressable>
              ))
            )}

            <View style={s.plainCard}>
              <Text style={[s.rowTitle, { color: C.white }]}>{tr(appLanguage, "Outgoing Requests")}</Text>
              <Text style={[s.mutedText, { color: C.muted }]}>
                {tr(appLanguage, "These members still need to accept your request before private chat opens.")}
              </Text>
            </View>

            {outgoingRequests.length === 0 ? (
              <View style={s.plainCard}>
                <Text style={[s.mutedText, { color: C.muted }]}>{tr(appLanguage, "No outgoing requests")}</Text>
              </View>
            ) : (
              outgoingRequests.map(item => (
                <RequestRow
                  key={item.id}
                  item={item}
                  appLanguage={appLanguage}
                />
              ))
            )}
          </>
        )}
      </>
    );
  }

  return (
    <Screen>
      <TopBar title="Chat" go={go} onMenu={openDrawer} appLanguage={appLanguage} />

      <Tabs tabs={TABS} active={activeTab} setActive={setTab} appLanguage={appLanguage} />

      <ScrollView
        contentContainerStyle={s.scrollPad}
        refreshControl={
          <RefreshControl
            refreshing={activeTab === "Private" ? privateRefreshing : refreshing}
            onRefresh={() => (activeTab === "Private" ? loadPrivate(true) : loadCommunity(true))}
            tintColor={C.gold}
            colors={[C.gold]}
            progressBackgroundColor={C.surface2}
          />
        }
      >
        {activeTab === "Private" ? renderPrivate() : renderCommunity()}
      </ScrollView>
    </Screen>
  );
}
