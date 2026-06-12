import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";

import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { Tabs } from "../components/Tabs";
import { C } from "../constants/theme";
import { listCommunityMessages, sendCommunityMessage } from "../api/communityApi";
import {
  createPrivateChatThread,
  listPrivateChatContacts,
  listPrivateChatThreads
} from "../api/privateChatApi";
import { loadSavedSession } from "../features/profile/authSession";
import { tr } from "../i18n/labels";
import {
  ensurePrivateChatDevice,
  publicKeyFingerprint
} from "../services/privateChatCrypto";
import { s } from "../styles/appStyles";

const TABS = ["Community", "Live", "Private"];

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function ChatScreen({ go, openDrawer, tab, setTab, appLanguage = "en" }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [session, setSession] = useState({ token: null, user: null });
  const [privateThreads, setPrivateThreads] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [privateLoading, setPrivateLoading] = useState(true);
  const [privateRefreshing, setPrivateRefreshing] = useState(false);
  const [deviceFingerprint, setDeviceFingerprint] = useState("");
  const [openingContactId, setOpeningContactId] = useState("");

  const activeTab = tab || "Community";
  const channel = useMemo(() => (activeTab === "Live" ? "live" : "global"), [activeTab]);
  const signedIn = Boolean(session?.token && session?.user);

  const loadCommunity = useCallback(
    async showSpinner => {
      if (showSpinner) setRefreshing(true);
      else setLoading(true);

      try {
        const response = await listCommunityMessages(channel);
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
    [appLanguage, channel]
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
          setDeviceFingerprint("");
          return;
        }

        const identity = await ensurePrivateChatDevice(savedSession.user.id);
        setDeviceFingerprint(await publicKeyFingerprint(identity.identityPublicKey));

        const [threadsResponse, contactsResponse] = await Promise.all([
          listPrivateChatThreads(),
          listPrivateChatContacts()
        ]);

        setPrivateThreads(Array.isArray(threadsResponse?.threads) ? threadsResponse.threads : []);
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
        channel,
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

  async function openPrivateThread(contact) {
    if (!signedIn) {
      Alert.alert(tr(appLanguage, "Sign In Required"), tr(appLanguage, "Sign in to start private encrypted chats."), [
        { text: tr(appLanguage, "Cancel"), style: "cancel" },
        { text: tr(appLanguage, "Open Profile"), onPress: () => go("Profile") }
      ]);
      return;
    }

    if (!contact?.hasDevice) {
      Alert.alert(tr(appLanguage, "Private Chat"), tr(appLanguage, "This contact has not enabled encrypted chat yet."));
      return;
    }

    const existingThread = privateThreads.find(item => item?.peer?.id === contact.id);
    if (existingThread) {
      go("PrivateChatThread", { thread: existingThread });
      return;
    }

    setOpeningContactId(contact.id);

    try {
      const response = await createPrivateChatThread(contact.id);
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
        error instanceof Error ? error.message : tr(appLanguage, "Unable to open encrypted thread.")
      );
    } finally {
      setOpeningContactId("");
    }
  }

  function renderCommunity() {
    return (
      <>
        <View style={s.plainCard}>
          <Text style={[s.rowTitle, { color: C.white }]}>
            {activeTab === "Live" ? tr(appLanguage, "Live Service Chat") : tr(appLanguage, "Community Chat")}
          </Text>
          <Text style={[s.mutedText, { color: C.muted }]}>
            {tr(appLanguage, "Short encouragement, prayer points, and reactions from members.")}
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
            placeholder={
              activeTab === "Live"
                ? tr(appLanguage, "Share a live response...")
                : tr(appLanguage, "Write a short message...")
            }
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
                <Text style={[s.rowTitle, { color: C.white, flex: 1 }]}>{item.displayName || "Member"}</Text>
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
            {tr(appLanguage, "Sign in to start private encrypted chats.")}
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
            {tr(appLanguage, "Messages are encrypted on this device before upload. The server stores ciphertext only.")}
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
              <Text style={[s.rowTitle, { color: C.white }]}>{tr(appLanguage, "Existing Threads")}</Text>
              <Text style={[s.mutedText, { color: C.muted }]}>
                {tr(appLanguage, "Open an encrypted thread or start a new one below.")}
              </Text>
              {privateThreads.length === 0 ? (
                <Text style={[s.mutedText, { color: C.muted, marginTop: 12 }]}>
                  {tr(appLanguage, "No private threads yet")}
                </Text>
              ) : (
                privateThreads.map(item => (
                  <Pressable
                    key={item.id}
                    style={[s.listRow, { borderBottomWidth: 0 }]}
                    onPress={() => go("PrivateChatThread", { thread: item })}
                  >
                    <View style={[s.smallCircle, { backgroundColor: C.blue2 }]}>
                      <Text style={{ color: C.white, fontWeight: "900" }}>
                        {(item?.peer?.displayName || item?.peer?.email || "M").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={s.rowBody}>
                      <Text style={[s.rowTitle, { color: C.white }]}>{item?.peer?.displayName || item?.peer?.email}</Text>
                      <Text style={[s.mutedText, { color: C.muted }]}>
                        {tr(appLanguage, "Encrypted Ready")} · {item?.peer?.fingerprint || ""}
                      </Text>
                    </View>
                    <Text style={[s.goldSmall, { marginTop: 0 }]}>{formatDate(item?.lastMessageAt)}</Text>
                  </Pressable>
                ))
              )}
            </View>

            <View style={s.plainCard}>
              <Text style={[s.rowTitle, { color: C.white }]}>{tr(appLanguage, "Available Members")}</Text>
              <Text style={[s.mutedText, { color: C.muted }]}>
                {tr(appLanguage, "Tap a member to start a private encrypted thread.")}
              </Text>
              {contacts.length === 0 ? (
                <Text style={[s.mutedText, { color: C.muted, marginTop: 12 }]}>
                  {tr(appLanguage, "No members found")}
                </Text>
              ) : (
                contacts.map(contact => {
                  const ready = Boolean(contact?.hasDevice && contact?.device?.identityPublicKey);
                  return (
                    <Pressable
                      key={contact.id}
                      style={[s.listRow, { borderBottomWidth: 0, opacity: openingContactId === contact.id ? 0.7 : 1 }]}
                      onPress={() => openPrivateThread(contact)}
                      disabled={openingContactId === contact.id}
                    >
                      <View style={[s.smallCircle, { backgroundColor: ready ? C.blue2 : C.surface2 }]}>
                        <Text style={{ color: C.white, fontWeight: "900" }}>
                          {(contact?.displayName || contact?.email || "M").charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={s.rowBody}>
                        <Text style={[s.rowTitle, { color: C.white }]}>{contact?.displayName || contact?.email}</Text>
                        <Text style={[s.mutedText, { color: ready ? C.gold : C.muted }]}>
                          {ready
                            ? `${tr(appLanguage, "Encrypted Ready")} · ${contact?.device?.fingerprint || ""}`
                            : tr(appLanguage, "Not Enabled")}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>
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
