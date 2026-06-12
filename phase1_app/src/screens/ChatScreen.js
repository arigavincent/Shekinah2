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
  listPrivateChatContacts,
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

const TABS = ["Community", "Inbox"];
const PRIVATE_PANES = ["Inbox", "Requests"];

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function initials(value) {
  const text = (value || "M").trim();
  return text.charAt(0).toUpperCase();
}

function RequestRow({ item, onAccept, onReject, onOpenProfile, appLanguage = "en", busy = false }) {
  const peer = item?.peer || {};
  const hasDevice = Boolean(peer?.hasDevice || peer?.deviceId);

  return (
    <View style={[s.plainCard, { paddingVertical: 14 }]}>
      <View style={[s.rowTight, { justifyContent: "space-between" }]}>
        <View style={[s.rowTight, { flex: 1 }]}>
          <View style={[s.smallCircle, { width: 42, height: 42, borderRadius: 21, backgroundColor: C.blue2 }]}>
            <Text style={{ color: C.textOnBrand, fontWeight: "900" }}>{initials(peer?.displayName)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Pressable onPress={onOpenProfile}>
              <Text style={[s.rowTitle, { color: C.white }]}>{peer?.displayName || tr(appLanguage, "Member")}</Text>
            </Pressable>
            <Text style={[s.mutedText, { color: hasDevice ? C.gold : C.muted, marginTop: 2 }]}>
              {hasDevice
                ? `${tr(appLanguage, "Encrypted Ready")} · ${peer?.fingerprint || ""}`
                : tr(appLanguage, "Encrypted chat will be ready once this member enables it on their device.")}
            </Text>
          </View>
        </View>
        <Text style={[s.mutedText, { color: C.muted }]}>{formatDate(item?.updatedAt || item?.createdAt)}</Text>
      </View>

      <View style={[s.bottomActions, { marginTop: 14, flexWrap: "wrap" }]}>
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
  const [contacts, setContacts] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [privateLoading, setPrivateLoading] = useState(true);
  const [privateRefreshing, setPrivateRefreshing] = useState(false);
  const [deviceFingerprint, setDeviceFingerprint] = useState("");
  const [requestBusyId, setRequestBusyId] = useState("");
  const [privatePane, setPrivatePane] = useState("Inbox");
  const [searchQuery, setSearchQuery] = useState("");

  const activeTab = tab === "Private" ? "Inbox" : (tab || "Community");
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
          setContacts([]);
          setIncomingRequests([]);
          setOutgoingRequests([]);
          setDeviceFingerprint("");
          return;
        }

        const identity = await ensurePrivateChatDevice(savedSession.user.id);
        setDeviceFingerprint(await publicKeyFingerprint(identity.identityPublicKey));

        const [threadsResponse, requestsResponse, contactsResponse] = await Promise.all([
          listPrivateChatThreads(),
          listPrivateChatRequests(),
          listPrivateChatContacts()
        ]);

        setPrivateThreads(Array.isArray(threadsResponse?.threads) ? threadsResponse.threads : []);
        setIncomingRequests(Array.isArray(requestsResponse?.incoming) ? requestsResponse.incoming : []);
        setOutgoingRequests(Array.isArray(requestsResponse?.outgoing) ? requestsResponse.outgoing : []);
        setContacts(Array.isArray(contactsResponse?.contacts) ? contactsResponse.contacts : []);
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
      setTab(detail.tab === "Private" ? "Inbox" : detail.tab);
    }
  }, [detail?.tab, setTab]);

  useEffect(() => {
    if (activeTab === "Inbox") {
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

  const pendingMemberIds = new Set([
    ...incomingRequests.map(item => item?.peer?.id).filter(Boolean),
    ...outgoingRequests.map(item => item?.peer?.id).filter(Boolean)
  ]);
  const threadMemberIds = new Set(privateThreads.map(item => item?.peer?.id).filter(Boolean));
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredThreads = privateThreads.filter(item => {
    if (!normalizedQuery) return true;
    const value = `${item?.peer?.displayName || ""} ${item?.peer?.email || ""}`.toLowerCase();
    return value.includes(normalizedQuery);
  });
  const filteredContacts = contacts
    .filter(item => !threadMemberIds.has(item.id))
    .filter(item => !pendingMemberIds.has(item.id))
    .filter(item => {
      if (!normalizedQuery) return false;
      const value = `${item?.displayName || ""} ${item?.email || ""}`.toLowerCase();
      return value.includes(normalizedQuery);
    });

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
            <View key={item.id} style={[s.plainCard, { paddingVertical: 14 }]}>
              <View style={[s.rowTight, { justifyContent: "space-between" }]}>
                <View style={[s.rowTight, { flex: 1 }]}>
                  <View style={[s.smallCircle, { width: 42, height: 42, borderRadius: 21, backgroundColor: C.blue2 }]}>
                    <Text style={{ color: C.textOnBrand, fontWeight: "900" }}>{initials(item?.displayName)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Pressable onPress={() => go("MemberProfile", { memberId: item.userId, displayName: item.displayName })}>
                      <Text style={[s.rowTitle, { color: C.white }]}>{item.displayName || tr(appLanguage, "Member")}</Text>
                    </Pressable>
                    <Text style={[s.mutedText, { color: C.muted, marginTop: 2 }]} numberOfLines={1}>
                      {item.message}
                    </Text>
                  </View>
                </View>
                <Text style={[s.mutedText, { color: C.muted }]}>{formatDate(item.createdAt)}</Text>
              </View>
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
          <Text style={[s.rowTitle, { color: C.white }]}>{tr(appLanguage, "Inbox")}</Text>
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
          <View style={[s.rowTight, { justifyContent: "space-between" }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.rowTitle, { color: C.white }]}>{tr(appLanguage, "Inbox")}</Text>
              <Text style={[s.mutedText, { color: C.muted, marginTop: 6 }]}>
                {tr(appLanguage, "Tap a member name in Community Chat to open their profile and send a private chat request.")}
              </Text>
            </View>
            {incomingRequests.length > 0 ? (
              <View style={{ backgroundColor: C.gold, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ color: C.black, fontWeight: "900", fontSize: 12 }}>{incomingRequests.length}</Text>
              </View>
            ) : null}
          </View>
          {deviceFingerprint ? (
            <Text style={[s.goldSmall, { marginTop: 10 }]}>{tr(appLanguage, "Your Fingerprint")} · {deviceFingerprint}</Text>
          ) : null}
        </View>

        {privateLoading ? (
          <View style={s.plainCard}>
            <Text style={[s.mutedText, { color: C.muted }]}>{tr(appLanguage, "Loading encrypted chat...")}</Text>
          </View>
        ) : (
          <>
            <View style={s.plainCard}>
              <TextInput
                style={[s.searchInput, { marginBottom: 0 }]}
                placeholder={tr(appLanguage, "Search members or conversations")}
                placeholderTextColor={C.muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                selectionColor={C.gold}
              />
            </View>

            <View style={s.tabsCompact}>
              {PRIVATE_PANES.map(item => {
                const active = privatePane === item;
                const count = item === "Requests" ? incomingRequests.length + outgoingRequests.length : filteredThreads.length;
                return (
                  <Pressable
                    key={item}
                    style={[s.compactChipBtn, active && s.activeChip]}
                    onPress={() => setPrivatePane(item)}
                  >
                    <Text style={[s.compactChipText, active && { color: C.black }]}>
                      {tr(appLanguage, item)} {count > 0 ? `(${count})` : ""}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {filteredContacts.length > 0 ? (
              <>
                <View style={s.plainCard}>
                  <Text style={[s.rowTitle, { color: C.white }]}>{tr(appLanguage, "People")}</Text>
                  <Text style={[s.mutedText, { color: C.muted }]}>
                    {tr(appLanguage, "Open a profile to send a chat request.")}
                  </Text>
                </View>

                {filteredContacts.map(item => (
                  <Pressable
                    key={item.id}
                    style={[s.plainCard, { paddingVertical: 14 }]}
                    onPress={() => go("MemberProfile", { memberId: item.id, displayName: item.displayName })}
                  >
                    <View style={[s.rowTight, { justifyContent: "space-between" }]}>
                      <View style={[s.rowTight, { flex: 1 }]}>
                        <View style={[s.smallCircle, { width: 42, height: 42, borderRadius: 21, backgroundColor: item?.hasDevice ? C.blue2 : C.surface2 }]}>
                          <Text style={{ color: item?.hasDevice ? C.textOnBrand : C.white, fontWeight: "900" }}>{initials(item?.displayName)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.rowTitle, { color: C.white }]}>{item?.displayName || tr(appLanguage, "Member")}</Text>
                          <Text style={[s.mutedText, { color: item?.hasDevice ? C.gold : C.muted, marginTop: 2 }]}>
                            {item?.hasDevice ? tr(appLanguage, "Open profile to request chat") : tr(appLanguage, "Not Enabled")}
                          </Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward-outline" size={18} color={C.muted} />
                    </View>
                  </Pressable>
                ))}
              </>
            ) : null}

            {privatePane === "Inbox" ? (
              <>
                {filteredThreads.length === 0 ? (
                  <View style={s.plainCard}>
                    <Text style={[s.rowTitle, { color: C.white }]}>{tr(appLanguage, "No conversations yet")}</Text>
                    <Text style={[s.mutedText, { color: C.muted }]}>
                      {normalizedQuery
                        ? tr(appLanguage, "No matching members or conversations.")
                        : tr(appLanguage, "Tap a member name in Community Chat to start with a request, then accepted chats will appear here.")}
                    </Text>
                  </View>
                ) : (
                  filteredThreads.map(item => (
                    <Pressable
                      key={item.id}
                      style={[s.plainCard, { paddingVertical: 14 }]}
                      onPress={() => go("PrivateChatThread", { thread: item })}
                    >
                      <View style={[s.rowTight, { justifyContent: "space-between" }]}>
                        <View style={[s.rowTight, { flex: 1 }]}>
                          <View style={[s.smallCircle, { width: 46, height: 46, borderRadius: 23, backgroundColor: C.blue2 }]}>
                            <Text style={{ color: C.textOnBrand, fontWeight: "900" }}>{initials(item?.peer?.displayName)}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.rowTitle, { color: C.white }]}>{item?.peer?.displayName || tr(appLanguage, "Member")}</Text>
                            <Text style={[s.mutedText, { color: C.muted, marginTop: 2 }]}>{tr(appLanguage, "Encrypted conversation")}</Text>
                          </View>
                        </View>
                        <Text style={[s.mutedText, { color: C.muted }]}>{formatDate(item?.lastMessageAt)}</Text>
                      </View>
                    </Pressable>
                  ))
                )}
              </>
            ) : (
              <>
                {incomingRequests.length > 0 ? (
                  <View style={s.plainCard}>
                    <Text style={[s.rowTitle, { color: C.white }]}>{tr(appLanguage, "Incoming Requests")}</Text>
                    <Text style={[s.mutedText, { color: C.muted }]}>{tr(appLanguage, "Accept a request to unlock a private encrypted thread with that member.")}</Text>
                  </View>
                ) : null}

                {incomingRequests.map(item => (
                  <RequestRow
                    key={item.id}
                    item={item}
                    onAccept={() => handleRequestAction(item.id, "accept")}
                    onReject={() => handleRequestAction(item.id, "reject")}
                    onOpenProfile={() => go("MemberProfile", { memberId: item?.peer?.id, displayName: item?.peer?.displayName })}
                    busy={requestBusyId === item.id}
                    appLanguage={appLanguage}
                  />
                ))}

                {outgoingRequests.length > 0 ? (
                  <View style={s.plainCard}>
                    <Text style={[s.rowTitle, { color: C.white }]}>{tr(appLanguage, "Outgoing Requests")}</Text>
                    <Text style={[s.mutedText, { color: C.muted }]}>{tr(appLanguage, "These members still need to accept your request before private chat opens.")}</Text>
                  </View>
                ) : null}

                {outgoingRequests.map(item => (
                  <RequestRow
                    key={item.id}
                    item={item}
                    onOpenProfile={() => go("MemberProfile", { memberId: item?.peer?.id, displayName: item?.peer?.displayName })}
                    appLanguage={appLanguage}
                  />
                ))}

                {incomingRequests.length === 0 && outgoingRequests.length === 0 ? (
                  <View style={s.plainCard}>
                    <Text style={[s.rowTitle, { color: C.white }]}>{tr(appLanguage, "No requests right now")}</Text>
                    <Text style={[s.mutedText, { color: C.muted }]}>
                      {tr(appLanguage, "Search for a member or tap one in Community Chat to send a private request.")}
                    </Text>
                  </View>
                ) : null}
              </>
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
            refreshing={activeTab === "Inbox" ? privateRefreshing : refreshing}
            onRefresh={() => (activeTab === "Inbox" ? loadPrivate(true) : loadCommunity(true))}
            tintColor={C.gold}
            colors={[C.gold]}
            progressBackgroundColor={C.surface2}
          />
        }
      >
        {activeTab === "Inbox" ? renderPrivate() : renderCommunity()}
      </ScrollView>
    </Screen>
  );
}
