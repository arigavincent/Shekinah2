import React, { useMemo, useState } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet } from "react-native";
import { Ionicons } from "../components/Icon";

import { useContent } from "../providers/ContentProvider";
import { PHASE1_IMAGES } from "../content";
import { C, makeThemedStyles } from "../constants/theme";
import { s } from "../styles/appStyles";
import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { IconButton } from "../components/IconButton";
import { SectionHeader } from "../components/SectionHeader";
import { LivePreview } from "../components/LivePreview";
import { AudioArt } from "../components/AudioArt";
import { useDownloadsMap } from "../hooks/useDownloadsMap";
import { tr } from "../i18n/labels";
import { usePlaybackProgressMap } from "../hooks/usePlaybackProgressMap";
import {
  formatPlaybackTime,
  hasContinueProgress,
  progressRatio
} from "../services/playbackProgressStore";
import {
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

  return isVideoUrl(mediaUrl);
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
    date: item?.date || item?.duration || "Recap",
    thumbnail: item?.thumbnail || item?.image,
    image: item?.image || item?.thumbnail,
    description: item?.description || "Short clip from Shekinah Sons Global.",
    mediaUrl
  };
}

function cleanViewerCount(value) {
  const raw = cleanText(value);
  if (!raw) return "";

  const numeric = Number(raw.replace(/,/g, ""));
  if (Number.isFinite(numeric) && numeric <= 0) {
    return "";
  }

  return raw;
}

// Content gutter shared by every rail so cards line up with section titles.
const GUTTER = 16;

function Rail({ children, itemWidth, gap = 10 }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={itemWidth + gap}
      snapToAlignment="start"
      contentContainerStyle={{ paddingHorizontal: GUTTER, gap }}
      style={{ marginHorizontal: -GUTTER }}
    >
      {children}
    </ScrollView>
  );
}

function DevotionCarousel({ devotions, go, appLanguage }) {
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const cardWidth = width - GUTTER * 2;
  const items = devotions.slice(0, 5);

  if (items.length === 0) return null;

  return (
    <View style={{ marginTop: 6 }}>
      <ScrollView
        horizontal
        pagingEnabled={false}
        snapToInterval={cardWidth + 12}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 12 }}
        style={{ marginHorizontal: -GUTTER }}
        onMomentumScrollEnd={event => {
          const next = Math.round(event.nativeEvent.contentOffset.x / (cardWidth + 12));
          setIndex(Math.max(0, Math.min(items.length - 1, next)));
        }}
      >
        {items.map((devotion, position) => (
          <View key={devotion.id || position} style={{ width: cardWidth }}>
            <View style={home.devStack} />
            <Pressable
              style={({ pressed }) => [home.devCard, pressed && { opacity: 0.9 }]}
              onPress={() => go("DevotionDetail", devotion)}
              accessibilityRole="button"
              accessibilityLabel={`${tr(appLanguage, position === 0 ? "Today's Devotional" : "Devotional")}: ${devotion.title}`}
            >
              <Image source={{ uri: devotionImage(devotion) }} style={home.devImage} />
              <View style={home.devBody}>
                <View style={home.devPill}>
                  <Text style={home.devPillText}>
                    {tr(appLanguage, position === 0 ? "Today's Devotional" : "Devotional")}
                  </Text>
                </View>
                <Text style={home.devTitle} numberOfLines={2}>{devotion.title}</Text>
                <Text style={home.devExcerpt} numberOfLines={4}>
                  {devotion.excerpt || devotion.body || tr(appLanguage, "Read today's devotion.")}
                </Text>
                {devotion.date || devotion.devotionDate ? (
                  <View style={home.dateChip}>
                    <Ionicons name="calendar-outline" size={13} color={C.accentText} />
                    <Text style={home.dateChipText}>{devotion.date || devotion.devotionDate}</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          </View>
        ))}
      </ScrollView>

      {items.length > 1 ? (
        <View style={home.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {items.map((item, position) => (
            <View key={item.id || position} style={[home.dot, position === index && home.dotActive]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ProgressBits({ progressEntry, downloadEntry, appLanguage }) {
  const showContinue = hasContinueProgress(progressEntry);
  const downloaded = Boolean(downloadEntry?.localUri);

  if (!showContinue && !downloaded) return null;

  return (
    <>
      {showContinue ? (
        <View style={home.progressTrack}>
          <View style={[home.progressFill, { width: `${Math.max(4, Math.round(progressRatio(progressEntry) * 100))}%` }]} />
        </View>
      ) : null}
      <View style={home.metaRow}>
        {downloaded ? <Ionicons name="checkmark-circle" size={13} color={C.accentText} /> : null}
        <Text style={home.metaAccent} numberOfLines={1}>
          {showContinue
            ? `${tr(appLanguage, "Continue")} · ${formatPlaybackTime(progressEntry.positionMs)} / ${formatPlaybackTime(progressEntry.durationMs)}`
            : tr(appLanguage, "Downloaded")}
        </Text>
      </View>
    </>
  );
}

function VideoTile({ item, width, onPress, progressEntry, downloadEntry, appLanguage }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ width }, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityLabel={`Video sermon, ${item.title}`}
    >
      <View style={home.videoThumbWrap}>
        <Image source={{ uri: sermonThumbnail(item, PHASE1_IMAGES.sermon) }} style={home.videoThumb} />
        {item.live ? (
          <View style={home.liveTag}>
            <Text style={home.livePillText}>LIVE</Text>
          </View>
        ) : null}
      </View>
      <Text style={home.tileTitle} numberOfLines={2}>{item.title}</Text>
      <ProgressBits progressEntry={progressEntry} downloadEntry={downloadEntry} appLanguage={appLanguage} />
    </Pressable>
  );
}

function SquareTile({ item, width, onPress, progressEntry, downloadEntry, appLanguage, badge }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ width }, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      <View>
        {item.type === "audio" ? (
          <AudioArt item={item} size={width} />
        ) : (
          <Image source={{ uri: sermonThumbnail(item, PHASE1_IMAGES.sermon) }} style={[home.squareArt, { width, height: width }]} />
        )}
        {badge ? (
          <View style={home.squareBadge}>
            <Ionicons name={badge} size={14} color={C.textOnAccent} />
          </View>
        ) : null}
      </View>
      <Text style={home.tileTitle} numberOfLines={2}>{item.title}</Text>
      <ProgressBits progressEntry={progressEntry} downloadEntry={downloadEntry} appLanguage={appLanguage} />
    </Pressable>
  );
}

function EventTile({ item, width, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ width }, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      <Image source={{ uri: contentImage(item, PHASE1_IMAGES.event) }} style={home.eventImage} />
      <Text style={home.tileTitle} numberOfLines={2}>{item.title}</Text>
      <View style={home.metaRow}>
        <Ionicons name="calendar-outline" size={13} color={C.gold} />
        <Text style={home.meta} numberOfLines={1}>
          {[item.date, item.time].filter(Boolean).join(" · ")}
        </Text>
      </View>
    </Pressable>
  );
}

function UpdateRow({ item, go }) {
  if (!item) return null;

  return (
    <Pressable
      style={({ pressed }) => [home.updateRow, pressed && { opacity: 0.7 }]}
      onPress={() => go("Updates")}
      accessibilityRole="button"
    >
      <Image source={{ uri: contentImage(item, PHASE1_IMAGES.event) }} style={home.updateImage} />
      <View style={{ flex: 1 }}>
        <Text style={home.updateTitle} numberOfLines={2}>{item.title}</Text>
        {item.excerpt ? <Text style={home.updateExcerpt} numberOfLines={2}>{item.excerpt}</Text> : null}
        {item.date ? <Text style={home.meta}>{item.date}</Text> : null}
      </View>
    </Pressable>
  );
}

function ScriptureCard({ scripture, appLanguage }) {
  const item = scripture || {};

  const share = () => {
    Share.share({ message: `${item.verse || ""} - ${item.reference || ""}` });
  };

  return (
    <View style={s.scriptureCard}>
      <LinearGradient
        colors={["rgba(212,175,55,0.16)", "rgba(212,175,55,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={fill}
        pointerEvents="none"
      />
      <View style={s.scriptureHead}>
        <View style={home.verseLabel}>
          <Ionicons name="book" size={15} color={C.gold} />
          <Text style={home.verseLabelText}>{item.title || tr(appLanguage, "Scripture of the Day")}</Text>
        </View>

        <Pressable
          onPress={share}
          style={({ pressed }) => [home.shareBtn, pressed && { opacity: 0.6 }]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Share scripture"
        >
          <Ionicons name="share-social-outline" size={18} color={C.white} />
        </Pressable>
      </View>

      <Text style={s.verseText}>{item.verse || tr(appLanguage, "The word of God is life.")}</Text>
      {item.reference ? <Text style={home.reference}>{item.reference}</Text> : null}
    </View>
  );
}

export function HomeScreen({ go, openDrawer, openSermon, appLanguage = "en" }) {
  const { data, loading, reload } = useContent();
  const progressMap = usePlaybackProgressMap();
  const downloads = useDownloadsMap();
  const { width } = useWindowDimensions();

  // Responsive card sizes: wide 16:9 tiles show ~1.3 per screen, square art ~2.4.
  const videoWidth = Math.min(320, Math.round(width * 0.66));
  const squareWidth = Math.min(180, Math.round(width * 0.365));
  const clipWidth = Math.min(260, Math.round((width - GUTTER) * 0.56));
  const eventWidth = Math.min(300, Math.round((width - GUTTER) * 0.66));

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
      return isVideoUrl(mediaUrl);
    });
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

  const tileProps = item => ({
    item,
    progressEntry: progressMap[item.id],
    downloadEntry: downloads.bySermonId[item.id],
    appLanguage,
    onPress: () => openSermon(item)
  });

  return (
    <Screen>
      <TopBar
        go={go}
        onMenu={openDrawer}
        appLanguage={appLanguage}
        right={
          <>
            <IconButton name="search-outline" accessibilityLabel="Search" onPress={() => go("Search")} />
            <IconButton name="notifications-outline" accessibilityLabel="Notifications" onPress={() => go("Notifications")} />
          </>
        }
      />

      <ScrollView
        contentContainerStyle={s.scrollPad}
        showsVerticalScrollIndicator={false}
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
        {data.live?.isLive ? (
          <LivePreview
            live={data.live}
            onOpen={() => go("Live")}
            appLanguage={appLanguage}
            fallbackImage={videos[0] ? sermonThumbnail(videos[0], PHASE1_IMAGES.sermon) : undefined}
          />
        ) : null}

        <DevotionCarousel devotions={devotions} go={go} appLanguage={appLanguage} />

        {continuingSermons.length > 0 ? (
          <>
            <SectionHeader title="Continue Listening" appLanguage={appLanguage} />
            <Rail itemWidth={squareWidth}>
              {continuingSermons.map(item =>
                item.type === "audio" ? (
                  <SquareTile key={item.id} width={squareWidth} {...tileProps(item)} />
                ) : (
                  <VideoTile key={item.id} width={videoWidth} {...tileProps(item)} />
                )
              )}
            </Rail>
          </>
        ) : null}

        {videos.length > 0 ? (
          <>
            <SectionHeader title="Latest Video Sermons" onPress={() => go("Sermons")} appLanguage={appLanguage} />
            <Rail itemWidth={videoWidth}>
              {videos.slice(0, 10).map(item => (
                <VideoTile key={item.id} width={videoWidth} {...tileProps(item)} />
              ))}
            </Rail>
          </>
        ) : null}

        {audio.length > 0 ? (
          <>
            <SectionHeader title="Latest Audio Sermons" onPress={() => go("Sermons")} appLanguage={appLanguage} />
            <Rail itemWidth={squareWidth}>
              {audio.slice(0, 10).map(item => (
                <SquareTile key={item.id} width={squareWidth} {...tileProps(item)} />
              ))}
            </Rail>
          </>
        ) : null}

        {playableClips.length > 0 ? (
          <>
            <SectionHeader title="Recaps" onPress={() => go("Sermons")} appLanguage={appLanguage} />
            <Rail itemWidth={clipWidth}>
              {playableClips.slice(0, 10).map(item => (
                <VideoTile key={item.id} width={clipWidth} {...tileProps(item)} />
              ))}
            </Rail>
          </>
        ) : null}

        <ScriptureCard scripture={data.scripture} appLanguage={appLanguage} />

        {events.length > 0 ? (
          <>
            <SectionHeader title="Upcoming Events" onPress={() => go("Events")} appLanguage={appLanguage} />
            <Rail itemWidth={eventWidth}>
              {events.slice(0, 6).map(item => (
                <EventTile key={item.id} item={item} width={eventWidth} onPress={() => go("EventDetail", item)} />
              ))}
            </Rail>
          </>
        ) : null}

        {updates.length > 0 ? (
          <>
            <SectionHeader title="Latest Updates" onPress={() => go("Updates")} appLanguage={appLanguage} />
            {updates.slice(0, 3).map(item => (
              <UpdateRow key={item.id} item={item} go={go} />
            ))}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const home = makeThemedStyles(C => ({
  liveBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.redSoft,
    borderWidth: 1,
    borderColor: C.red,
    borderRadius: 14,
    padding: 12,
    marginTop: 4,
    marginBottom: 12
  },
  livePill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.red, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  livePillText: { color: "#FFFFFF", fontSize: 11, fontFamily: C.fontBold, letterSpacing: 0.8 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#FFFFFF" },
  liveTitle: { color: C.white, fontSize: 15, fontFamily: C.fontBold },
  liveMeta: { color: C.muted, fontSize: 12.5, fontFamily: C.fontBody, marginTop: 2 },
  liveTag: { position: "absolute", top: 8, left: 8, backgroundColor: C.red, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },

  devStack: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: -8,
    height: 40,
    borderRadius: 18,
    backgroundColor: C.surface2,
    opacity: 0.7
  },
  devCard: {
    flexDirection: "row",
    minHeight: 220,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: C.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.lineStrong
  },
  devImage: { width: "40%", backgroundColor: C.surface2 },
  devBody: { flex: 1, padding: 14, justifyContent: "center" },
  devPill: { alignSelf: "flex-start", backgroundColor: C.accentPressed, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 10 },
  devPillText: { color: "#FFFFFF", fontSize: 12, fontFamily: C.fontBold },
  devTitle: { color: C.white, fontSize: 17, lineHeight: 22, fontFamily: C.fontBold },
  devExcerpt: { color: C.muted, fontSize: 13.5, lineHeight: 19, fontFamily: C.fontBody, marginTop: 6 },
  dateChip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.accentSoft,
    backgroundColor: C.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  dateChipText: { color: C.accentText, fontSize: 12, fontFamily: C.fontBold },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 18 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.surface3 },
  dotActive: { width: 18, backgroundColor: C.gold },

  videoThumbWrap: { borderRadius: 14, overflow: "hidden", backgroundColor: C.surface2 },
  videoThumb: { width: "100%", aspectRatio: 16 / 9 },
  squareArt: { borderRadius: 14, backgroundColor: C.surface2 },
  squareBadge: { position: "absolute", right: 8, bottom: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: C.gold, alignItems: "center", justifyContent: "center" },
  tileTitle: { color: C.white, fontSize: 14.5, lineHeight: 20, fontFamily: C.fontMedium, marginTop: 10 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 },
  meta: { color: C.muted, fontSize: 12.5, fontFamily: C.fontBody, flexShrink: 1 },
  metaAccent: { color: C.accentText, fontSize: 12, fontFamily: C.fontBold, flexShrink: 1 },
  progressTrack: { marginTop: 8, height: 3, borderRadius: 999, backgroundColor: C.surface3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: C.accent },

  eventImage: { width: "100%", aspectRatio: 16 / 9, borderRadius: 14, backgroundColor: C.surface2 },

  updateRow: { flexDirection: "row", gap: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.lineStrong },
  updateImage: { width: 96, height: 96, borderRadius: 12, backgroundColor: C.surface2 },
  updateTitle: { color: C.white, fontSize: 15.5, lineHeight: 21, fontFamily: C.fontBold },
  updateExcerpt: { color: C.muted, fontSize: 13.5, lineHeight: 19, fontFamily: C.fontBody, marginTop: 4, marginBottom: 6 },

  verseLabel: { flexDirection: "row", alignItems: "center", gap: 8 },
  verseLabelText: { color: C.gold, fontSize: 12, fontFamily: C.fontBold, letterSpacing: 1.1, textTransform: "uppercase" },
  shareBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surface2, alignItems: "center", justifyContent: "center" },
  reference: { color: C.gold, fontSize: 13.5, fontFamily: C.fontBold, marginTop: 14, letterSpacing: 0.3 }
}));
