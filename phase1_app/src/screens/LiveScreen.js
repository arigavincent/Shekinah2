import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Linking,
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
      setChatMessages(nextMessages);
      lastChatTimestampRef.current = nextMessages[nextMessages.length - 1]?.createdAt || "";
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
              if (current.some(item => item.id === payload.message.id)) {
                return current;
              }
              return [...current, payload.message].slice(-120);
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
      setChatMessages(current => [...current, response.message].slice(-120));
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
            <View style={s.videoBox}>
              {liveVideoId ? (
                <YoutubePlayer
                  height={220}
                  width={playerWidth}
                  play={playing}
                  videoId={liveVideoId}
                />
              ) : (
                <View style={s.videoOverlay}>
                  <Text style={s.liveNow}>LIVE NOW</Text>
                </View>
              )}
            </View>

            <Text style={s.detailTitle}>{live.title}</Text>
            <Text style={s.goldSmall}>{live.viewers} watching</Text>

            {liveVideoId ? (
              <View style={s.bottomActions}>
                <Pressable style={s.actionBtn} onPress={() => setPlaying(current => !current)}>
                  <Ionicons
                    name={playing ? "pause-outline" : "play-outline"}
                    size={17}
                    color={C.white}
                  />
                  <Text style={s.actionText}>{tr(appLanguage, playing ? "Pause" : "Play")}</Text>
                </Pressable>

                <Pressable style={s.actionBtn} onPress={openLiveOnYouTube}>
                  <Ionicons name="logo-youtube" size={17} color={C.white} />
                  <Text style={s.actionText}>{tr(appLanguage, "Open YouTube")}</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={s.reactionStrip}>
              {["Amen", "Glory", "Hallelujah", "Praying", "Blessed"].map(x => <Text key={x} style={s.reaction}>{tr(appLanguage, x)}</Text>)}
            </View>

            <SectionHeader title="Live Chat" appLanguage={appLanguage} />
            <View style={s.plainCard}>
              <Text style={[s.rowTitle, { color: C.white }]}>{tr(appLanguage, "This chat belongs to the active livestream only.")}</Text>
              <Text style={[s.mutedText, { color: C.muted }]}>
                {tr(appLanguage, "Use Community Chat for general church conversation outside the current live service.")}
              </Text>
            </View>

            <View style={[s.formNote, { marginBottom: 12, borderColor: socketState === "connected" ? "rgba(67,182,111,0.32)" : socketState === "reconnecting" ? "rgba(216,166,52,0.35)" : C.line }]}>
              <Ionicons
                name={
                  socketState === "connected"
                    ? "radio-outline"
                    : socketState === "reconnecting"
                      ? "sync-outline"
                      : "cloud-offline-outline"
                }
                size={20}
                color={socketState === "connected" ? C.green : socketState === "reconnecting" ? C.gold : C.muted}
              />
              <Text style={s.formNoteText}>
                {socketState === "connected"
                  ? tr(appLanguage, "Live chat is connected in real time.")
                  : socketState === "reconnecting"
                    ? tr(appLanguage, "Reconnecting live chat...")
                    : tr(appLanguage, "Connecting live chat...")}
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
                placeholder={tr(appLanguage, "Share a live response...")}
                placeholderTextColor={C.muted}
                multiline
                selectionColor={C.gold}
                value={chatText}
                onChangeText={setChatText}
              />
              <Pressable style={[s.primaryBtn, sending && { opacity: 0.65 }]} onPress={submitLiveChat} disabled={sending}>
                <Text style={s.primaryText}>{sending ? tr(appLanguage, "Sending...") : tr(appLanguage, "Send Message")}</Text>
              </Pressable>
            </View>

            {chatLoading ? (
              <View style={s.plainCard}>
                <Text style={[s.mutedText, { color: C.muted }]}>{tr(appLanguage, "Loading live chat...")}</Text>
              </View>
            ) : chatMessages.length === 0 ? (
              <View style={s.plainCard}>
                <Text style={[s.rowTitle, { color: C.white }]}>{tr(appLanguage, "No live responses yet")}</Text>
                <Text style={[s.mutedText, { color: C.muted }]}>
                  {tr(appLanguage, "Live responses will appear here while the stream is active.")}
                </Text>
              </View>
            ) : (
              <ScrollView
                ref={chatScrollRef}
                style={{ maxHeight: 360 }}
                contentContainerStyle={{ paddingBottom: 8 }}
                onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
              >
                {chatMessages.map(item => (
                  <View key={item.id} style={s.plainCard}>
                    <View style={[s.rowTight, { justifyContent: "space-between" }]}>
                      <Text style={[s.rowTitle, { color: C.white, flex: 1 }]}>{item.displayName || tr(appLanguage, "Member")}</Text>
                      <Text style={[s.mutedText, { color: C.muted }]}>{new Date(item.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text>
                    </View>
                    <Text style={[s.detailBody, { marginTop: 10 }]}>{item.message}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
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
