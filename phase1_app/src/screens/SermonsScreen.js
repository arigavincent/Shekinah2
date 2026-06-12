import React, { useMemo, useState } from "react";
import {
  Image,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useContent } from "../providers/ContentProvider";

import { PHASE1_IMAGES } from "../content";
import { C } from "../constants/theme";
import { tr } from "../i18n/labels";
import { s } from "../styles/appStyles";
import { Screen } from "../components/Screen";
import { TopBar } from "../components/TopBar";
import { IconButton } from "../components/IconButton";
import { Tabs } from "../components/Tabs";
import { ClipCard } from "../components/Cards";
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
  const date = item?.date || item?.sermonDate || "";
  const category = item?.category || "Sermon";

  if (date && category) return `${date} - ${category}`;
  return date || category;
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

function mediaBadge(item) {
  if (item.category === "Clips") return "Clip";
  if (item.type === "audio") return "Audio";
  if (extractYouTubeId(sermonMediaUrl(item))) return "YouTube";
  return "Video";
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

function SermonRow({ item, openSermon, progressEntry, downloadEntry, appLanguage }) {
  const thumbnail = sermonThumbnail(item, PHASE1_IMAGES.sermon);
  const showContinue = hasContinueProgress(progressEntry);
  const progressPercent = Math.max(4, Math.round(progressRatio(progressEntry) * 100));
  const missingAudioFile = item?.type === "audio" && !hasValidMediaUrl(item);
  const downloaded = Boolean(downloadEntry?.localUri);

  return (
    <Pressable
      key={item.id}
      style={s.listRow}
      onPress={() => openSermon(item)}
    >
      <Image source={{ uri: thumbnail }} style={s.rowImage} />

      <View style={s.rowBody}>
        <Text style={s.rowTitle}>
          {item.isLive ? "LIVE  " : ""}
          {item.title}
        </Text>

        <Text style={s.mutedText}>{sermonMeta(item)}</Text>

        {showContinue ? (
          <>
            <Text style={s.goldSmall}>
              {tr(appLanguage, "Continue")} · {formatPlaybackTime(progressEntry.positionMs)} / {formatPlaybackTime(progressEntry.durationMs)}
            </Text>

            <View
              style={{
                marginTop: 8,
                height: 4,
                borderRadius: 999,
                backgroundColor: C.surface2,
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
        ) : (
          <Text style={s.goldSmall}>
            {downloaded
              ? `${tr(appLanguage, "Downloaded")} · ${missingAudioFile ? tr(appLanguage, "audio pending") : mediaBadge(item)}`
              : missingAudioFile
                ? tr(appLanguage, "Audio added · file pending")
                : mediaBadge(item)}
          </Text>
        )}
      </View>

      <View style={s.playDot}>
        <Ionicons
          name={
            missingAudioFile
              ? "alert-circle-outline"
              : item.type === "audio"
                ? "musical-notes-outline"
                : "play-outline"
          }
          size={18}
          color={missingAudioFile ? C.gold : C.white}
        />
      </View>
    </Pressable>
  );
}

function CategoryTile({ category, sermons, onPress }) {
  const name = categoryName(category);
  const coverSermon = sermons[0];
  const cover = coverSermon ? sermonThumbnail(coverSermon, PHASE1_IMAGES.sermon) : PHASE1_IMAGES.sermon;
  const videoCount = sermons.filter(isPlayableVideoSermon).length;
  const audioCount = sermons.filter(isPlayableAudioSermon).length;
  const total = sermons.length;

  return (
    <Pressable
      onPress={onPress}
      style={{
        width: "48%",
        minHeight: 168,
        borderRadius: 18,
        overflow: "hidden",
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: C.line,
        marginBottom: 14
      }}
    >
      <ImageBackground
        source={{ uri: cover }}
        style={{
          flex: 1,
          justifyContent: "space-between"
        }}
        imageStyle={{
          opacity: total > 0 ? 0.9 : 0.35
        }}
      >
        <View
          style={{
            ...StyleSheetAbsoluteFill,
            backgroundColor: "rgba(0,0,0,0.42)"
          }}
        />

        <View
          style={{
            padding: 12,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: "rgba(0,0,0,0.65)",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.16)"
            }}
          >
            <Ionicons name="albums-outline" size={19} color={C.gold} />
          </View>

          <View
            style={{
              backgroundColor: C.gold,
              borderRadius: 999,
              paddingHorizontal: 9,
              paddingVertical: 4
            }}
          >
            <Text
              style={{
                color: C.black,
                fontSize: 11,
                fontWeight: "900"
              }}
            >
              {total}
            </Text>
          </View>
        </View>

        <View style={{ padding: 12 }}>
            <Text
              style={{
                color: C.textOnBrand,
                fontSize: 17,
                fontWeight: "900"
              }}
            numberOfLines={2}
          >
            {name}
          </Text>

          <Text
            style={{
              color: "rgba(255,255,255,0.82)",
              fontSize: 12,
              fontWeight: "800",
              marginTop: 5
            }}
          >
            {videoCount} video · {audioCount} audio
          </Text>

          {coverSermon ? (
            <Text
              style={{
                color: C.gold,
                fontSize: 11,
                fontWeight: "900",
                marginTop: 8
              }}
              numberOfLines={1}
            >
              Latest: {coverSermon.title}
            </Text>
          ) : (
            <Text
              style={{
                color: C.faint,
                fontSize: 11,
                fontWeight: "800",
                marginTop: 8
              }}
            >
              No playable sermons yet
            </Text>
          )}
        </View>
      </ImageBackground>
    </Pressable>
  );
}

const StyleSheetAbsoluteFill = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0
};


function HighlightCard({ item, featured = false, openSermon }) {
  const thumbnail = sermonThumbnail(item, PHASE1_IMAGES.sermon);
  const badge = mediaBadge(item);

  return (
    <Pressable
      onPress={() => openSermon(item)}
      style={{
        width: "100%",
        minHeight: featured ? 230 : 148,
        borderRadius: 20,
        overflow: "hidden",
        backgroundColor: C.surface,
        borderWidth: 1,
        borderColor: featured ? C.gold : C.line,
        marginBottom: 14
      }}
    >
      <ImageBackground
        source={{ uri: thumbnail }}
        style={{
          flex: 1,
          justifyContent: "space-between"
        }}
        imageStyle={{
          opacity: 0.9
        }}
      >
        <View
          style={{
            ...StyleSheetAbsoluteFill,
            backgroundColor: featured ? "rgba(0,0,0,0.36)" : "rgba(0,0,0,0.48)"
          }}
        />

        <View
          style={{
            padding: 14,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <View
            style={{
              backgroundColor: C.gold,
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 5
            }}
          >
            <Text
              style={{
                color: C.black,
                fontSize: 11,
                fontWeight: "900"
              }}
            >
              {featured ? "FEATURED" : badge.toUpperCase()}
            </Text>
          </View>

          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 21,
              backgroundColor: "rgba(0,0,0,0.68)",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.18)"
            }}
          >
            <Ionicons
              name={item.type === "audio" ? "musical-notes-outline" : "play-outline"}
              size={22}
              color={C.textOnBrand}
            />
          </View>
        </View>

        <View style={{ padding: 14 }}>
          <Text
            style={{
              color: C.textOnBrand,
              fontSize: featured ? 24 : 18,
              fontWeight: "900"
            }}
            numberOfLines={featured ? 2 : 1}
          >
            {item.title}
          </Text>

          <Text
            style={{
              color: "rgba(255,255,255,0.82)",
              fontSize: 13,
              fontWeight: "800",
              marginTop: 6
            }}
            numberOfLines={1}
          >
            {sermonMeta(item)}
          </Text>

          <Text
            style={{
              color: C.gold,
              fontSize: 12,
              fontWeight: "900",
              marginTop: 8
            }}
          >
            {badge}
          </Text>
        </View>
      </ImageBackground>
    </Pressable>
  );
}

function HighlightsView({ items, openSermon }) {
  if (items.length === 0) {
    return (
      <View style={s.plainCard}>
        <Text style={s.rowTitle}>No highlights found</Text>
        <Text style={s.mutedText}>
          Upload valid sermon media from the admin dashboard.
        </Text>
      </View>
    );
  }

  const [featured, ...rest] = items;

  return (
    <>
      <HighlightCard item={featured} featured openSermon={openSermon} />

      {rest.map(item => (
        <HighlightCard key={item.id} item={item} openSermon={openSermon} />
      ))}
    </>
  );
}

function ClipsView({ items, openSermon }) {
  if (items.length === 0) {
    return (
      <View style={s.plainCard}>
        <Text style={s.rowTitle}>No clips found</Text>
        <Text style={s.mutedText}>
          Playable clips will appear here.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between"
      }}
    >
      {items.map(item => (
        <View
          key={item.id}
          style={{
            width: "48%",
            marginBottom: 14
          }}
        >
          <ClipCard
            item={item}
            onPress={() => openSermon(item)}
            style={{ width: "100%", height: 168 }}
          />
        </View>
      ))}
    </View>
  );
}

export function SermonsScreen({ go, openDrawer, openSermon, tab, setTab, appLanguage = "en" }) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const { data, loading, reload } = useContent();
  const progressMap = usePlaybackProgressMap();
  const downloads = useDownloadsMap();

  const sermons = Array.isArray(data.sermons) ? data.sermons : [];
  const categories = Array.isArray(data.categories) ? data.categories : [];

  const playable = useMemo(() => {
    return sermons.filter(isPlayableSermon);
  }, [sermons]);

  const videos = useMemo(() => {
    return sermons.filter(isPlayableVideoSermon);
  }, [sermons]);

  const audio = useMemo(() => {
    return sermons.filter(isAudioSermon);
  }, [sermons]);

  const clips = useMemo(() => {
    const sourceClips = Array.isArray(data.clips) ? data.clips : [];

    return sourceClips
      .map(playableClipFromContent)
      .filter(item => {
        const mediaUrl = sermonMediaUrl(item);
        return Boolean(extractYouTubeId(mediaUrl) || isVideoUrl(mediaUrl));
      });
  }, [data.clips]);

  const highlights = useMemo(() => {
    return playable.slice(0, 10);
  }, [playable]);

  const selectedCategoryItems = useMemo(() => {
    if (!selectedCategory) return [];
    return playable.filter(item => sermonBelongsToCategory(item, selectedCategory));
  }, [playable, selectedCategory]);

  const items =
    tab === "Video"
      ? videos
      : tab === "Audio"
        ? audio
        : tab === "Clips"
          ? clips
          : tab === "Highlights"
            ? highlights
            : tab === "Categories" && selectedCategory
              ? selectedCategoryItems
              : [];

  const visible = items.filter(item => matchesQuery(item, query));

  function handleSetTab(nextTab) {
    setQuery("");
    setSelectedCategory(null);
    setTab(nextTab);
  }

  return (
    <Screen>
      <TopBar
        go={go}
        title="Sermons"
        onMenu={openDrawer}
        appLanguage={appLanguage}
        right={
          <View style={s.rowTight}>
            <IconButton name="download-outline" onPress={() => go("Downloads")} />
            <IconButton name="heart-outline" />
          </View>
        }
      />

      <Tabs
        tabs={["Video", "Audio", "Clips", "Categories", "Highlights"]}
        active={tab}
        setActive={handleSetTab}
        appLanguage={appLanguage}
      />

      {tab !== "Categories" || selectedCategory ? (
        <View style={s.pad}>
          <TextInput
            style={s.searchInput}
            placeholder={`${tr(appLanguage, "Search")} ${selectedCategory ? categoryName(selectedCategory) : tr(appLanguage, tab).toLowerCase()}`}
            placeholderTextColor={C.faint}
            value={query}
            onChangeText={setQuery}
          />
        </View>
      ) : null}

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
        {tab === "Categories" && !selectedCategory ? (
          categories.length === 0 ? (
            <View style={s.plainCard}>
              <Text style={s.rowTitle}>{tr(appLanguage, "No categories found")}</Text>
              <Text style={s.mutedText}>Create sermon categories from backend/admin data.</Text>
            </View>
          ) : (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "space-between"
              }}
            >
              {categories.map(category => {
                const categorySermons = playable.filter(item => sermonBelongsToCategory(item, category));

                return (
                  <CategoryTile
                    key={categoryId(category)}
                    category={category}
                    sermons={categorySermons}
                    onPress={() => setSelectedCategory(category)}
                  />
                );
              })}
            </View>
          )
        ) : tab === "Categories" && selectedCategory ? (
          <>
            <Pressable
              style={s.plainCard}
              onPress={() => {
                setSelectedCategory(null);
                setQuery("");
              }}
            >
              <Text style={s.goldSmall}>{tr(appLanguage, "Back to categories")}</Text>
              <Text style={s.rowTitle}>{categoryName(selectedCategory)}</Text>
              <Text style={s.mutedText}>
                {selectedCategoryItems.length} playable sermon{selectedCategoryItems.length === 1 ? "" : "s"}
              </Text>
            </Pressable>

            {visible.length === 0 ? (
              <View style={s.plainCard}>
                <Text style={s.rowTitle}>{tr(appLanguage, "No sermons in this category")}</Text>
                <Text style={s.mutedText}>Upload or assign sermons to this category.</Text>
              </View>
            ) : (
              visible.map(item => (
                <SermonRow
                  key={item.id}
                  item={item}
                  downloadEntry={downloads.bySermonId[item.id]}
                  progressEntry={progressMap[item.id]}
                  appLanguage={appLanguage}
                  openSermon={openSermon}
                />
              ))
            )}
          </>
        ) : tab === "Clips" ? (
          <ClipsView items={visible} openSermon={openSermon} />
        ) : tab === "Highlights" ? (
          <HighlightsView items={visible} openSermon={openSermon} />
        ) : visible.length === 0 ? (
          <View style={s.plainCard}>
            <Text style={s.rowTitle}>{`${tr(appLanguage, "No")} ${tr(appLanguage, tab).toLowerCase()} ${tr(appLanguage, "sermons found")}`}</Text>
            <Text style={s.mutedText}>
              {tab === "Audio"
                ? tr(appLanguage, "Audio sermons from the database will appear here.")
                : tr(appLanguage, "Playable sermon media will appear here.")}
            </Text>
          </View>
        ) : (
          visible.map(item => (
            <SermonRow
              key={item.id}
              item={item}
              downloadEntry={downloads.bySermonId[item.id]}
              progressEntry={progressMap[item.id]}
              appLanguage={appLanguage}
              openSermon={openSermon}
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
