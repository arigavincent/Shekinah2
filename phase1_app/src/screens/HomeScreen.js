import React, { useMemo } from "react";
import {
  Image,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useContent } from "../providers/ContentProvider";
import { PHASE1_IMAGES } from "../content";
import { C } from "../constants/theme";
import { s } from "../styles/appStyles";
import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { IconButton } from "../components/IconButton";
import { SectionHeader } from "../components/SectionHeader";
import { Horizontal } from "../components/Horizontal";
import {
  ClipCard,
  EventMiniCard
} from "../components/Cards";
import { useDownloadsMap } from "../hooks/useDownloadsMap";
import { usePlaybackProgressMap } from "../hooks/usePlaybackProgressMap";
import {
  formatPlaybackTime,
  hasContinueProgress,
  progressRatio
} from "../services/playbackProgressStore";
import {
  extractYouTubeId,
  isAudioUrl,
  isVideoUrl,
  resolveMediaUrl,
  sermonMediaUrl,
  sermonThumbnail
} from "../utils/mediaUrl";

const fill = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0
};

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hasValidMediaUrl(item) {
  const mediaUrl = cleanText(sermonMediaUrl(item)).toLowerCase();

  return Boolean(
    mediaUrl &&
      !["none", "null", "undefined"].includes(mediaUrl)
  );
}

function isPlayableVideoSermon(item) {
  if (item?.type !== "video") return false;
  if (!hasValidMediaUrl(item)) return false;

  const mediaUrl = sermonMediaUrl(item);

  return Boolean(isVideoUrl(mediaUrl) || extractYouTubeId(mediaUrl));
}

function isPlayableAudioSermon(item) {
  if (item?.type !== "audio") return false;
  if (!hasValidMediaUrl(item)) return false;

  return isAudioUrl(sermonMediaUrl(item));
}

function imageUrl(value, fallback) {
  return resolveMediaUrl(value || "") || fallback;
}

function devotionImage(devotion) {
  return imageUrl(
    devotion?.imageUrl || devotion?.image || devotion?.thumbnailUrl,
    PHASE1_IMAGES.devotion
  );
}

function contentImage(item, fallback) {
  return imageUrl(item?.imageUrl || item?.image || item?.thumbnailUrl || item?.thumbnail, fallback);
}

function playableClipFromContent(item) {
  const mediaUrl = sermonMediaUrl(item);

  return {
    ...item,
    type: "video",
    speaker: item?.speaker || "Shekinah Sons Global",
    category: item?.category || "Clips",
    date: item?.date || item?.duration || "YouTube Clip",
    thumbnail: item?.thumbnail || item?.image,
    image: item?.image || item?.thumbnail,
    description: item?.description || "Short clip from Shekinah Sons Global.",
    mediaUrl
  };
}

function HomeHero({ live, featuredVideo, go }) {
  const heroImage = featuredVideo
    ? sermonThumbnail(featuredVideo, PHASE1_IMAGES.sermon)
    : PHASE1_IMAGES.crowd;

  return (
    <ImageBackground
      source={{ uri: heroImage }}
      style={{
        minHeight: 250,
        borderRadius: 22,
        overflow: "hidden",
        justifyContent: "space-between",
        backgroundColor: C.surface,
        marginBottom: 18
      }}
      imageStyle={{ opacity: 0.88 }}
    >
      <View style={{ ...fill, backgroundColor: "rgba(0,0,0,0.48)" }} />

      <View style={{ padding: 16, flexDirection: "row", justifyContent: "space-between" }}>
        <View
          style={{
            backgroundColor: live?.isLive ? C.red : "rgba(0,0,0,0.65)",
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 7
          }}
        >
          <Text style={{ color: C.white, fontWeight: "900", fontSize: 12 }}>
            {live?.isLive ? "LIVE NOW" : "NEXT SERVICE"}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: "rgba(0,0,0,0.65)",
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 7
          }}
        >
          <Text style={{ color: C.gold, fontWeight: "900", fontSize: 12 }}>
            {live?.viewers || "Shekinah"}
          </Text>
        </View>
      </View>

      <View style={{ padding: 16 }}>
        <Text style={{ color: C.white, fontSize: 28, fontWeight: "900" }}>
          {live?.title || "Shekinah Sons Global"}
        </Text>

        <Text style={{ color: C.muted, fontSize: 14, fontWeight: "800", marginTop: 8 }}>
          {live?.isLive ? "Join the service now." : live?.nextService || "Stay connected to the word, worship, and prayer."}
        </Text>

        <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
          <Pressable
            style={{
              flex: 1,
              backgroundColor: C.gold,
              borderRadius: 999,
              paddingVertical: 12,
              alignItems: "center"
            }}
            onPress={() => go("Live")}
          >
            <Text style={{ color: C.black, fontWeight: "900" }}>
              {live?.isLive ? "Watch Live" : "Open Live"}
            </Text>
          </Pressable>

          <Pressable
            style={{
              flex: 1,
              backgroundColor: "rgba(255,255,255,0.12)",
              borderRadius: 999,
              paddingVertical: 12,
              alignItems: "center",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.16)"
            }}
            onPress={() => go("Sermons")}
          >
            <Text style={{ color: C.white, fontWeight: "900" }}>Sermons</Text>
          </Pressable>
        </View>
      </View>
    </ImageBackground>
  );
}

function QuickActions({ go }) {
  const actions = [
    { label: "Give", icon: "heart-outline", screen: "Giving" },
    { label: "Prayer", icon: "flame-outline", screen: "Prayer" },
    { label: "Branches", icon: "location-outline", screen: "Branches" },
    { label: "Bible", icon: "book-outline", screen: "Bible" }
  ];

  return (
    <View style={{ flexDirection: "row", gap: 10, marginBottom: 8 }}>
      {actions.map(action => (
        <Pressable
          key={action.label}
          onPress={() => go(action.screen)}
          style={{
            flex: 1,
            backgroundColor: C.surface,
            borderWidth: 1,
            borderColor: C.line,
            borderRadius: 16,
            paddingVertical: 14,
            alignItems: "center",
            gap: 6
          }}
        >
          <Ionicons name={action.icon} size={21} color={C.gold} />
          <Text style={{ color: C.white, fontSize: 12, fontWeight: "900" }}>
            {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function FeaturedMediaCard({ item, onPress, progressEntry, downloadEntry }) {
  if (!item) return null;

  const thumbnail = sermonThumbnail(item, PHASE1_IMAGES.sermon);
  const isAudio = item.type === "audio";
  const showContinue = hasContinueProgress(progressEntry);
  const progressPercent = Math.max(4, Math.round(progressRatio(progressEntry) * 100));
  const downloaded = Boolean(downloadEntry?.localUri);

  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 245,
        minHeight: 180,
        borderRadius: 20,
        overflow: "hidden",
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.line,
        marginRight: 12
      }}
    >
      <ImageBackground
        source={{ uri: thumbnail }}
        style={{ flex: 1, justifyContent: "space-between" }}
        imageStyle={{ opacity: 0.9 }}
      >
        <View style={{ ...fill, backgroundColor: "rgba(0,0,0,0.38)" }} />

        <View style={{ padding: 12, flexDirection: "row", justifyContent: "space-between" }}>
          <View
            style={{
              backgroundColor: C.gold,
              borderRadius: 999,
              paddingHorizontal: 9,
              paddingVertical: 5
            }}
          >
            <Text style={{ color: C.black, fontSize: 11, fontWeight: "900" }}>
              {isAudio ? "AUDIO" : extractYouTubeId(sermonMediaUrl(item)) ? "YOUTUBE" : "VIDEO"}
            </Text>
          </View>

          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: "rgba(0,0,0,0.68)",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Ionicons
              name={isAudio ? "musical-notes-outline" : "play-outline"}
              size={20}
              color={C.white}
            />
          </View>
        </View>

        <View style={{ padding: 12 }}>
          <Text style={{ color: C.white, fontSize: 17, fontWeight: "900" }} numberOfLines={2}>
            {item.title}
          </Text>

          <Text style={{ color: C.muted, fontSize: 12, fontWeight: "800", marginTop: 5 }} numberOfLines={1}>
            {item.speaker || item.category || "Sermon"} · {item.date || item.sermonDate || ""}
          </Text>

          {downloaded ? (
            <Text style={{ color: C.gold, fontSize: 12, fontWeight: "900", marginTop: 8 }}>
              Downloaded for offline use
            </Text>
          ) : null}

          {showContinue ? (
            <>
              <Text style={{ color: C.gold, fontSize: 12, fontWeight: "900", marginTop: 8 }}>
                Continue · {formatPlaybackTime(progressEntry.positionMs)} / {formatPlaybackTime(progressEntry.durationMs)}
              </Text>

              <View
                style={{
                  marginTop: 8,
                  height: 4,
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.15)",
                  overflow: "hidden"
                }}
              >
                <View
                  style={{
                    width: `${progressPercent}%`,
                    height: "100%",
                    borderRadius: 999,
                    backgroundColor: C.gold
                  }}
                />
              </View>
            </>
          ) : null}
        </View>
      </ImageBackground>
    </Pressable>
  );
}

function DevotionPreview({ devotion, go }) {
  if (!devotion) return null;

  return (
    <Pressable
      style={s.devotionHero}
      onPress={() => go("DevotionDetail", devotion)}
    >
      <View>
        <Image source={{ uri: devotionImage(devotion) }} style={s.devotionThumb} />

        <View style={s.badgeOnImage}>
          <Text style={s.badgeText}>Today</Text>
        </View>
      </View>

      <View style={s.devotionBody}>
        <Text style={s.cardTitle}>{devotion.title}</Text>

        <Text style={s.mutedText} numberOfLines={3}>
          {devotion.excerpt || devotion.body || "Read today's devotion."}
        </Text>

        <Text style={s.goldSmall}>{devotion.date || devotion.devotionDate || ""}</Text>
      </View>
    </Pressable>
  );
}

function UpdateRow({ item, go }) {
  if (!item) return null;

  return (
    <Pressable style={s.listRow} onPress={() => go("Updates")}>
      <Image source={{ uri: contentImage(item, PHASE1_IMAGES.event) }} style={s.rowImage} />

      <View style={s.rowBody}>
        <Text style={s.rowTitle}>{item.title}</Text>
        <Text style={s.mutedText} numberOfLines={2}>{item.excerpt || item.date}</Text>
        <Text style={s.goldSmall}>{item.date}</Text>
      </View>
    </Pressable>
  );
}

export function HomeScreen({ go, openDrawer, openSermon }) {
  const { data, loading, reload } = useContent();
  const progressMap = usePlaybackProgressMap();
  const downloads = useDownloadsMap();

  const sermons = Array.isArray(data.sermons) ? data.sermons : [];
  const devotions = Array.isArray(data.devotions) ? data.devotions : [];
  const events = Array.isArray(data.events) ? data.events : [];
  const updates = Array.isArray(data.updates) ? data.updates : [];
  const clips = Array.isArray(data.clips) ? data.clips : [];

  const videos = sermons.filter(isPlayableVideoSermon);
  const audio = sermons.filter(isPlayableAudioSermon);
  const playableClips = clips
    .map(playableClipFromContent)
    .filter(item => {
      const mediaUrl = sermonMediaUrl(item);
      return Boolean(extractYouTubeId(mediaUrl) || isVideoUrl(mediaUrl));
    });
  const featuredVideo = videos[0] || null;
  const featuredAudio = audio[0] || null;
  const todayDevotion = devotions[0] || null;
  const continuingSermons = useMemo(() => {
    return sermons
      .filter(item => hasContinueProgress(progressMap[item.id]))
      .sort((left, right) => {
        const leftUpdated = new Date(progressMap[left.id]?.updatedAt || 0).getTime();
        const rightUpdated = new Date(progressMap[right.id]?.updatedAt || 0).getTime();
        return rightUpdated - leftUpdated;
      })
      .slice(0, 6);
  }, [sermons, progressMap]);

  return (
    <Screen>
      <TopBar
        go={go}
        onMenu={openDrawer}
        right={<IconButton name="search-outline" onPress={() => go("Search")} />}
      />

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
        <HomeHero live={data.live} featuredVideo={featuredVideo} go={go} />

        <QuickActions go={go} />

        <DevotionPreview devotion={todayDevotion} go={go} />

        <ScriptureCard scripture={data.scripture} />

        {continuingSermons.length > 0 ? (
          <>
            <SectionHeader title="Continue Listening" onPress={() => go("Sermons")} />
            <Horizontal>
              {continuingSermons.map(item => (
                <FeaturedMediaCard
                  key={item.id}
                  item={item}
                  downloadEntry={downloads.bySermonId[item.id]}
                  progressEntry={progressMap[item.id]}
                  onPress={() => openSermon(item)}
                />
              ))}
            </Horizontal>
          </>
        ) : null}

        <SectionHeader title="Featured Sermons" onPress={() => go("Sermons")} />
        <Horizontal>
          {featuredVideo ? (
            <FeaturedMediaCard
              item={featuredVideo}
              downloadEntry={downloads.bySermonId[featuredVideo.id]}
              progressEntry={progressMap[featuredVideo.id]}
              onPress={() => openSermon(featuredVideo)}
            />
          ) : null}

          {featuredAudio ? (
            <FeaturedMediaCard
              item={featuredAudio}
              downloadEntry={downloads.bySermonId[featuredAudio.id]}
              progressEntry={progressMap[featuredAudio.id]}
              onPress={() => openSermon(featuredAudio)}
            />
          ) : null}

          {videos.slice(1, 4).map(item => (
            <FeaturedMediaCard
              key={item.id}
              item={item}
              downloadEntry={downloads.bySermonId[item.id]}
              progressEntry={progressMap[item.id]}
              onPress={() => openSermon(item)}
            />
          ))}
        </Horizontal>

        {playableClips.length > 0 ? (
          <>
            <SectionHeader title="Short Clips" />
            <Horizontal>
              {playableClips.slice(0, 6).map(item => (
                <ClipCard
                  key={item.id}
                  item={item}
                  onPress={() => openSermon(item)}
                />
              ))}
            </Horizontal>
          </>
        ) : null}

        {events.length > 0 ? (
          <>
            <SectionHeader title="Upcoming Events" onPress={() => go("Events")} />
            <Horizontal>
              {events.slice(0, 5).map(item => (
                <EventMiniCard
                  key={item.id}
                  item={{
                    ...item,
                    image: contentImage(item, PHASE1_IMAGES.event)
                  }}
                  onPress={() => go("EventDetail", item)}
                />
              ))}
            </Horizontal>
          </>
        ) : null}

        {updates.length > 0 ? (
          <>
            <SectionHeader title="Latest Updates" onPress={() => go("Updates")} />
            {updates.slice(0, 3).map(item => (
              <UpdateRow key={item.id} item={item} go={go} />
            ))}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function ScriptureCard({ scripture }) {
  const item = scripture || {};

  const share = () => {
    Share.share({ message: `${item.verse || ""} - ${item.reference || ""}` });
  };

  return (
    <View style={s.scriptureCard}>
      <View style={s.scriptureHead}>
        <Text style={s.goldSmall}>{item.title || "Scripture of the Day"}</Text>

        <Pressable onPress={share} style={s.smallCircle}>
          <Ionicons name="share-social-outline" size={18} color={C.white} />
        </Pressable>
      </View>

      <Text style={s.verseText}>{item.verse || "The word of God is life."}</Text>
      <Text style={s.mutedText}>{item.reference || ""}</Text>
    </View>
  );
}
