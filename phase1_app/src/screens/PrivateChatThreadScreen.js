import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { C } from "../constants/theme";
import { loadSavedSession } from "../features/profile/authSession";
import { tr } from "../i18n/labels";
import {
  listPrivateChatMessages,
  sendPrivateChatMessage
} from "../api/privateChatApi";
import {
  decryptPrivateChatMessage,
  encryptPrivateChatMessage,
  ensurePrivateChatDevice,
  publicKeyFingerprint
} from "../services/privateChatCrypto";
import { s } from "../styles/appStyles";

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function messageBody(item) {
  return item?.decrypted?.text || item?.fallbackText || "";
}

export function PrivateChatThreadScreen({ go, detail, appLanguage = "en" }) {
  const thread = detail?.thread || null;
  const peer = thread?.peer || detail?.contact || null;
  const [session, setSession] = useState({ token: null, user: null });
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [peerFingerprint, setPeerFingerprint] = useState(peer?.fingerprint || "");

  const peerName = peer?.displayName || peer?.email || tr(appLanguage, "Private Chat");

  useEffect(() => {
    let active = true;

    (async () => {
      if (peer?.fingerprint) {
        setPeerFingerprint(peer.fingerprint);
        return;
      }

      const calculated = await publicKeyFingerprint(peer?.publicKey);
      if (active) {
        setPeerFingerprint(calculated);
      }
    })();

    return () => {
      active = false;
    };
  }, [peer]);

  const hydrateMessages = useCallback(
    async rawMessages => {
      const currentUserId = session?.user?.id;
      if (!currentUserId) {
        setMessages([]);
        return;
      }

      const decrypted = await Promise.all(
        rawMessages.map(async item => {
          try {
            const payload = await decryptPrivateChatMessage({
              threadId: thread.id,
              currentUserId,
              peerSigningKey: peer?.signingKey,
              message: item
            });

            return {
              ...item,
              decrypted: payload,
              fallbackText: ""
            };
          } catch (error) {
            return {
              ...item,
              decrypted: null,
              fallbackText:
                error instanceof Error
                  ? error.message
                  : "Encrypted message could not be opened on this device."
            };
          }
        })
      );

      setMessages(decrypted);
    },
    [peer?.signingKey, session?.user?.id, thread?.id]
  );

  const load = useCallback(
    async showRefresh => {
      if (!thread?.id) return;

      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        await ensurePrivateChatDevice();
        const response = await listPrivateChatMessages(thread.id);
        await hydrateMessages(Array.isArray(response?.messages) ? response.messages : []);
      } catch (error) {
        if (!showRefresh) {
          Alert.alert(
            tr(appLanguage, "Private Chat"),
            error instanceof Error ? error.message : tr(appLanguage, "Unable to load encrypted messages.")
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [appLanguage, hydrateMessages, thread?.id]
  );

  useEffect(() => {
    let active = true;

    (async () => {
      const nextSession = await loadSavedSession();
      if (!active) return;
      setSession(nextSession);
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!session?.user?.id || !thread?.id) return undefined;

    load(false);
    const timer = setInterval(() => {
      load(true);
    }, 5000);

    return () => clearInterval(timer);
  }, [load, session?.user?.id, thread?.id]);

  async function submit() {
    const messageText = text.trim();
    if (messageText.length < 1) {
      Alert.alert(tr(appLanguage, "Private Chat"), tr(appLanguage, "Enter a message before sending."));
      return;
    }

    if (!peer?.publicKey) {
      Alert.alert(tr(appLanguage, "Private Chat"), tr(appLanguage, "This contact has not enabled encrypted chat yet."));
      return;
    }

    setSending(true);

    try {
      await ensurePrivateChatDevice();
      const encryptedPayload = await encryptPrivateChatMessage({
        threadId: thread.id,
        text: messageText,
        recipientPublicKey: peer.publicKey,
        recipientDeviceId: peer.deviceId
      });

      await sendPrivateChatMessage(thread.id, encryptedPayload);
      await load(true);
      setText("");
    } catch (error) {
      Alert.alert(
        tr(appLanguage, "Private Chat"),
        error instanceof Error ? error.message : tr(appLanguage, "Unable to send encrypted message.")
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen>
      <TopBar
        title={peerName}
        go={go}
        back="Chat"
        onBack={() => go("Chat", null, { replace: true })}
        appLanguage={appLanguage}
      />

      <ScrollView
        contentContainerStyle={[s.scrollPad, { paddingTop: 12 }]}
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
          <Text style={[s.rowTitle, { color: C.white }]}>{tr(appLanguage, "Encrypted Thread")}</Text>
          <Text style={[s.mutedText, { color: C.muted }]}>
            {tr(appLanguage, "Messages are encrypted on this device before upload. The server stores ciphertext only.")}
          </Text>
          {peerFingerprint ? (
            <Text style={[s.goldSmall, { marginTop: 10 }]}>
              {tr(appLanguage, "Peer Fingerprint")} · {peerFingerprint}
            </Text>
          ) : null}
        </View>

        {loading ? (
          <View style={s.plainCard}>
            <Text style={[s.mutedText, { color: C.muted }]}>{tr(appLanguage, "Loading encrypted messages...")}</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={s.plainCard}>
            <Text style={[s.rowTitle, { color: C.white }]}>{tr(appLanguage, "No encrypted messages yet")}</Text>
            <Text style={[s.mutedText, { color: C.muted }]}>
              {tr(appLanguage, "Send the first private message to start this thread.")}
            </Text>
          </View>
        ) : (
          messages.map(item => {
            const mine = item.senderUserId === session?.user?.id;
            return (
              <View
                key={item.id}
                style={[
                  styles.messageWrap,
                  mine ? styles.messageWrapMine : styles.messageWrapPeer
                ]}
              >
                <View
                  style={[
                    styles.messageBubble,
                    mine ? styles.messageBubbleMine : styles.messageBubblePeer
                  ]}
                >
                  <Text style={[styles.messageText, mine ? styles.messageTextMine : styles.messageTextPeer]}>
                    {messageBody(item)}
                  </Text>
                  <Text style={[styles.messageMeta, mine ? styles.messageMetaMine : styles.messageMetaPeer]}>
                    {formatTime(item.createdAt)}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder={tr(appLanguage, "Write a private message...")}
          placeholderTextColor={C.muted}
          multiline
          value={text}
          onChangeText={setText}
          selectionColor={C.gold}
        />

        <Pressable style={[s.primaryBtn, styles.sendButton, sending && { opacity: 0.65 }]} onPress={submit} disabled={sending}>
          <Text style={s.primaryText}>{sending ? tr(appLanguage, "Sending...") : tr(appLanguage, "Send Encrypted")}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  messageWrap: {
    width: "100%",
    marginBottom: 12
  },
  messageWrapMine: {
    alignItems: "flex-end"
  },
  messageWrapPeer: {
    alignItems: "flex-start"
  },
  messageBubble: {
    maxWidth: "84%",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  messageBubbleMine: {
    backgroundColor: C.gold
  },
  messageBubblePeer: {
    backgroundColor: C.surface
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21
  },
  messageTextMine: {
    color: C.black
  },
  messageTextPeer: {
    color: C.white
  },
  messageMeta: {
    fontSize: 11,
    marginTop: 8,
    fontWeight: "700"
  },
  messageMetaMine: {
    color: "#4C3B11",
    textAlign: "right"
  },
  messageMetaPeer: {
    color: C.muted
  },
  composer: {
    borderTopWidth: 1,
    borderTopColor: C.line,
    backgroundColor: C.black,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 90
  },
  input: {
    minHeight: 92,
    maxHeight: 160,
    borderRadius: 12,
    backgroundColor: C.surface2,
    color: C.white,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: "top"
  },
  sendButton: {
    marginTop: 12,
    marginBottom: 0
  }
});
