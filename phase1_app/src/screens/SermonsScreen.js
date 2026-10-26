import React, { useMemo, useState } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import { Ionicons } from "../components/Icon";
import { useContent } from "../providers/ContentProvider";

import { AUDIO_COVER, PHASE1_IMAGES } from "../content";
import { C, makeThemedStyles } from "../constants/theme";
import { tr } from "../i18n/labels";
import { s } from "../styles/appStyles";
import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { IconButton } from "../components/IconButton";
import { Tabs } from "../components/Tabs";
import { SearchBar } from "../components/SearchBar";
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
  sermonMediaUrl,
  sermonThumbnail
} from "../utils/mediaUrl";

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

function isAudioSermon(item) {
  return item?.type === "audio";
}

function isPlayableSermon(item) {
  return isPlayableVideoSermon(item) || isPlayableAudioSermon(item);
}

function matchesQuery(item, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  return [
    item?.title,
    item?.speaker,
    item?.category,
    item?.description
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(q);
}

function sermonMeta(item) {
  return [item?.date || item?.sermonDate, item?.speaker].filter(Boolean).join(" · ");
}

function categoryName(category) {
  return category?.name || category?.title || category?.label || "Uncategorized";
}

function categoryId(category) {
  return category?.id || categoryName(category);
}

function sermonBelongsToCategory(sermon, category) {
  const id = categoryId(category);
  const name = categoryName(category).toLowerCase();

  return (
    sermon?.categoryId === id ||
    cleanText(sermon?.category).toLowerCase() === name
  );
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

const SERMON_TABS = ["Video", "Audio", "Categories", "Recaps"];

function RowProgress({ progressEntry, downloadEntry, missingAudioFile, appLanguage }) {
  const showContinue = hasContinueProgress(progressEntry);
  const downloaded = Boolean(downloadEntry?.localUri);

  return (
    <>
      {showContinue ? (
        <View style={st.progressTrack}>
          <View style={[st.progressFill, { width: `${Math.max(4, Math.round(progressRatio(progressEntry) * 100))}%` }]} />
        </View>
      ) : null}
      {showContinue || downloaded || missingAudioFile ? (
        <View style={st.metaRow}>
          {downloaded ? <Ionicons name="checkmark-circle" size={13} color={C.accentText} /> : null}
          {missingAudioFile ? <Ionicons name="alert-circle-outline" size={13} color={C.gold} /> : null}
          <Text style={missingAudioFile ? st.metaGold : st.metaAccent} numberOfLines={1}>
            {showContinue
              ? `${tr(appLanguage, "Continue")} · ${formatPlaybackTime(progressEntry.positionMs)} / ${formatPlaybackTime(progressEntry.durationMs)}`
              : missingAudioFile
                ? tr(appLanguage, "Audio added · file pending")
                : tr(appLanguage, "Downloaded")}
          </Text>
        </View>
      ) : null}
    </>
  );
}

// Video list row: wide thumbnail left, title + date right (Phaneroo layout).
function VideoRow({ item, openSermon, progressEntry, downloadEntry, appLanguage, thumbWidth }) {
  return (
    <Pressable
      style={({ pressed }) => [st.row, pressed && st.rowPressed]}
      onPress={() => openSermon(item)}
      accessibilityRole="button"
      accessibilityLabel={`Video sermon, ${item.title}`}
    >
      <View>
        <Image source={{ uri: sermonThumbnail(item, PHASE1_IMAGES.sermon) }} style={[st.videoThumb, { width: thumbWidth }]} />
        {item.isLive ? (
          <View style={st.liveTag}>
            <Text style={st.liveTagText}>LIVE</Text>
          </View>
        ) : null}
      </View>

      <View style={st.rowBody}>
        <Text style={st.rowTitle} numberOfLines={3}>{item.title}</Text>
        {sermonMeta(item) ? <Text style={st.rowMeta} numberOfLines={1}>{sermonMeta(item)}</Text> : null}
        <RowProgress progressEntry={progressEntry} downloadEntry={downloadEntry} appLanguage={appLanguage} />
      </View>
    </Pressable>
  );
}

// Audio list row: square art, title, meta, play button on the right.
function AudioRow({ item, openSermon, progressEntry, downloadEntry, appLanguage }) {
  const missingAudioFile = !hasValidMediaUrl(item);

  return (
    <Pressable
      style={({ pressed }) => [st.row, pressed && st.rowPressed]}
      onPress={() => openSermon(item)}
      accessibilityRole="button"
      accessibilityLabel={`Audio sermon, ${item.title}`}
    >
      <Image source={{ uri: sermonThumbnail(item, AUDIO_COVER) }} style={st.audioThumb} />

      <View style={st.rowBody}>
        <Text style={st.rowTitle} numberOfLines={2}>{item.title}</Text>
        <View style={st.metaRow}>
          <Ionicons name="pulse" size={13} color={C.muted} />
          <Text style={st.rowMeta} numberOfLines={1}>{sermonMeta(item) || tr(appLanguage, "Audio Sermon")}</Text>
        </View>
        <RowProgress
          progressEntry={progressEntry}
          downloadEntry={downloadEntry}
          missingAudioFile={missingAudioFile}
          appLanguage={appLanguage}
        />
      </View>

      <View style={st.playCircle}>
        <Ionicons name="play" size={18} color={C.accent} />
      </View>
    </Pressable>
  );
}

function GridTile({ title, subtitle, image, onPress, width, badge, wide }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ width, marginBottom: 20 }, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View>
        <Image source={{ uri: image }} style={[st.gridImage, { width, height: wide ? Math.round(width * 9 / 16) : width }]} />
        {badge ? (
          <View style={st.gridBadge}>
            <Ionicons name={badge} size={14} color={C.textOnAccent} />
          </View>
        ) : null}
      </View>
      <Text style={st.gridTitle} numberOfLines={2}>{title}</Text>
      {subtitle ? <Text style={st.rowMeta}>{subtitle}</Text> : null}
    </Pressable>
  );
}

function EmptyMessage({ icon, title, text }) {
  return (
    <View style={st.empty}>
      <Ionicons name={icon} size={44} color={C.faint} />
      <Text style={st.emptyTitle}>{title}</Text>
      {text ? <Text style={st.emptyText}>{text}</Text> : null}
    </View>
  );
}

export function SermonsScreen({ go, openDrawer, openSermon, tab, setTab, appLanguage = "en" }) {
  const [query, setQuery] = useState("");
  const [oldestFirst, setOldestFirst] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const { data, loading, reload } = useContent();
  const progressMap = usePlaybackProgressMap();
  const downloads = useDownloadsMap();
  const { width } = useWindowDimensions();

  const activeTab = SERMON_TABS.includes(tab) ? tab : "Video";
  const gridWidth = Math.floor((width - 32 - 14) / 2);
  const thumbWidth = Math.min(168, Math.round(width * 0.33));

  const sermons = Array.isArray(data.sermons) ? data.sermons : [];
  const categories = Array.isArray(data.categories) ? data.categories : [];

  const playable = useMemo(() => sermons.filter(isPlayableSermon), [sermons]);
  const videos = useMemo(() => sermons.filter(isPlayableVideoSermon), [sermons]);
  const audio = useMemo(() => sermons.filter(isAudioSermon), [sermons]);

  const clips = useMemo(() => {
    const sourceClips = Array.isArray(data.clips) ? data.clips : [];

    return sourceClips
      .map(playableClipFromContent)
      .filter(item => {
        const mediaUrl = sermonMediaUrl(item);
        return Boolean(extractYouTubeId(mediaUrl) || isVideoUrl(mediaUrl));
      });
  }, [data.clips]);

  const selectedCategoryItems = useMemo(() => {
    if (!selectedCategory) return [];
    return playable.filter(item => sermonBelongsToCategory(item, selectedCategory));
  }, [playable, selectedCategory]);

  const items =
    activeTab === "Video"
      ? videos
      : activeTab === "Audio"
        ? audio
        : activeTab === "Recaps"
          ? clips
          : selectedCategory
            ? selectedCategoryItems
            : [];

  const filtered = items.filter(item => matchesQuery(item, query));
  const visible = oldestFirst ? [...filtered].reverse() : filtered;
  const visibleCategories = categories.filter(category =>
    categoryName(category).toLowerCase().includes(query.trim().toLowerCase())
  );

  function handleSetTab(nextTab) {
    setQuery("");
    setSelectedCategory(null);
    setTab(nextTab);
  }

  const rowProps = item => ({
    item,
    openSermon,
    appLanguage,
    progressEntry: progressMap[item.id],
    downloadEntry: downloads.bySermonId[item.id]
  });

  const renderRow = item =>
    item.type === "audio" ? (
      <AudioRow key={item.id} {...rowProps(item)} />
    ) : (
      <VideoRow key={item.id} thumbWidth={thumbWidth} {...rowProps(item)} />
    );

  const searchPlaceholder =
    activeTab === "Categories" && !selectedCategory
      ? tr(appLanguage, "Search categories...")
      : activeTab === "Audio"
        ? tr(appLanguage, "Search all sermons...")
        : activeTab === "Recaps"
          ? tr(appLanguage, "Search recaps...")
          : tr(appLanguage, "Search videos...");

  return (
    <Screen>
      <TopBar
        go={go}
        title="Sermons"
        onMenu={openDrawer}
        appLanguage={appLanguage}
        right={
          <IconButton name="download-outline" accessibilityLabel="Downloads" onPress={() => go("Downloads")} />
        }
      />

      <Tabs tabs={SERMON_TABS} active={activeTab} setActive={handleSetTab} appLanguage={appLanguage} />

      <View style={st.searchWrap}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder={searchPlaceholder}
          trailingIcon={activeTab === "Categories" && !selectedCategory ? null : "swap-vertical"}
          trailingActive={oldestFirst}
          trailingLabel={oldestFirst ? "Showing oldest first" : "Showing newest first"}
          onTrailingPress={() => setOldestFirst(current => !current)}
        />
      </View>

      <ScrollView
        contentContainerStyle={s.scrollPad}
        showsVerticalScrollIndicator={false}
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
        {activeTab === "Categories" && !selectedCategory ? (
          visibleCategories.length === 0 ? (
            <EmptyMessage
              icon="albums-outline"
              title={tr(appLanguage, "No categories found")}
              text={tr(appLanguage, "Sermon categories will appear here when available.")}
            />
          ) : (
            <View style={st.grid}>
              {visibleCategories.map(category => {
                const categorySermons = playable.filter(item => sermonBelongsToCategory(item, category));
                const cover = category.image || category.imageUrl || (categorySermons[0]
                  ? sermonThumbnail(categorySermons[0], PHASE1_IMAGES.sermon)
                  : PHASE1_IMAGES.sermon);

                return (
                  <GridTile
                    key={categoryId(category)}
                    width={gridWidth}
                    image={cover}
                    title={categoryName(category)}
                    subtitle={`${categorySermons.length} ${tr(appLanguage, categorySermons.length === 1 ? "Sermon" : "Sermons")}`}
                    onPress={() => {
                      setQuery("");
                      setSelectedCategory(category);
                    }}
                  />
                );
              })}
            </View>
          )
        ) : activeTab === "Categories" && selectedCategory ? (
          <>
            <Pressable
              style={({ pressed }) => [st.categoryHeader, pressed && { opacity: 0.7 }]}
              onPress={() => {
                setSelectedCategory(null);
                setQuery("");
              }}
              accessibilityRole="button"
              accessibilityLabel={tr(appLanguage, "Back to categories")}
            >
              <Ionicons name="arrow-back" size={20} color={C.white} />
              <View style={{ flex: 1 }}>
                <Text style={st.categoryTitle} numberOfLines={1}>{categoryName(selectedCategory)}</Text>
                <Text style={st.rowMeta}>
                  {selectedCategoryItems.length} {tr(appLanguage, selectedCategoryItems.length === 1 ? "Sermon" : "Sermons")}
                </Text>
              </View>
            </Pressable>

            {visible.length === 0 ? (
              <EmptyMessage
                icon="albums-outline"
                title={tr(appLanguage, "No sermons in this category")}
                text={tr(appLanguage, "Sermons added to this category will appear here.")}
              />
            ) : (
              visible.map(renderRow)
            )}
          </>
        ) : activeTab === "Recaps" ? (
          visible.length === 0 ? (
            <EmptyMessage icon="videocam-outline" title={tr(appLanguage, "No recaps found")} text={tr(appLanguage, "Service recaps will appear here.")} />
          ) : (
            <View style={st.grid}>
              {visible.map(item => (
                <GridTile
                  key={item.id}
                  width={gridWidth}
                  wide
                  image={sermonThumbnail(item, PHASE1_IMAGES.sermon)}
                  title={item.title}
                  subtitle={item.duration || item.date}
                  badge="play"
                  onPress={() => openSermon(item)}
                />
              ))}
            </View>
          )
        ) : visible.length === 0 ? (
          <EmptyMessage
            icon={activeTab === "Audio" ? "musical-notes-outline" : "play-circle-outline"}
            title={query ? tr(appLanguage, "No matching sermons") : `${tr(appLanguage, "No")} ${tr(appLanguage, activeTab).toLowerCase()} ${tr(appLanguage, "sermons found")}`}
            text={
              query
                ? tr(appLanguage, "Try a different word or speaker name.")
                : activeTab === "Audio"
                  ? tr(appLanguage, "Audio sermons from the database will appear here.")
                  : tr(appLanguage, "Playable sermon media will appear here.")
            }
          />
        ) : (
          visible.map(renderRow)
        )}
      </ScrollView>
    </Screen>
  );
}

const st = makeThemedStyles(C => ({
  searchWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.lineStrong
  },
  rowPressed: { opacity: 0.7 },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { color: C.white, fontSize: 15.5, lineHeight: 21, fontFamily: C.fontMedium },
  rowMeta: { color: C.muted, fontSize: 13, fontFamily: C.fontBody, marginTop: 5, flexShrink: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaAccent: { color: C.accentText, fontSize: 12, fontFamily: C.fontBold, marginTop: 5, flexShrink: 1 },
  metaGold: { color: C.gold, fontSize: 12, fontFamily: C.fontBold, marginTop: 5, flexShrink: 1 },
  videoThumb: { aspectRatio: 16 / 9, borderRadius: 12, backgroundColor: C.surface2 },
  audioThumb: { width: 92, height: 92, borderRadius: 12, backgroundColor: C.surface2 },
  liveTag: { position: "absolute", top: 6, left: 6, backgroundColor: C.red, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  liveTagText: { color: "#FFFFFF", fontSize: 10, fontFamily: C.fontBold, letterSpacing: 0.6 },
  playCircle: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.accentSoft, alignItems: "center", justifyContent: "center" },
  progressTrack: { marginTop: 8, height: 3, borderRadius: 999, backgroundColor: C.surface3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: C.accent },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", paddingTop: 8 },
  gridImage: { borderRadius: 14, backgroundColor: C.surface2 },
  gridBadge: { position: "absolute", right: 8, bottom: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: C.gold, alignItems: "center", justifyContent: "center" },
  gridTitle: { color: C.white, fontSize: 15.5, lineHeight: 21, fontFamily: C.fontMedium, marginTop: 10 },
  categoryHeader: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, marginBottom: 4 },
  categoryTitle: { color: C.white, fontSize: 18, fontFamily: C.fontBold },
  empty: { alignItems: "center", paddingVertical: 72, paddingHorizontal: 32, gap: 10 },
  emptyTitle: { color: C.white, fontSize: 18, fontFamily: C.fontBold, textAlign: "center", marginTop: 6 },
  emptyText: { color: C.muted, fontSize: 14, lineHeight: 20, fontFamily: C.fontBody, textAlign: "center" }
}));
