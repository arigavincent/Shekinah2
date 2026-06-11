import React, { useState } from "react";
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import YoutubePlayer from "react-native-youtube-iframe";

import { PHASE1_IMAGES } from "../content";
import { C } from "../constants/theme";
import { tr } from "../i18n/labels";
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
  const [playing, setPlaying] = useState(true);
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
