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
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "../components/Icon";

import { useContent } from "../providers/ContentProvider";
import { PHASE1_IMAGES } from "../content";
import { C, makeThemedStyles } from "../constants/theme";
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
import { tr } from "../i18n/labels";
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

function cleanViewerCount(value) {
  const raw = cleanText(value);
  if (!raw) return "";

  const numeric = Number(raw.replace(/,/g, ""));
  if (Number.isFinite(numeric) && numeric <= 0) {
    return "";
  }

  return raw;
}

function HomeHero({ live, featuredVideo, go, appLanguage }) {
  const heroImage = featuredVideo
    ? sermonThumbnail(featuredVideo, PHASE1_IMAGES.sermon)
    : PHASE1_IMAGES.crowd;
  const isLive = Boolean(live?.isLive);
  const liveViewerCount = isLive ? cleanViewerCount(live?.viewers) : "";
  const heroTitle = isLive
    ? cleanText(live?.title) || tr(appLanguage, "Live Stream")
    : featuredVideo?.title || tr(appLanguage, "Stay connected to the word, worship, and prayer.");
  const heroSubtitle = isLive
    ? tr(appLanguage, "Join the service now.")
    : cleanText(live?.nextService)
      ? `${tr(appLanguage, "Next service:")} ${cleanText(live?.nextService)}`
      : featuredVideo?.speaker || "";

  return (
    <Pressable
      onPress={() => (isLive || !featuredVideo ? go("Live") : go("VideoDetail", featuredVideo))}
      style={({ pressed }) => [home.hero, pressed && { opacity: 0.92 }]}
      accessibilityRole="button"
      accessibilityLabel={heroTitle}
    >
      <ImageBackground source={{ uri: heroImage }} style={home.heroImage} resizeMode="cover">
        <LinearGradient
          colors={["rgba(7,8,10,0.05)", "rgba(7,8,10,0.35)", "rgba(7,8,10,0.94)"]}
          locations={[0, 0.45, 1]}
          style={fill}
        />

        <View style={home.heroTop}>
          {isLive ? (
            <View style={[home.chip, { backgroundColor: C.red }]}>
              <View style={home.liveDot} />
              <Text style={home.chipTextLight}>{tr(appLanguage, "LIVE NOW")}</Text>
            </View>
          ) : (
            <View style={[home.chip, home.chipGlass]}>
              <Text style={home.chipTextGold}>{tr(appLanguage, featuredVideo ? "LATEST MESSAGE" : "NEXT SERVICE")}</Text>
            </View>
          )}

          {liveViewerCount ? (
            <View style={[home.chip, home.chipGlass]}>
              <Ionicons name="eye-outline" size={13} color="#FFFFFF" />
              <Text style={home.chipTextLight}>{liveViewerCount}</Text>
            </View>
          ) : null}
        </View>

        <View style={home.heroBottom}>
          <Text style={home.heroTitle} numberOfLines={2}>{heroTitle}</Text>
          {heroSubtitle ? (
            <Text style={home.heroSubtitle} numberOfLines={1}>{heroSubtitle}</Text>
          ) : null}

          <View style={home.heroActions}>
            <Pressable
              style={({ pressed }) => [home.btnPrimary, pressed && { backgroundColor: C.accentPressed }]}
              onPress={() => (isLive || !featuredVideo ? go("Live") : go("VideoDetail", featuredVideo))}
              accessibilityRole="button"
            >
              <Ionicons name="play" size={16} color="#FFFFFF" />
              <Text style={home.btnPrimaryText}>
                {tr(appLanguage, isLive ? "Watch Live" : featuredVideo ? "Watch Now" : "Open Live")}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [home.btnGhost, pressed && { backgroundColor: "rgba(255,255,255,0.16)" }]}
              onPress={() => go("Sermons")}
              accessibilityRole="button"
            >
              <Text style={home.btnGhostText}>{tr(appLanguage, "Sermons")}</Text>
            </Pressable>
          </View>
        </View>
      </ImageBackground>
    </Pressable>
  );
}

function QuickActions({ go, appLanguage }) {
  const actions = [
    { label: "Give", icon: "heart-outline", screen: "Giving" },
    { label: "Prayer", icon: "hand-left-outline", screen: "Prayer" },
    { label: "Events", icon: "calendar-outline", screen: "Events" },
    { label: "Branches", icon: "location-outline", screen: "Branches" }
  ];

  return (
    <View style={home.quickRow}>
      {actions.map(action => (
        <Pressable
          key={action.label}
          onPress={() => go(action.screen)}
          style={({ pressed }) => [home.quickItem, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel={tr(appLanguage, action.label)}
        >
          <View style={home.quickIcon}>
            <Ionicons name={action.icon} size={22} color={C.gold} />
          </View>
          <Text style={home.quickLabel} numberOfLines={1}>{tr(appLanguage, action.label)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function MediaBadges({ downloaded, showContinue, progressEntry, progressPercent, appLanguage }) {
  return (
    <>
      {downloaded ? (
        <View style={home.metaRow}>
          <Ionicons name="checkmark-circle" size={13} color={C.green} />
          <Text style={home.metaOk}>{tr(appLanguage, "Downloaded")}</Text>
        </View>
      ) : null}

      {showContinue ? (
        <>
          <Text style={home.continueText}>
            {tr(appLanguage, "Continue")} · {formatPlaybackTime(progressEntry.positionMs)} / {formatPlaybackTime(progressEntry.durationMs)}
          </Text>
          <View style={home.progressTrack}>
            <View style={[home.progressFill, { width: `${progressPercent}%` }]} />
          </View>
        </>
      ) : null}
    </>
  );
}

function FeaturedMediaCard({ item, onPress, progressEntry, downloadEntry, appLanguage }) {
  if (!item) return null;

  const thumbnail = sermonThumbnail(item, PHASE1_IMAGES.sermon);
  const isAudio = item.type === "audio";
  const showContinue = hasContinueProgress(progressEntry);
  const progressPercent = Math.max(4, Math.round(progressRatio(progressEntry) * 100));
  const downloaded = Boolean(downloadEntry?.localUri);
  const meta = [item.speaker || item.category, item.date || item.sermonDate].filter(Boolean).join(" · ");

  if (isAudio) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [home.audioCard, pressed && { opacity: 0.8 }]}
        accessibilityRole="button"
        accessibilityLabel={`Audio sermon, ${item.title}`}
      >
        <View>
          <Image source={{ uri: thumbnail }} style={home.audioArt} />
          <View style={home.audioBadge}>
            <Ionicons name="musical-notes" size={13} color="#FFFFFF" />
          </View>
        </View>
        <Text style={home.cardTitle} numberOfLines={2}>{item.title}</Text>
        {meta ? <Text style={home.cardMeta} numberOfLines={1}>{meta}</Text> : null}
        <MediaBadges {...{ downloaded, showContinue, progressEntry, progressPercent, appLanguage }} />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [home.videoCard, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityLabel={`Video sermon, ${item.title}`}
    >
      <View style={home.videoThumbWrap}>
        <Image source={{ uri: thumbnail }} style={home.videoThumb} />
        <View style={home.playBadge}>
          <Ionicons name="play" size={16} color="#FFFFFF" />
        </View>
        {extractYouTubeId(sermonMediaUrl(item)) ? (
          <View style={home.sourceTag}>
            <Ionicons name="logo-youtube" size={12} color="#FFFFFF" />
          </View>
        ) : null}
      </View>
      <Text style={home.cardTitle} numberOfLines={2}>{item.title}</Text>
      {meta ? <Text style={home.cardMeta} numberOfLines={1}>{meta}</Text> : null}
      <MediaBadges {...{ downloaded, showContinue, progressEntry, progressPercent, appLanguage }} />
    </Pressable>
  );
}

function DevotionPreview({ devotion, go, appLanguage }) {
  if (!devotion) return null;

  return (
    <Pressable
      style={({ pressed }) => [s.devotionHero, pressed && { opacity: 0.85 }]}
      onPress={() => go("DevotionDetail", devotion)}
      accessibilityRole="button"
      accessibilityLabel={`${tr(appLanguage, "Today's Devotion")}, ${devotion.title}`}
    >
      <View>
        <Image source={{ uri: devotionImage(devotion) }} style={s.devotionThumb} />
        <View style={s.badgeOnImage}>
          <Text style={s.badgeText}>{tr(appLanguage, "Today")}</Text>
        </View>
      </View>

      <View style={s.devotionBody}>
        <Text style={home.eyebrow}>{tr(appLanguage, "Today's Devotion")}</Text>
        <Text style={s.cardTitle} numberOfLines={2}>{devotion.title}</Text>
        <Text style={s.mutedText} numberOfLines={3}>
          {devotion.excerpt || devotion.body || tr(appLanguage, "Read today's devotion.")}
        </Text>
        <View style={[home.metaRow, { marginTop: 8 }]}>
          <Ionicons name="calendar-outline" size={13} color={C.muted} />
          <Text style={home.cardMeta}>{devotion.date || devotion.devotionDate || ""}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function UpdateRow({ item, go }) {
  if (!item) return null;

  return (
    <Pressable
      style={({ pressed }) => [s.listRow, pressed && { opacity: 0.7 }]}
      onPress={() => go("Updates")}
      accessibilityRole="button"
    >
      <Image source={{ uri: contentImage(item, PHASE1_IMAGES.event) }} style={home.updateImage} />

      <View style={s.rowBody}>
        <Text style={s.rowTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={s.mutedText} numberOfLines={2}>{item.excerpt || item.date}</Text>
        {item.date ? <Text style={home.cardMeta}>{item.date}</Text> : null}
      </View>
    </Pressable>
  );
}

export function HomeScreen({ go, openDrawer, openSermon, appLanguage = "en" }) {
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
        appLanguage={appLanguage}
        right={<IconButton name="search-outline" accessibilityLabel="Search" onPress={() => go("Search")} />}
      />

      <ScrollView
        contentContainerStyle={s.scrollPad}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={reload}
            tintColor={C.accent}
            colors={[C.accent]}
            progressBackgroundColor={C.surface2}
          />
        }
      >
        <HomeHero live={data.live} featuredVideo={featuredVideo} go={go} appLanguage={appLanguage} />

        <QuickActions go={go} appLanguage={appLanguage} />

        <DevotionPreview devotion={todayDevotion} go={go} appLanguage={appLanguage} />

        {continuingSermons.length > 0 ? (
          <>
            <SectionHeader title="Continue Listening" onPress={() => go("Sermons")} appLanguage={appLanguage} />
            <Horizontal>
              {continuingSermons.map(item => (
                <FeaturedMediaCard
                  key={item.id}
                  item={item}
                  downloadEntry={downloads.bySermonId[item.id]}
                  progressEntry={progressMap[item.id]}
                  appLanguage={appLanguage}
                  onPress={() => openSermon(item)}
                />
              ))}
            </Horizontal>
          </>
        ) : null}

        {videos.length > 0 ? (
          <>
            <SectionHeader title="Latest Video Sermons" onPress={() => go("Sermons")} appLanguage={appLanguage} />
            <Horizontal>
              {videos.slice(0, 8).map(item => (
                <FeaturedMediaCard
                  key={item.id}
                  item={item}
                  downloadEntry={downloads.bySermonId[item.id]}
                  progressEntry={progressMap[item.id]}
                  appLanguage={appLanguage}
                  onPress={() => openSermon(item)}
                />
              ))}
            </Horizontal>
          </>
        ) : null}

        {audio.length > 0 ? (
          <>
            <SectionHeader title="Latest Audio Sermons" onPress={() => go("Sermons")} appLanguage={appLanguage} />
            <Horizontal>
              {audio.slice(0, 8).map(item => (
                <FeaturedMediaCard
                  key={item.id}
                  item={item}
                  downloadEntry={downloads.bySermonId[item.id]}
                  progressEntry={progressMap[item.id]}
                  appLanguage={appLanguage}
                  onPress={() => openSermon(item)}
                />
              ))}
            </Horizontal>
          </>
        ) : null}

        <ScriptureCard scripture={data.scripture} appLanguage={appLanguage} />

        {playableClips.length > 0 ? (
          <>
            <SectionHeader title="Short Clips" appLanguage={appLanguage} />
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
            <SectionHeader title="Upcoming Events" onPress={() => go("Events")} appLanguage={appLanguage} />
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

function ScriptureCard({ scripture, appLanguage }) {
  const item = scripture || {};

  const share = () => {
    Share.share({ message: `${item.verse || ""} - ${item.reference || ""}` });
  };

  return (
    <View style={s.scriptureCard}>
      <Text style={home.quoteMark} accessibilityElementsHidden importantForAccessibility="no">“</Text>
      <View style={s.scriptureHead}>
        <Text style={home.eyebrow}>{item.title || tr(appLanguage, "Scripture of the Day")}</Text>

        <Pressable
          onPress={share}
          style={({ pressed }) => [home.shareBtn, pressed && { opacity: 0.6 }]}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Share scripture"
        >
          <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
        </Pressable>
      </View>

      <Text style={s.verseText}>{item.verse || tr(appLanguage, "The word of God is life.")}</Text>
      {item.reference ? <Text style={home.reference}>— {item.reference}</Text> : null}
    </View>
  );
}

const home = makeThemedStyles(C => ({
  hero: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: C.surface,
    marginTop: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.line
  },
  heroImage: { minHeight: 300, justifyContent: "space-between" },
  heroTop: { padding: 14, flexDirection: "row", justifyContent: "space-between" },
  heroBottom: { padding: 18, paddingTop: 0 },
  heroTitle: { color: "#FFFFFF", fontSize: 24, lineHeight: 30, fontFamily: C.fontDisplay, letterSpacing: -0.3 },
  heroSubtitle: { color: "rgba(255,255,255,0.78)", fontSize: 14, fontFamily: C.fontMedium, marginTop: 6 },
  heroActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  chipGlass: { backgroundColor: "rgba(7,8,10,0.62)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  chipTextLight: { color: "#FFFFFF", fontSize: 11, fontFamily: C.fontBold, letterSpacing: 0.8 },
  chipTextGold: { color: "#F1D48A", fontSize: 11, fontFamily: C.fontBold, letterSpacing: 1 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#FFFFFF" },
  btnPrimary: { flex: 1, minHeight: 48, borderRadius: 999, backgroundColor: C.accent, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  btnPrimaryText: { color: "#FFFFFF", fontSize: 15, fontFamily: C.fontBold },
  btnGhost: { flex: 1, minHeight: 48, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)" },
  btnGhostText: { color: "#FFFFFF", fontSize: 15, fontFamily: C.fontBold },
  quickRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18 },
  quickItem: { flex: 1, alignItems: "center", gap: 8, paddingVertical: 4 },
  quickIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  quickLabel: { color: C.white, fontSize: 12.5, fontFamily: C.fontMedium },
  eyebrow: { color: C.gold, fontSize: 11, fontFamily: C.fontBold, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 },
  videoCard: { width: 248 },
  videoThumbWrap: { borderRadius: 12, overflow: "hidden", backgroundColor: C.surface2 },
  videoThumb: { width: "100%", aspectRatio: 16 / 9 },
  playBadge: { position: "absolute", left: 10, bottom: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(7,8,10,0.72)", alignItems: "center", justifyContent: "center" },
  sourceTag: { position: "absolute", right: 8, top: 8, backgroundColor: "rgba(7,8,10,0.72)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4 },
  audioCard: { width: 148 },
  audioArt: { width: 148, height: 148, borderRadius: 12, backgroundColor: C.surface2 },
  audioBadge: { position: "absolute", right: 8, bottom: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: C.accent, alignItems: "center", justifyContent: "center" },
  cardTitle: { color: C.white, fontSize: 14, lineHeight: 19, fontFamily: C.fontBold, marginTop: 10 },
  cardMeta: { color: C.muted, fontSize: 12, fontFamily: C.fontBody, marginTop: 3 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  metaOk: { color: C.green, fontSize: 12, fontFamily: C.fontMedium },
  continueText: { color: C.accentText, fontSize: 12, fontFamily: C.fontBold, marginTop: 6 },
  progressTrack: { marginTop: 6, height: 3, borderRadius: 999, backgroundColor: C.surface3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: C.accent },
  updateImage: { width: 72, height: 72, borderRadius: 12, backgroundColor: C.surface2 },
  quoteMark: { position: "absolute", right: 14, bottom: -40, fontSize: 160, lineHeight: 160, color: "rgba(212,165,55,0.12)", fontFamily: C.fontBrand },
  shareBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.10)", alignItems: "center", justifyContent: "center" },
  reference: { color: "#F1D48A", fontSize: 13, fontFamily: C.fontBold, marginTop: 12, letterSpacing: 0.4 }
}));
