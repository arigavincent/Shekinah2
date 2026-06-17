import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
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
import { VideoView, useVideoPlayer } from "expo-video";
import YoutubePlayer from "react-native-youtube-iframe";
import { WebView } from "react-native-webview";

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

function CloudflareWhepPlayer({ source, height }) {
  const [fullscreen, setFullscreen] = useState(false);
  const whepUrl = JSON.stringify(source);

  const html = `
<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #000;
      overflow: hidden;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    #video {
      width: 100%;
      height: 100%;
      background: #000;
      object-fit: cover;
    }

    #status {
      position: absolute;
      left: 12px;
      right: 12px;
      bottom: 12px;
      padding: 10px 12px;
      border-radius: 999px;
      color: #fff;
      background: rgba(0, 0, 0, 0.56);
      font-size: 13px;
      text-align: center;
    }

    #playButton {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      border: 0;
      border-radius: 999px;
      padding: 12px 18px;
      color: #07111f;
      background: #fff;
      font-size: 14px;
      font-weight: 800;
      display: none;
    }

    #muteButton {
      position: absolute;
      right: 12px;
      bottom: 12px;
      border: 0;
      border-radius: 999px;
      padding: 10px 14px;
      color: #fff;
      background: rgba(0, 0, 0, 0.68);
      font-size: 13px;
      font-weight: 800;
    }
  </style>
</head>
<body>
  <video id="video" autoplay playsinline controls></video>\n  <button id="muteButton">Mute</button>
  <button id="playButton">Tap to play live</button>
  <div id="status">Connecting to live stream...</div>

  <script>
    const WHEP_URL = ${whepUrl};
    const video = document.getElementById("video");
    const status = document.getElementById("status");
    const playButton = document.getElementById("playButton");
    const muteButton = document.getElementById("muteButton");

    function post(type, payload) {
      try {
        window.ReactNativeWebView?.postMessage(JSON.stringify({ type, payload }));
      } catch (_) {}
    }

    function setStatus(message) {
      status.textContent = message;
      post("status", message);
    }

    function waitForIceGatheringComplete(peerConnection) {
      if (peerConnection.iceGatheringState === "complete") {
        return Promise.resolve();
      }

      return new Promise(resolve => {
        const timeout = setTimeout(resolve, 5000);

        peerConnection.addEventListener("icegatheringstatechange", () => {
          post("iceGatheringState", peerConnection.iceGatheringState);

          if (peerConnection.iceGatheringState === "complete") {
            clearTimeout(timeout);
            resolve();
          }
        });
      });
    }

    async function start() {
      if (!WHEP_URL) {
        throw new Error("Missing Cloudflare WHEP playback URL.");
      }

      const remoteStream = new MediaStream();
      video.srcObject = remoteStream;

      const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }]
      });

      peerConnection.addEventListener("connectionstatechange", () => {
        post("connectionState", peerConnection.connectionState);

        if (peerConnection.connectionState === "connected") {
          setStatus("Live stream connected");
        }

        if (peerConnection.connectionState === "failed") {
          setStatus("Live connection failed. Please refresh.");
        }
      });

      peerConnection.addEventListener("iceconnectionstatechange", () => {
        post("iceConnectionState", peerConnection.iceConnectionState);
      });

      peerConnection.addEventListener("track", event => {
        post("track", { kind: event.track.kind, readyState: event.track.readyState });
        remoteStream.addTrack(event.track);

        video.play().catch(error => {
          post("playBlocked", error.message);
          playButton.style.display = "block";
          setStatus("Tap to start live stream");
        });
      });

      playButton.addEventListener("click", () => {
        video.play()
          .then(() => {
            playButton.style.display = "none";
            setStatus("Live stream playing");
          })
          .catch(error => {
            post("manualPlayFailed", error.message);
            setStatus("Could not start playback");
          });
      });

      muteButton.addEventListener("click", () => {
        video.muted = !video.muted;
        muteButton.textContent = video.muted ? "Unmute" : "Mute";
        post("muted", video.muted);
      });

      peerConnection.addTransceiver("audio", { direction: "recvonly" });
      peerConnection.addTransceiver("video", { direction: "recvonly" });

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      await waitForIceGatheringComplete(peerConnection);

      const response = await fetch(WHEP_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp",
          "Accept": "application/sdp"
        },
        body: peerConnection.localDescription.sdp
      });

      const answerSdp = await response.text();

      post("whepResponse", {
        status: response.status,
        ok: response.ok,
        contentType: response.headers.get("content-type"),
        answerLength: answerSdp.length
      });

      if (!response.ok) {
        throw new Error(answerSdp || "Cloudflare WHEP playback failed with HTTP " + response.status);
      }

      await peerConnection.setRemoteDescription({
        type: "answer",
        sdp: answerSdp
      });

      setStatus("Receiving live stream...");
    }

    start().catch(error => {
      console.error(error);
      post("error", error.message);
      setStatus(error.message || "Live stream failed");
    });
  </script>
</body>
</html>
`;

  const renderPlayer = () => (
    <WebView
      source={{ html, baseUrl: "https://shekinah-live.local" }}
      style={{ width: "100%", height: "100%", backgroundColor: "#000" }}
      originWhitelist={["*"]}
      javaScriptEnabled
      domStorageEnabled
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      allowsFullscreenVideo
      mediaCapturePermissionGrantType="grant"
    />
  );

  return (
    <View style={{ width: "100%", height, backgroundColor: "#000" }}>
      {renderPlayer()}

      <Pressable
        onPress={() => setFullscreen(true)}
        style={{
          position: "absolute",
          right: 14,
          bottom: 14,
          width: 42,
          height: 42,
          borderRadius: 21,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.62)"
        }}
      >
        <Ionicons name="expand" size={22} color="#fff" />
      </Pressable>

      <Modal
        visible={fullscreen}
        animationType="fade"
        supportedOrientations={["portrait", "landscape", "landscape-left", "landscape-right"]}
        onRequestClose={() => setFullscreen(false)}
      >
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          {renderPlayer()}

          <Pressable
            onPress={() => setFullscreen(false)}
            style={{
              position: "absolute",
              top: 42,
              right: 18,
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(0,0,0,0.68)"
            }}
          >
            <Ionicons name="contract" size={24} color="#fff" />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

function CloudflareLivePlayer({ source, height, playing }) {
  const player = useVideoPlayer(source, player => {
    player.loop = false;
    player.muted = false;

    if (playing) {
      player.play();
    }
  });

  useEffect(() => {
    if (playing) {
      player.play();
    } else {
      player.pause();
    }
  }, [player, playing]);

  return (
    <VideoView
      style={{ width: "100%", height }}
      player={player}
      allowsFullscreen
      allowsPictureInPicture
      nativeControls
    />
  );
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
  const [chatExpanded, setChatExpanded] = useState(true);
  const [socketState, setSocketState] = useState("disconnected");
  const live = data.live;
  const liveVideoId = extractYouTubeId(live.youtubeId || live.youtubeUrl || "");
  const liveProvider = String(live.provider || "").trim().toLowerCase();
  const livePlaybackHlsUrl = String(live.playbackHlsUrl || "").trim();
  const liveWebRtcPlaybackUrl = String(live.webRtcPlaybackUrl || "").trim();
  const shouldUseWhepPlayer = liveProvider === "cloudflare_stream" && Boolean(liveWebRtcPlaybackUrl);
  const shouldUseCloudflarePlayer = !shouldUseWhepPlayer && liveProvider === "cloudflare_stream" && Boolean(livePlaybackHlsUrl);
  const playerWidth = Math.max(280, width - 32);
  const liveStageHeight = Math.max(460, Math.min(620, width * 1.42));
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

  function renderLiveChatPanel() {
    return (
      <View
        style={{
          marginTop: 16,
          borderRadius: 22,
          padding: 14,
          backgroundColor: "rgba(255,255,255,0.055)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.08)"
        }}
      >
        <Pressable
          onPress={() => setChatExpanded(current => !current)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: chatExpanded ? 12 : 0
          }}
        >
          <View>
            <Text style={[s.rowTitle, { color: C.text }]}>{tr(appLanguage, "Live Chat")}</Text>
            <Text style={[s.mutedText, { marginTop: 2 }]}>{liveStatusLabel}</Text>
          </View>
          <Ionicons
            name={chatExpanded ? "chevron-up-outline" : "chevron-down-outline"}
            size={22}
            color={C.gold}
          />
        </Pressable>

        {chatExpanded ? (
          <>
            <ScrollView
              ref={chatScrollRef}
              style={[s.liveChatList, { maxHeight: 230 }]}
              contentContainerStyle={s.liveChatListContent}
              onContentSizeChange={() => chatScrollRef.current?.scrollToEnd({ animated: true })}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {chatLoading ? (
                <View style={s.liveChatEmpty}>
                  <Text style={s.liveChatSubtle}>{tr(appLanguage, "Loading live chat...")}</Text>
                </View>
              ) : chatMessages.length === 0 ? (
                <View style={s.liveChatEmpty}>
                  <Text style={[s.liveChatTitle, { fontSize: 13 }]}>{tr(appLanguage, "No live responses yet")}</Text>
                  <Text style={s.liveChatSubtle}>
                    {tr(appLanguage, "Live responses will appear here while the stream is active.")}
                  </Text>
                </View>
              ) : (
                chatMessages.map(item => (
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

            <View style={[s.liveComposer, { marginTop: 12 }]}>
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
          </>
        ) : null}
      </View>
    );
  }

  return (
    <Screen>
      <TopBar title="Live Stream" go={go} onMenu={openDrawer} appLanguage={appLanguage} />
      <ScrollView
        contentContainerStyle={s.scrollPad}
        keyboardShouldPersistTaps="handled"
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
                {shouldUseWhepPlayer ? (
                  <CloudflareWhepPlayer
                    source={liveWebRtcPlaybackUrl}
                    height={liveStageHeight}
                  />
                ) : shouldUseCloudflarePlayer ? (
                  <CloudflareLivePlayer
                    source={livePlaybackHlsUrl}
                    height={liveStageHeight}
                    playing={playing}
                  />
                ) : liveVideoId ? (
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

                <View style={s.livePlayerShade} pointerEvents="none" />
                <View style={s.livePlayerOverlay} pointerEvents="box-none">
                  <View style={s.liveStageTopRow} pointerEvents="box-none">
                    <View style={s.liveStageTitleWrap}>
                      <View style={s.liveStageBadgeRow}>
                        <View style={s.liveStagePill}>
                          <View style={s.liveChatStatusDot} />
                          <Text style={s.liveStagePillText}>{tr(appLanguage, "Live")}</Text>
                        </View>
                        <View style={s.liveStagePill}>
                          <Ionicons name="eye-outline" size={14} color={C.textOnBrand} />
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
                          color={C.textOnBrand}
                        />
                      </Pressable>
                      {liveVideoId ? (
                        <Pressable style={s.liveStageActionBtn} onPress={openLiveOnYouTube}>
                          <Ionicons name="logo-youtube" size={18} color={C.textOnBrand} />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>

                </View>
              </View>

              {renderLiveChatPanel()}
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
