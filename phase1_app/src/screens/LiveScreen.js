import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import YoutubePlayer from "react-native-youtube-iframe";

import { PHASE1_IMAGES } from "../content";
import { C } from "../constants/theme";
import { tr } from "../i18n/labels";
import { liveChatSocketUrl, listCommunityMessages, sendCommunityMessage } from "../api/communityApi";
import { loadSavedSession } from "../features/profile/authSession";
import { useContent } from "../providers/ContentProvider";
import { s } from "../styles/appStyles";
import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { EmptyState, VideoCard } from "../components/Cards";
import { SectionHeader } from "../components/SectionHeader";
import {
  extractYouTubeId,
  isVideoUrl,
  sermonMediaUrl,
  sermonThumbnail
} from "../utils/mediaUrl";

function youtubeWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function playablePastService(item) {
  const mediaUrl = sermonMediaUrl(item);
  return item?.type === "video" && Boolean(extractYouTubeId(mediaUrl) || isVideoUrl(mediaUrl));
}

function mergeUniqueMessages(existing, incoming) {
  const map = new Map();

  for (const item of existing || []) {
    if (item?.id) {
      map.set(item.id, item);
    }
  }

  for (const item of incoming || []) {
    if (item?.id) {
      map.set(item.id, item);
    }
  }

  return Array.from(map.values())
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-120);
}

function messageInitial(name) {
  const trimmed = String(name || "").trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "M";
}

function liveTimeLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function LiveScreen({ go, openDrawer, openSermon, appLanguage = "en" }) {
  const { data, loading, reload } = useContent();
  const { width } = useWindowDimensions();
  const chatScrollRef = useRef(null);
  const liveSocketRef = useRef(null);
  const lastChatTimestampRef = useRef("");
  const reconnectTimerRef = useRef(null);
  const liveStreamClosedRef = useRef(false);
  const [playing, setPlaying] = useState(true);
  const [session, setSession] = useState({ token: null, user: null });
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(true);
  const [chatText, setChatText] = useState("");
  const [sending, setSending] = useState(false);
  const [socketState, setSocketState] = useState("disconnected");
  const live = data.live;
  const liveVideoId = extractYouTubeId(live.youtubeId || live.youtubeUrl || "");
  const playerWidth = Math.max(280, width - 32);
  const liveStageHeight = Math.max(460, Math.min(620, width * 1.42));
  const visibleLiveMessages = chatMessages.slice(-8);
  const pastServices = data.sermons
    .filter(playablePastService)
    .map(item => ({
      ...item,
      thumbnail: sermonThumbnail(item, PHASE1_IMAGES.sermon)
    }));

  function openLiveOnYouTube() {
    if (!liveVideoId) return;
    Linking.openURL(youtubeWatchUrl(liveVideoId));
  }

  useEffect(() => {
    let active = true;

    (async () => {
      const savedSession = await loadSavedSession();
      if (active) {
        setSession(savedSession);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  async function loadLiveChat(showRefresh = false) {
    if (!live?.isLive) {
      setChatMessages([]);
      lastChatTimestampRef.current = "";
      setChatLoading(false);
      return;
    }

    if (!showRefresh) setChatLoading(true);

    try {
      const response = await listCommunityMessages("live", {
        order: "asc"
      });

      if (response?.active === false) {
        setChatMessages([]);
        return;
      }

      const nextMessages = Array.isArray(response?.messages) ? response.messages : [];
      const dedupedMessages = mergeUniqueMessages([], nextMessages);
      setChatMessages(dedupedMessages);
      lastChatTimestampRef.current = dedupedMessages[dedupedMessages.length - 1]?.createdAt || "";
    } catch (error) {
      if (!showRefresh) {
        Alert.alert(
          tr(appLanguage, "Live Chat"),
          error instanceof Error ? error.message : tr(appLanguage, "Unable to load live chat.")
        );
      }
    } finally {
      setChatLoading(false);
    }
  }

  useEffect(() => {
    liveStreamClosedRef.current = false;

    function closeStream() {
      liveStreamClosedRef.current = true;
      setSocketState("disconnected");
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (liveSocketRef.current) {
        liveSocketRef.current.onopen = null;
        liveSocketRef.current.onmessage = null;
        liveSocketRef.current.onerror = null;
        liveSocketRef.current.onclose = null;
        liveSocketRef.current.close();
        liveSocketRef.current = null;
      }
    }

    function connectStream() {
      if (!live?.isLive || liveStreamClosedRef.current) {
        return;
      }

      setSocketState(liveSocketRef.current ? "reconnecting" : "connecting");
      const socket = new WebSocket(liveChatSocketUrl());
      liveSocketRef.current = socket;

      socket.onopen = () => {
        setSocketState("connected");
        loadLiveChat(true);
      };

      socket.onmessage = event => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type === "message" && payload?.message?.id) {
            setChatMessages(current => {
              return mergeUniqueMessages(current, [payload.message]);
            });
            lastChatTimestampRef.current = payload.message.createdAt || lastChatTimestampRef.current;
            return;
          }

          if (payload?.type === "inactive") {
            setChatMessages([]);
            closeStream();
            reload();
          }
        } catch {
          // Ignore malformed realtime payloads and keep the stream alive.
        }
      };

      socket.onclose = () => {
        liveSocketRef.current = null;
        if (!liveStreamClosedRef.current && live?.isLive) {
          setSocketState("reconnecting");
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            connectStream();
          }, 2000);
        }
      };

      socket.onerror = () => {
        if (socket.readyState !== WebSocket.CLOSED && socket.readyState !== WebSocket.CLOSING) {
          socket.close();
        }
      };
    }

    if (!live?.isLive) {
      setChatMessages([]);
      lastChatTimestampRef.current = "";
      setChatLoading(false);
      setSocketState("disconnected");
      closeStream();
      return () => {
        closeStream();
      };
    }

    loadLiveChat(false);
    setSocketState("connecting");
    connectStream();

    const liveStateTimer = setInterval(() => {
      reload();
    }, 20000);

    return () => {
      clearInterval(liveStateTimer);
      closeStream();
    };
  }, [live?.isLive, reload]);

  async function submitLiveChat() {
    const message = chatText.trim();
    if (message.length < 2) {
      Alert.alert(tr(appLanguage, "Live Chat"), tr(appLanguage, "Enter at least a short response before sending."));
      return;
    }

    setSending(true);

    try {
      const response = await sendCommunityMessage({
        channel: "live",
        message
      });
      setChatMessages(current => mergeUniqueMessages(current, [response.message]));
      lastChatTimestampRef.current = response?.message?.createdAt || lastChatTimestampRef.current;
      setChatText("");
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : tr(appLanguage, "Unable to send your live response right now.");
      if (/sign in/i.test(messageText) || /authorization/i.test(messageText)) {
        Alert.alert(tr(appLanguage, "Sign In Required"), tr(appLanguage, "Sign in first to join the live chat."), [
          { text: tr(appLanguage, "Cancel"), style: "cancel" },
          { text: tr(appLanguage, "Open Profile"), onPress: () => go("Profile") }
        ]);
        return;
      }
      Alert.alert(tr(appLanguage, "Live Chat"), messageText);
    } finally {
      setSending(false);
    }
  }

  const liveStatusColor =
    socketState === "connected" ? C.green : socketState === "reconnecting" ? C.gold : C.muted;
  const liveStatusLabel =
    socketState === "connected"
      ? tr(appLanguage, "Live chat is connected in real time.")
      : socketState === "reconnecting"
        ? tr(appLanguage, "Reconnecting live chat...")
        : tr(appLanguage, "Connecting live chat...");

  return (
    <Screen>
      <TopBar title="Live Stream" go={go} onMenu={openDrawer} appLanguage={appLanguage} />
      <ScrollView
        contentContainerStyle={s.scrollPad}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={reload}
            tintColor={C.gold}
            colors={[C.gold]}
            progressBackgroundColor={C.surface2}
          />
        }
      >
        {live.isLive ? (
          <>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              keyboardVerticalOffset={Platform.OS === "ios" ? 84 : 24}
            >
              <View style={[s.liveStage, { height: liveStageHeight }]}>
                {liveVideoId ? (
                  <YoutubePlayer
                    height={liveStageHeight}
                    width={playerWidth}
                    play={playing}
                    videoId={liveVideoId}
                  />
                ) : (
                  <View style={[s.videoOverlay, { height: liveStageHeight }]}>
                    <Text style={s.liveNow}>LIVE NOW</Text>
                  </View>
                )}

                <View style={s.livePlayerShade} />
                <View style={s.livePlayerOverlay}>
                  <View style={s.liveStageTopRow}>
                    <View style={s.liveStageTitleWrap}>
                      <View style={s.liveStageBadgeRow}>
                        <View style={s.liveStagePill}>
                          <View style={s.liveChatStatusDot} />
                          <Text style={s.liveStagePillText}>{tr(appLanguage, "Live")}</Text>
                        </View>
                        <View style={s.liveStagePill}>
                          <Ionicons name="eye-outline" size={14} color={C.white} />
                          <Text style={s.liveStagePillText}>{live.viewers} {tr(appLanguage, "watching")}</Text>
                        </View>
                      </View>
                      <Text style={s.liveStageTitle}>{live.title}</Text>
                      <Text style={s.liveStageMeta}>{liveStatusLabel}</Text>
                    </View>

                    <View style={s.liveStageActions}>
                      <Pressable style={s.liveStageActionBtn} onPress={() => setPlaying(current => !current)}>
                        <Ionicons
                          name={playing ? "pause-outline" : "play-outline"}
                          size={18}
                          color={C.white}
                        />
                      </Pressable>
                      {liveVideoId ? (
                        <Pressable style={s.liveStageActionBtn} onPress={openLiveOnYouTube}>
                          <Ionicons name="logo-youtube" size={18} color={C.white} />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>

                  <View style={s.liveOverlayPanel}>
                    <ScrollView
                      ref={chatScrollRef}
                      style={s.liveChatList}
                      contentContainerStyle={s.liveChatListContent}
                      onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
                      keyboardShouldPersistTaps="handled"
                    >
                      {chatLoading ? (
                        <View style={s.liveChatEmpty}>
                          <Text style={[s.liveChatSubtle, { color: C.white }]}>{tr(appLanguage, "Loading live chat...")}</Text>
                        </View>
                      ) : visibleLiveMessages.length === 0 ? (
                        <View style={s.liveChatEmpty}>
                          <Text style={[s.liveChatTitle, { fontSize: 13 }]}>{tr(appLanguage, "No live responses yet")}</Text>
                          <Text style={[s.liveChatSubtle, { color: "rgba(255,255,255,0.78)" }]}>
                            {tr(appLanguage, "Live responses will appear here while the stream is active.")}
                          </Text>
                        </View>
                      ) : (
                        visibleLiveMessages.map(item => (
                          <View key={item.id} style={s.liveMessageRow}>
                            <View style={s.liveAvatar}>
                              <Text style={s.liveAvatarText}>{messageInitial(item.displayName || tr(appLanguage, "Member"))}</Text>
                            </View>
                            <View style={s.liveMessageBody}>
                              <View style={s.liveMessageMeta}>
                                <Text style={s.liveMessageName}>{item.displayName || tr(appLanguage, "Member")}</Text>
                                <Text style={s.liveMessageTime}>{liveTimeLabel(item.createdAt)}</Text>
                              </View>
                              <Text style={s.liveMessageText}>{item.message}</Text>
                            </View>
                          </View>
                        ))
                      )}
                    </ScrollView>

                    <View style={s.liveComposer}>
                      <TextInput
                        style={s.liveComposerInput}
                        placeholder={tr(appLanguage, "Share a live response...")}
                        placeholderTextColor="rgba(255,255,255,0.6)"
                        multiline
                        textAlignVertical="center"
                        selectionColor={C.gold}
                        returnKeyType="send"
                        value={chatText}
                        onChangeText={setChatText}
                        onSubmitEditing={() => {
                          if (!sending) {
                            submitLiveChat();
                          }
                        }}
                      />
                      <Pressable
                        style={[s.liveSendBtn, sending && { opacity: 0.65 }]}
                        onPress={submitLiveChat}
                        disabled={sending}
                      >
                        <Ionicons
                          name={sending ? "time-outline" : "send"}
                          size={18}
                          color={C.black}
                        />
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            </KeyboardAvoidingView>
          </>
        ) : (
          <EmptyState title={tr(appLanguage, "No live service right now")} text={`${tr(appLanguage, "Next service:")} ${live.nextService}`} />
        )}
        <SectionHeader title="Past Services" appLanguage={appLanguage} />
        {pastServices.length === 0 ? (
          <View style={s.plainCard}>
            <Text style={s.rowTitle}>{tr(appLanguage, "No past services found")}</Text>
            <Text style={s.mutedText}>
              {tr(appLanguage, "Past services will appear here.")}
            </Text>
          </View>
        ) : (
          pastServices.map(item => (
            <VideoCard
              key={item.id}
              item={item}
              onPress={() => openSermon(item)}
              wide
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
