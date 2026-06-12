import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "../components/Screen";
import { ANDROID_STATUS_BAR_HEIGHT, C, makeThemedStyles, useAppTheme } from "../constants/theme";
import { tr } from "../i18n/labels";
import { listBibleVersions } from "../api/bibleVersionsApi";
import {
  DEFAULT_BIBLE_STATE,
  loadBibleState,
  saveBibleState
} from "../services/bibleStorage";
import {
  BUNDLED_VERSION_IDS,
  getVersionChapterVerses,
  installBibleVersion,
  listInstalledBibleVersions,
  openBibleDb,
  removeBibleVersion
} from "../services/bibleVersionInstaller";
import { isBibleSpeechActive, speakBibleText, stopBibleSpeech } from "../services/bibleReaderSpeech";

const ENGLISH = "eng_msb";
const SWAHILI = "swh_neno";
const FONT_SCALES = [0.85, 1, 1.15, 1.3];

function chapterRef(bookId, chapter) {
  return `${bookId}:${chapter}`;
}

function recentKey(bookId, chapter) {
  return `${bookId}:${chapter}`;
}

function verseRef(bookId, chapter, verse) {
  return `${bookId}:${chapter}:${verse}`;
}

async function getBooks(db) {
  return db.getAllAsync(`
    SELECT
      b.id,
      b.code,
      b.testament,
      b.sort_order,
      en.name AS english_name,
      sw.name AS swahili_name
    FROM books b
    JOIN book_labels en
      ON en.book_id = b.id AND en.version_id = '${ENGLISH}'
    JOIN book_labels sw
      ON sw.book_id = b.id AND sw.version_id = '${SWAHILI}'
    ORDER BY b.sort_order ASC
  `);
}

async function getChapterCount(db, bookId) {
  const row = await db.getFirstAsync(
    `
    SELECT MAX(chapter) AS total
    FROM verses
    WHERE version_id = ? AND book_id = ?
    `,
    [ENGLISH, bookId]
  );

  return Number(row?.total || 1);
}

async function getVerseCount(db, bookId, chapter) {
  const row = await db.getFirstAsync(
    `
    SELECT MAX(verse) AS total
    FROM verses
    WHERE version_id = ? AND book_id = ? AND chapter = ?
    `,
    [ENGLISH, bookId, chapter]
  );

  return Number(row?.total || 1);
}

async function getParallelVerses(db, bookId, chapter) {
  return db.getAllAsync(
    `
    SELECT
      en.verse,
      en.text AS english_text,
      sw.text AS swahili_text
    FROM verses en
    LEFT JOIN verses sw
      ON sw.version_id = ?
     AND sw.book_id = en.book_id
     AND sw.chapter = en.chapter
     AND sw.verse = en.verse
    WHERE en.version_id = ?
      AND en.book_id = ?
      AND en.chapter = ?
    ORDER BY en.verse ASC
    `,
    [SWAHILI, ENGLISH, bookId, chapter]
  );
}

async function searchBible(db, query) {
  const q = query.trim();
  if (!q) return [];

  return db.getAllAsync(
    `
    SELECT
      v.version_id,
      b.id AS book_id,
      b.sort_order,
      bl.name AS book_name,
      v.chapter,
      v.verse,
      v.text
    FROM verses v
    JOIN books b ON b.id = v.book_id
    JOIN book_labels bl
      ON bl.book_id = b.id AND bl.version_id = v.version_id
    WHERE v.text LIKE ?
    ORDER BY b.sort_order ASC, v.chapter ASC, v.verse ASC
    LIMIT 40
    `,
    [`%${q}%`]
  );
}

function Header({ title, subtitle, onBack, right }) {
  const { mode, toggleTheme } = useAppTheme();

  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable style={styles.iconBtn} onPress={onBack} hitSlop={10}>
          <Ionicons name="arrow-back" size={26} color={C.text} />
        </Pressable>
      ) : (
        <View style={styles.iconGhost} />
      )}

      <View style={styles.headerTitleWrap}>
        <Text style={styles.headerTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
      </View>

      <View style={styles.headerRight}>
        {right}
        <Pressable style={styles.iconBtn} onPress={toggleTheme} hitSlop={10}>
          <Ionicons
            name={mode === "light" ? "moon-outline" : "sunny-outline"}
            size={22}
            color={C.gold}
          />
        </Pressable>
      </View>
    </View>
  );
}

function TestamentLabel({ value }) {
  return (
    <Text style={styles.muted}>
      {value === "NT" ? "New Testament" : "Old Testament"}
    </Text>
  );
}

export function BibleScreen({ go, appLanguage = "en" }) {
  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState("books");
  const [tab, setTab] = useState("ALL");
  const [books, setBooks] = useState([]);
  const [installedVersions, setInstalledVersions] = useState([]);
  const [catalogVersions, setCatalogVersions] = useState([]);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [installingVersionId, setInstallingVersionId] = useState("");
  const [installStage, setInstallStage] = useState("");
  const [removingVersionId, setRemovingVersionId] = useState("");
  const [book, setBook] = useState(null);
  const [chapter, setChapter] = useState(1);
  const [chapterCount, setChapterCount] = useState(1);
  const [verseCount, setVerseCount] = useState(1);
  const [parallelVerses, setParallelVerses] = useState([]);
  const [singleVersionVerses, setSingleVersionVerses] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [selectedVerse, setSelectedVerse] = useState(1);
  const [speechPlaying, setSpeechPlaying] = useState(false);
  const [speechMessage, setSpeechMessage] = useState("");
  const [bibleState, setBibleState] = useState(() => ({
    ...DEFAULT_BIBLE_STATE,
    bookmarks: [...DEFAULT_BIBLE_STATE.bookmarks],
    verseBookmarks: [...DEFAULT_BIBLE_STATE.verseBookmarks],
    highlights: [...DEFAULT_BIBLE_STATE.highlights],
    notes: { ...DEFAULT_BIBLE_STATE.notes },
    recent: [...DEFAULT_BIBLE_STATE.recent],
    preferences: { ...DEFAULT_BIBLE_STATE.preferences }
  }));
  const [fontScaleIndex, setFontScaleIndex] = useState(
    DEFAULT_BIBLE_STATE.preferences.fontScaleIndex
  );
  const [readingMode, setReadingMode] = useState(
    DEFAULT_BIBLE_STATE.preferences.readingMode
  );

  useEffect(() => {
    return () => {
      stopBibleSpeech().catch(() => {});
    };
  }, []);

  async function persistBibleState(nextState) {
    setBibleState(nextState);
    await saveBibleState(nextState);
  }

  async function syncInstalled(database, stateOverride) {
    const state = stateOverride || bibleState;
    const rows = await listInstalledBibleVersions(database);
    const installedIds = rows.map(item => item.id);
    setInstalledVersions(rows);

    const nextReadingMode =
      state.preferences.readingMode !== "parallel" &&
      !installedIds.includes(state.preferences.readingMode)
        ? "parallel"
        : state.preferences.readingMode;

    setReadingMode(nextReadingMode);

    const nextState = {
      ...state,
      preferences: {
        ...state.preferences,
        installedVersions: installedIds,
        readingMode: nextReadingMode,
        selectedVersionId:
          nextReadingMode === "parallel"
            ? state.preferences.selectedVersionId
            : nextReadingMode
      }
    };

    await persistBibleState(nextState);
    return rows;
  }

  useEffect(() => {
    let alive = true;

    Promise.all([openBibleDb(), loadBibleState()])
      .then(async ([database, savedState]) => {
        if (!alive) return;

        setDb(database);
        setBibleState(savedState);
        setFontScaleIndex(savedState.preferences.fontScaleIndex);
        setReadingMode(savedState.preferences.readingMode);

        const [nextBooks] = await Promise.all([
          getBooks(database),
          syncInstalled(database, savedState)
        ]);

        if (!alive) return;
        setBooks(nextBooks);
      })
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!db || !book) return;

    let alive = true;
    setChapterCount(0);
    setVerseCount(0);
    setParallelVerses([]);
    setSingleVersionVerses([]);

    getChapterCount(db, book.id).then(total => {
      if (!alive) return;
      setChapterCount(total);
    });

    return () => {
      alive = false;
    };
  }, [db, book?.id]);

  useEffect(() => {
    if (!db || !book) return;

    let alive = true;
    setVerseCount(0);
    setParallelVerses([]);
    setSingleVersionVerses([]);

    Promise.all([
      getVerseCount(db, book.id, chapter),
      getParallelVerses(db, book.id, chapter)
    ]).then(([count, rows]) => {
      if (!alive) return;
      setVerseCount(count);
      setParallelVerses(rows);
    });

    return () => {
      alive = false;
    };
  }, [db, book?.id, chapter]);

  useEffect(() => {
    if (selectedVerse <= verseCount || verseCount <= 0) return;
    setSelectedVerse(1);
  }, [selectedVerse, verseCount]);

  useEffect(() => {
    if (!db || !book || readingMode === "parallel") {
      setSingleVersionVerses([]);
      return;
    }

    let alive = true;
    getVersionChapterVerses(db, readingMode, book.id, chapter).then(rows => {
      if (!alive) return;
      setSingleVersionVerses(Array.isArray(rows) ? rows : []);
    });

    return () => {
      alive = false;
    };
  }, [db, book?.id, chapter, readingMode]);

  useEffect(() => {
    if (!db || !query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      searchBible(db, query).then(setResults);
    }, 250);

    return () => clearTimeout(timer);
  }, [db, query]);

  useEffect(() => {
    if (stage !== "library") return;

    let alive = true;
    setCatalogLoading(true);
    setCatalogError("");

    const timer = setTimeout(() => {
      listBibleVersions(catalogQuery)
        .then(response => {
          if (!alive) return;
          const installed = new Set(installedVersions.map(item => item.id));
          setCatalogVersions(
            (response?.versions || []).filter(item => !installed.has(item.id))
          );
        })
        .catch(error => {
          if (alive) {
            setCatalogVersions([]);
            setCatalogError(
              error instanceof Error ? error.message : "Unable to load Bible versions right now."
            );
          }
        })
        .finally(() => {
          if (alive) setCatalogLoading(false);
        });
    }, 250);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [stage, catalogQuery, installedVersions]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (stage === "library") {
        setStage("books");
        return true;
      }

      if (stage === "reader") {
        setStage("verses");
        return true;
      }

      if (stage === "verses") {
        setStage("chapters");
        return true;
      }

      if (stage === "chapters") {
        setStage("books");
        return true;
      }

      return false;
    });

    return () => sub.remove();
  }, [stage]);

  const visibleBooks = useMemo(() => {
    if (tab === "OT") return books.filter(b => b.testament === "OT");
    if (tab === "NT") return books.filter(b => b.testament === "NT");
    return books;
  }, [books, tab]);

  const favoriteRefs = useMemo(
    () => new Set(bibleState.bookmarks),
    [bibleState.bookmarks]
  );

  const verseBookmarkSet = useMemo(
    () => new Set(bibleState.verseBookmarks || []),
    [bibleState.verseBookmarks]
  );

  const verseHighlightSet = useMemo(
    () => new Set(bibleState.highlights || []),
    [bibleState.highlights]
  );

  const recentChapters = useMemo(
    () =>
      bibleState.recent
        .map(ref => {
          const [bookId, chapterValue] = ref.split(":");
          const nextBook = books.find(item => item.id === bookId);

          if (!nextBook) return null;

          return {
            ref,
            book: nextBook,
            chapter: Number(chapterValue || 1)
          };
        })
        .filter(Boolean),
    [bibleState.recent, books]
  );

  const bookmarkChapters = useMemo(
    () =>
      bibleState.bookmarks
        .map(ref => {
          const [bookId, chapterValue] = ref.split(":");
          const nextBook = books.find(item => item.id === bookId);

          if (!nextBook) return null;

          return {
            ref,
            book: nextBook,
            chapter: Number(chapterValue || 1)
          };
        })
        .filter(Boolean),
    [bibleState.bookmarks, books]
  );

  const viewModes = useMemo(() => {
    return [
      { key: "parallel", label: "Parallel" },
      ...installedVersions.map(version => ({
        key: version.id,
        label:
          version.id === ENGLISH
            ? "English"
            : version.id === SWAHILI
              ? "Kiswahili"
              : version.short_label || version.abbreviation || version.name
      }))
    ];
  }, [installedVersions]);

  const activeVersionMeta = useMemo(
    () => installedVersions.find(item => item.id === readingMode) || null,
    [installedVersions, readingMode]
  );

  const defaultVersionId = bibleState.preferences.selectedVersionId || DEFAULT_BIBLE_STATE.preferences.selectedVersionId;

  function openBook(nextBook) {
    setBook(nextBook);
    setChapter(1);
    setSelectedVerse(1);
    setChapterCount(0);
    setVerseCount(0);
    setParallelVerses([]);
    setSingleVersionVerses([]);
    setStage("chapters");
  }

  function openChapter(nextChapter) {
    setChapter(nextChapter);
    setSelectedVerse(1);
    setStage("verses");
  }

  async function rememberRecent(nextBook, nextChapter) {
    const nextRef = recentKey(nextBook.id, nextChapter);
    const nextState = {
      ...bibleState,
      recent: [nextRef, ...bibleState.recent.filter(ref => ref !== nextRef)].slice(0, 12)
    };

    await persistBibleState(nextState);
  }

  function openReader(nextVerse = 1) {
    setSelectedVerse(nextVerse);
    setStage("reader");
    if (book) {
      void rememberRecent(book, chapter);
    }
  }

  function openSavedChapter(nextBook, nextChapter) {
    setBook(nextBook);
    setChapter(nextChapter);
    setSelectedVerse(1);
    setStage("reader");
    void rememberRecent(nextBook, nextChapter);
  }

  const currentRef = book ? chapterRef(book.id, chapter) : "";
  const isFavorite = currentRef ? favoriteRefs.has(currentRef) : false;
  const currentVerseRef = book ? verseRef(book.id, chapter, selectedVerse) : "";
  const isVerseBookmarked = currentVerseRef ? verseBookmarkSet.has(currentVerseRef) : false;
  const isVerseHighlighted = currentVerseRef ? verseHighlightSet.has(currentVerseRef) : false;
  const selectedParallelVerse = parallelVerses.find(item => item.verse === selectedVerse) || null;
  const selectedSingleVerse = singleVersionVerses.find(item => item.verse === selectedVerse) || null;

  async function toggleFavorite() {
    if (!currentRef) return;

    const nextBookmarks = favoriteRefs.has(currentRef)
      ? bibleState.bookmarks.filter(ref => ref !== currentRef)
      : [...bibleState.bookmarks, currentRef];

    await persistBibleState({
      ...bibleState,
      bookmarks: nextBookmarks
    });
  }

  async function toggleVerseBookmark() {
    if (!currentVerseRef) return;

    const nextBookmarks = isVerseBookmarked
      ? (bibleState.verseBookmarks || []).filter(ref => ref !== currentVerseRef)
      : [...(bibleState.verseBookmarks || []), currentVerseRef];

    await persistBibleState({
      ...bibleState,
      verseBookmarks: nextBookmarks
    });
  }

  async function toggleVerseHighlight() {
    if (!currentVerseRef) return;

    const nextHighlights = isVerseHighlighted
      ? (bibleState.highlights || []).filter(ref => ref !== currentVerseRef)
      : [...(bibleState.highlights || []), currentVerseRef];

    await persistBibleState({
      ...bibleState,
      highlights: nextHighlights
    });
  }

  function selectVerse(verseNumber) {
    setSelectedVerse(verseNumber);
  }

  function textToReadForVersion(versionId, selectedOnly = false) {
    if (!book) return "";

    if (readingMode === "parallel") {
      if (versionId === SWAHILI) {
        if (selectedOnly) {
          return selectedParallelVerse
            ? `${book.swahili_name || book.english_name} ${chapter}:${selectedVerse}. ${selectedParallelVerse.swahili_text || ""}`
            : "";
        }

        return parallelVerses
          .map(item => `${item.verse}. ${item.swahili_text || ""}`)
          .join(" ");
      }

      if (selectedOnly) {
        return selectedParallelVerse
          ? `${book.english_name} ${chapter}:${selectedVerse}. ${selectedParallelVerse.english_text || ""}`
          : "";
      }

      return parallelVerses
        .map(item => `${item.verse}. ${item.english_text || ""}`)
        .join(" ");
    }

    const sourceVerse = selectedOnly
      ? selectedSingleVerse
      : null;

    if (selectedOnly) {
      return sourceVerse
        ? `${activeVersionMeta?.name || book.english_name} ${chapter}:${selectedVerse}. ${sourceVerse.text || ""}`
        : "";
    }

    return singleVersionVerses
      .map(item => `${item.verse}. ${item.text || ""}`)
      .join(" ");
  }

  function speakCurrentText(versionId, selectedOnly = false) {
    const text = textToReadForVersion(versionId, selectedOnly);
    if (!text.trim()) {
      Alert.alert("Bible Audio Reader", "No readable text is available for this selection.");
      return;
    }

    setSpeechMessage(selectedOnly ? "Reading selected verse..." : "Reading chapter...");
    speakBibleText({
      text,
      versionId,
      onStart: () => {
        setSpeechPlaying(true);
      },
      onDone: () => {
        setSpeechPlaying(false);
        setSpeechMessage("");
      },
      onStopped: () => {
        setSpeechPlaying(false);
        setSpeechMessage("");
      },
      onError: error => {
        setSpeechPlaying(false);
        setSpeechMessage("");
        Alert.alert(
          "Bible Audio Reader",
          error instanceof Error ? error.message : "Unable to read this Bible passage aloud."
        );
      }
    });
  }

  async function stopReading() {
    await stopBibleSpeech();
    setSpeechPlaying(false);
    setSpeechMessage("");
  }

  function cycleFontSize() {
    const nextIndex = (fontScaleIndex + 1) % FONT_SCALES.length;
    setFontScaleIndex(nextIndex);
    void persistBibleState({
      ...bibleState,
      preferences: {
        ...bibleState.preferences,
        fontScaleIndex: nextIndex,
        readingMode,
        selectedVersionId:
          readingMode === "parallel"
            ? bibleState.preferences.selectedVersionId
            : readingMode
      }
    });
  }

  function selectReadingMode(nextMode) {
    setReadingMode(nextMode);
    void persistBibleState({
      ...bibleState,
      preferences: {
        ...bibleState.preferences,
        fontScaleIndex,
        readingMode: nextMode,
        selectedVersionId:
          nextMode === "parallel"
            ? bibleState.preferences.selectedVersionId
            : nextMode
      }
    });
  }

  function openSearchResult(item) {
    const nextBook = books.find(b => b.id === item.book_id);
    if (!nextBook) return;

    setBook(nextBook);
    setChapter(item.chapter);
    setSelectedVerse(item.verse || 1);
    setQuery("");
    setResults([]);
    setShowSearch(false);
    setStage("reader");
    void rememberRecent(nextBook, item.chapter);
  }

  async function handleInstallVersion(version) {
    setInstallingVersionId(version.id);
    setInstallStage(tr(appLanguage, "Downloading package..."));

    try {
      setInstallStage(tr(appLanguage, "Installing offline text..."));
      const installed = await installBibleVersion(version);
      setInstallStage(tr(appLanguage, "Finalizing library..."));
      const nextState = {
        ...bibleState,
        preferences: {
          ...bibleState.preferences,
          readingMode: installed.id,
          selectedVersionId: installed.id
        }
      };
      await syncInstalled(db, nextState);
      setReadingMode(installed.id);
      Alert.alert("Bible Downloaded", `${installed.name} is now available offline.`);
    } catch (error) {
      Alert.alert(
        "Bible Download Failed",
        error instanceof Error ? error.message : "Unable to install this Bible version."
      );
    } finally {
      setInstallingVersionId("");
      setInstallStage("");
    }
  }

  async function handleRemoveVersion(versionId) {
    Alert.alert(
      tr(appLanguage, "Remove Bible Version"),
      tr(appLanguage, "This removes the downloaded version from this device. Bundled versions stay available offline."),
      [
        { text: tr(appLanguage, "Cancel"), style: "cancel" },
        {
          text: tr(appLanguage, "Remove"),
          style: "destructive",
          onPress: async () => {
            setRemovingVersionId(versionId);

            try {
              await removeBibleVersion(versionId);
              const nextState = {
                ...bibleState,
                preferences: {
                  ...bibleState.preferences,
                  readingMode:
                    bibleState.preferences.readingMode === versionId
                      ? "parallel"
                      : bibleState.preferences.readingMode
                }
              };
              await syncInstalled(db, nextState);
              Alert.alert("Removed", "The Bible version was removed from this device.");
            } catch (error) {
              Alert.alert(
                "Remove Failed",
                error instanceof Error ? error.message : "Unable to remove this Bible version."
              );
            } finally {
              setRemovingVersionId("");
            }
          }
        }
      ]
    );
  }

  async function setDefaultVersion(versionId) {
    const nextMode = versionId === "parallel" ? readingMode : versionId;
    if (versionId !== "parallel") {
      setReadingMode(versionId);
    }

    await persistBibleState({
      ...bibleState,
      preferences: {
        ...bibleState.preferences,
        readingMode: nextMode,
        selectedVersionId: versionId
      }
    });
  }

  const fontScale = FONT_SCALES[fontScaleIndex];

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.title}>Loading offline Bible...</Text>
        </View>
      </Screen>
    );
  }

  if (stage === "books") {
    return (
      <Screen>
        <Header
          title={tr(appLanguage, "Books")}
          onBack={() => go?.("Home")}
          right={
            <Pressable onPress={() => setStage("library")}>
              <Ionicons name="library-outline" size={28} color={C.text} />
            </Pressable>
          }
        />

        <View style={styles.tabs}>
          {[
            ["ALL", "ALL BOOKS"],
            ["OT", "OLD TESTAMENT"],
            ["NT", "NEW TESTAMENT"]
          ].map(([key, label]) => (
            <Pressable
              key={key}
              style={[styles.tab, tab === key && styles.tabActive]}
              onPress={() => setTab(key)}
            >
              <Text style={styles.tabText}>{tr(appLanguage, label)}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.page}>
          {visibleBooks.map(item => (
            <Pressable key={item.id} style={styles.bookCard} onPress={() => openBook(item)}>
              <Ionicons name="book" size={36} color={C.gold} />

              <View style={styles.bookMeta}>
                <Text style={styles.bookTitle}>
                  {item.swahili_name} ~ {item.english_name}
                </Text>
                <TestamentLabel value={item.testament} />
              </View>

              <Ionicons name="arrow-forward" size={34} color={C.muted} />
            </Pressable>
          ))}
        </ScrollView>
      </Screen>
    );
  }

  if (stage === "library") {
    return (
      <Screen>
        <Header
          title={tr(appLanguage, "Version Library")}
          subtitle={tr(appLanguage, "Offline bundled versions and saved chapters")}
          onBack={() => setStage("books")}
        />

        <ScrollView contentContainerStyle={styles.page}>
          <Text style={styles.sectionTitle}>{tr(appLanguage, "Installed Versions")}</Text>
          {installedVersions.map(version => {
            const removable = !BUNDLED_VERSION_IDS.includes(version.id);
            const isDefault = defaultVersionId === version.id;

            return (
              <View key={version.id} style={styles.versionCard}>
                <View style={styles.versionMeta}>
                  <Text style={styles.versionTitle}>{version.name}</Text>
                  <Text style={styles.muted}>{version.license || tr(appLanguage, "Bundled offline")}</Text>
                </View>

                <View style={{ alignItems: "flex-end", gap: 8 }}>
                  <Text style={styles.versionState}>
                    {isDefault ? tr(appLanguage, "Current Default") : tr(appLanguage, "Installed")}
                  </Text>
                  {!isDefault ? (
                    <Pressable onPress={() => setDefaultVersion(version.id)}>
                      <Text style={styles.versionAction}>{tr(appLanguage, "Set as Default")}</Text>
                    </Pressable>
                  ) : null}
                  {removable ? (
                    <Pressable disabled={removingVersionId === version.id} onPress={() => handleRemoveVersion(version.id)}>
                      <Text style={[styles.versionState, { color: C.red }]}>
                        {removingVersionId === version.id ? tr(appLanguage, "Removing...") : tr(appLanguage, "Remove")}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}

          <View style={styles.infoPanel}>
            <Text style={styles.infoTitle}>{tr(appLanguage, "Download More Versions")}</Text>
            <TextInput
              value={catalogQuery}
              onChangeText={setCatalogQuery}
              placeholder="Search language, tribe, or version..."
              placeholderTextColor={C.faint}
              style={[styles.searchInput, { marginBottom: 10 }]}
            />
            <Text style={styles.infoText}>
              Global provider catalog with offline install to this device.
            </Text>
            <Text style={styles.infoText}>
              Search examples: Kikuyu, Kisii, Gusii, Luo, Dholuo, Kamba, Swahili.
            </Text>
            {installingVersionId ? (
              <Text style={[styles.infoText, { color: C.text, marginTop: 8 }]}>
                {installStage || tr(appLanguage, "Preparing Bible download...")}
              </Text>
            ) : null}
            {catalogError ? (
              <Text style={[styles.infoText, { color: C.red, marginTop: 8 }]}>
                {catalogError}
              </Text>
            ) : null}
          </View>

          {catalogLoading ? (
            <Text style={styles.emptyText}>Loading available versions...</Text>
          ) : !catalogQuery.trim() ? (
            <Text style={styles.emptyText}>{tr(appLanguage, "Search for a language or version name to download it.")}</Text>
          ) : catalogVersions.length ? (
            catalogVersions.slice(0, 30).map(version => (
              <View key={version.id} style={styles.versionCard}>
                <View style={styles.versionMeta}>
                  <Text style={styles.versionTitle}>{version.name}</Text>
                  <Text style={styles.muted}>
                    {version.languageName || version.languageCode || version.provider}
                  </Text>
                </View>

                <Pressable disabled={installingVersionId === version.id} onPress={() => handleInstallVersion(version)}>
                  <Text style={styles.versionState}>
                    {installingVersionId === version.id
                      ? installStage || tr(appLanguage, "Installing offline text...")
                      : tr(appLanguage, "Download")}
                  </Text>
                </Pressable>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No additional versions found for that search.</Text>
          )}

          <Text style={styles.sectionTitle}>{tr(appLanguage, "Recent Chapters")}</Text>
          {recentChapters.length ? (
            recentChapters.map(item => (
              <Pressable
                key={item.ref}
                style={styles.savedChapterCard}
                onPress={() => openSavedChapter(item.book, item.chapter)}
              >
                <View style={styles.bookMeta}>
                  <Text style={styles.bookTitle}>
                    {item.book.swahili_name} ~ {item.book.english_name}
                  </Text>
                  <Text style={styles.muted}>{tr(appLanguage, "Chapter")} {item.chapter}</Text>
                </View>
                <Ionicons name="arrow-forward" size={26} color={C.muted} />
              </Pressable>
            ))
          ) : (
            <Text style={styles.emptyText}>{tr(appLanguage, "Your recent chapters will appear here.")}</Text>
          )}

          <Text style={styles.sectionTitle}>{tr(appLanguage, "Bookmarked Chapters")}</Text>
          {bookmarkChapters.length ? (
            bookmarkChapters.map(item => (
              <Pressable
                key={item.ref}
                style={styles.savedChapterCard}
                onPress={() => openSavedChapter(item.book, item.chapter)}
              >
                <View style={styles.bookMeta}>
                  <Text style={styles.bookTitle}>
                    {item.book.swahili_name} ~ {item.book.english_name}
                  </Text>
                  <Text style={styles.muted}>{tr(appLanguage, "Chapter")} {item.chapter}</Text>
                </View>
                <Ionicons name="heart" size={24} color={C.red} />
              </Pressable>
            ))
          ) : (
            <Text style={styles.emptyText}>{tr(appLanguage, "Saved chapters will appear here.")}</Text>
          )}
        </ScrollView>
      </Screen>
    );
  }

  if (stage === "chapters") {
    return (
      <Screen>
        <Header
          title={`${book?.swahili_name} ~ ${book?.english_name}`}
          onBack={() => setStage("books")}
          right={
            <Pressable onPress={() => setStage("library")}>
              <Ionicons name="library-outline" size={28} color={C.text} />
            </Pressable>
          }
        />

        <ScrollView contentContainerStyle={styles.page}>
          <Text style={styles.sectionTitle}>{tr(appLanguage, "Select a Chapter")}</Text>

          <View style={styles.grid}>
            {Array.from({ length: chapterCount }, (_, i) => i + 1).map(item => (
              <Pressable key={item} style={styles.gridCell} onPress={() => openChapter(item)}>
                <Text style={styles.gridNumber}>{item}.</Text>
                <Text style={styles.gridLabel}>{tr(appLanguage, "Chapter")}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </Screen>
    );
  }

  if (stage === "verses") {
    return (
      <Screen>
        <Header
          title={`${book?.swahili_name} ~ ${book?.english_name} : ${chapter}`}
          onBack={() => setStage("chapters")}
        />

        <ScrollView contentContainerStyle={styles.page}>
          <Text style={styles.sectionTitle}>{tr(appLanguage, "Select a Verse")}</Text>

          <View style={styles.grid}>
            {Array.from({ length: verseCount }, (_, i) => i + 1).map(item => (
              <Pressable key={item} style={styles.gridCell} onPress={() => openReader(item)}>
                <Text style={styles.gridNumber}>{item}.</Text>
                <Text style={styles.gridLabel}>{tr(appLanguage, "Verse")}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header
        title={`${book?.swahili_name} ~ ${book?.english_name} : ${chapter}`}
        onBack={() => setStage("verses")}
        right={
          <>
            <Pressable onPress={toggleFavorite}>
              <Ionicons
                name={isFavorite ? "heart" : "heart-outline"}
                size={30}
                color={isFavorite ? C.red : C.text}
              />
            </Pressable>

            <Pressable onPress={() => setShowSearch(v => !v)}>
              <Ionicons name="search" size={28} color={C.text} />
            </Pressable>

            <Pressable onPress={cycleFontSize}>
              <Text style={styles.fontIcon}>Tᵀ</Text>
            </Pressable>
          </>
        }
      />

      <ScrollView contentContainerStyle={styles.readerPage}>
        {showSearch && (
          <View style={styles.searchPanel}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search installed Bible versions..."
              placeholderTextColor={C.faint}
              style={styles.searchInput}
              autoFocus
            />

            {results.map(item => (
              <Pressable
                key={`${item.version_id}-${item.book_id}-${item.chapter}-${item.verse}`}
                style={styles.searchResult}
                onPress={() => openSearchResult(item)}
              >
                <Text style={styles.searchRef}>
                  {item.book_name} {item.chapter}:{item.verse}
                </Text>
                <Text style={styles.searchText}>{item.text}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.modeRow}>
          {viewModes.map(item => (
            <Pressable
              key={item.key}
              style={[styles.modePill, readingMode === item.key && styles.modePillActive]}
              onPress={() => selectReadingMode(item.key)}
            >
              <Text style={[styles.modeText, readingMode === item.key && styles.modeTextActive]}>
                {tr(appLanguage, item.label)}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.audioReaderCard}>
          <View style={styles.audioReaderHeader}>
            <Text style={styles.audioReaderTitle}>Audio Reader</Text>
            {speechPlaying || isBibleSpeechActive() ? (
              <Text style={styles.audioReaderMeta}>{speechMessage || "Reading..."}</Text>
            ) : (
              <Text style={styles.audioReaderMeta}>
                {readingMode === "parallel"
                  ? "Read English or Kiswahili aloud."
                  : "Read the current version aloud."}
              </Text>
            )}
          </View>

          <View style={styles.audioReaderActions}>
            {readingMode === "parallel" ? (
              <>
                <Pressable style={styles.audioReaderBtn} onPress={() => speakCurrentText(SWAHILI, false)}>
                  <Ionicons name="volume-high-outline" size={18} color={C.gold} />
                  <Text style={styles.audioReaderBtnText}>Read Kiswahili</Text>
                </Pressable>
                <Pressable style={styles.audioReaderBtn} onPress={() => speakCurrentText(ENGLISH, false)}>
                  <Ionicons name="volume-high-outline" size={18} color={C.gold} />
                  <Text style={styles.audioReaderBtnText}>Read English</Text>
                </Pressable>
              </>
            ) : (
              <Pressable style={styles.audioReaderBtn} onPress={() => speakCurrentText(readingMode, false)}>
                <Ionicons name="volume-high-outline" size={18} color={C.gold} />
                <Text style={styles.audioReaderBtnText}>Read Chapter</Text>
              </Pressable>
            )}

            <Pressable
              style={[styles.audioReaderBtn, !speechPlaying && styles.audioReaderBtnDisabled]}
              onPress={stopReading}
              disabled={!speechPlaying}
            >
              <Ionicons name="stop-outline" size={18} color={speechPlaying ? C.red : C.muted} />
              <Text style={[styles.audioReaderBtnText, { color: speechPlaying ? C.red : C.muted }]}>Stop</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.selectionCard}>
          <View style={styles.selectionHeader}>
            <Text style={styles.selectionTitle}>Selected Verse</Text>
            <Text style={styles.selectionMeta}>
              {book?.english_name} {chapter}:{selectedVerse}
            </Text>
          </View>

          <View style={styles.selectionActions}>
            <Pressable
              style={[styles.selectionBtn, isVerseBookmarked && styles.selectionBtnActive]}
              onPress={toggleVerseBookmark}
            >
              <Ionicons
                name={isVerseBookmarked ? "bookmark" : "bookmark-outline"}
                size={16}
                color={isVerseBookmarked ? C.textOnAccent : C.gold}
              />
              <Text
                style={[
                  styles.selectionBtnText,
                  isVerseBookmarked && styles.selectionBtnTextActive
                ]}
              >
                {isVerseBookmarked ? "Bookmarked" : "Bookmark"}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.selectionBtn, isVerseHighlighted && styles.selectionBtnActive]}
              onPress={toggleVerseHighlight}
            >
              <Ionicons
                name={isVerseHighlighted ? "color-fill" : "color-fill-outline"}
                size={16}
                color={isVerseHighlighted ? C.textOnAccent : C.gold}
              />
              <Text
                style={[
                  styles.selectionBtnText,
                  isVerseHighlighted && styles.selectionBtnTextActive
                ]}
              >
                {isVerseHighlighted ? "Highlighted" : "Highlight"}
              </Text>
            </Pressable>

            {readingMode === "parallel" ? (
              <>
                <Pressable style={styles.selectionBtn} onPress={() => speakCurrentText(SWAHILI, true)}>
                  <Ionicons name="volume-medium-outline" size={16} color={C.gold} />
                  <Text style={styles.selectionBtnText}>Read SW</Text>
                </Pressable>
                <Pressable style={styles.selectionBtn} onPress={() => speakCurrentText(ENGLISH, true)}>
                  <Ionicons name="volume-medium-outline" size={16} color={C.gold} />
                  <Text style={styles.selectionBtnText}>Read EN</Text>
                </Pressable>
              </>
            ) : (
              <Pressable style={styles.selectionBtn} onPress={() => speakCurrentText(readingMode, true)}>
                <Ionicons name="volume-medium-outline" size={16} color={C.gold} />
                <Text style={styles.selectionBtnText}>Read Verse</Text>
              </Pressable>
            )}
          </View>
        </View>

        {readingMode === "parallel" ? (
          <>
            <View style={styles.readerLabels}>
              <Text style={styles.readerLabel}>{tr(appLanguage, "Kiswahili")}</Text>
              <Text style={styles.readerLabel}>{tr(appLanguage, "English")}</Text>
            </View>

            <View style={styles.parallel}>
              {parallelVerses.map(item => {
                const nextRef = verseRef(book?.id, chapter, item.verse);
                const selected = selectedVerse === item.verse;
                const highlighted = verseHighlightSet.has(nextRef);
                const bookmarked = verseBookmarkSet.has(nextRef);

                return (
                  <Pressable
                    key={`parallel-${item.verse}`}
                    style={[
                      styles.parallelVerseRow,
                      selected && styles.parallelVerseRowSelected,
                      highlighted && styles.parallelVerseRowHighlighted
                    ]}
                    onPress={() => selectVerse(item.verse)}
                  >
                    <View style={styles.parallelVerseTop}>
                      <Text style={styles.parallelVerseNo}>{item.verse}</Text>
                      <View style={styles.parallelVerseBadges}>
                        {highlighted ? <Ionicons name="color-fill" size={14} color={C.gold} /> : null}
                        {bookmarked ? <Ionicons name="bookmark" size={14} color={C.gold} /> : null}
                      </View>
                    </View>

                    <View style={styles.parallelVerseColumns}>
                      <Text
                        style={[
                          styles.parallelVerseText,
                          { fontSize: 22 * fontScale, lineHeight: 34 * fontScale }
                        ]}
                      >
                        {item.swahili_text}
                      </Text>

                      <Text
                        style={[
                          styles.parallelVerseText,
                          { fontSize: 22 * fontScale, lineHeight: 34 * fontScale }
                        ]}
                      >
                        {item.english_text}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <View style={styles.singleColumn}>
            <Text style={styles.chapterHeading}>
              {activeVersionMeta?.name || book?.english_name}
            </Text>
            {singleVersionVerses.map(item => (
              <Pressable
                key={`${readingMode}-${item.verse}`}
                style={[
                  styles.singleVerseRow,
                  selectedVerse === item.verse && styles.singleVerseRowSelected,
                  verseHighlightSet.has(verseRef(book?.id, chapter, item.verse)) &&
                    styles.singleVerseRowHighlighted
                ]}
                onPress={() => selectVerse(item.verse)}
              >
                <View style={styles.parallelVerseTop}>
                  <Text style={styles.parallelVerseNo}>{item.verse}</Text>
                  <View style={styles.parallelVerseBadges}>
                    {verseHighlightSet.has(verseRef(book?.id, chapter, item.verse)) ? (
                      <Ionicons name="color-fill" size={14} color={C.gold} />
                    ) : null}
                    {verseBookmarkSet.has(verseRef(book?.id, chapter, item.verse)) ? (
                      <Ionicons name="bookmark" size={14} color={C.gold} />
                    ) : null}
                  </View>
                </View>

                <Text
                  style={[
                    styles.verseText,
                    { fontSize: 28 * fontScale, lineHeight: 44 * fontScale }
                  ]}
                >
                  {item.text}
                </Text>
              </Pressable>
            ))}
            {!singleVersionVerses.length ? (
              <Text style={styles.emptyText}>No verses are available for this version in the selected chapter.</Text>
            ) : null}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = makeThemedStyles(C => ({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  header: {
    minHeight: 86 + ANDROID_STATUS_BAR_HEIGHT,
    paddingHorizontal: 18,
    paddingTop: ANDROID_STATUS_BAR_HEIGHT + 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  iconBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.surface2,
    alignItems: "center",
    justifyContent: "center"
  },
  iconGhost: {
    width: 52
  },
  headerTitleWrap: {
    flex: 1
  },
  headerTitle: {
    color: C.text,
    fontSize: 24,
    fontWeight: "900"
  },
  headerSubtitle: {
    color: C.muted,
    fontSize: 13,
    marginTop: 3
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: C.blue
  },
  tab: {
    flex: 1,
    paddingVertical: 17,
    alignItems: "center",
    borderBottomWidth: 4,
    borderBottomColor: "transparent"
  },
  tabActive: {
    borderBottomColor: C.gold
  },
  tabText: {
    color: C.textOnBrand,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.2
  },
  page: {
    padding: 16,
    paddingBottom: 120
  },
  bookCard: {
    minHeight: 104,
    paddingHorizontal: 18,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    backgroundColor: C.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 18
  },
  bookMeta: {
    flex: 1
  },
  bookTitle: {
    color: C.text,
    fontSize: 21,
    fontWeight: "700"
  },
  muted: {
    color: C.muted,
    fontSize: 16,
    marginTop: 8
  },
  sectionTitle: {
    color: C.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 28
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14
  },
  gridCell: {
    width: "22%",
    minHeight: 86,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    backgroundColor: C.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  gridNumber: {
    color: C.text,
    fontSize: 28,
    fontWeight: "900"
  },
  gridLabel: {
    color: C.muted,
    fontSize: 14,
    marginTop: 6
  },
  readerPage: {
    paddingHorizontal: 14,
    paddingBottom: 120
  },
  modeRow: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 16,
    marginBottom: 18,
    flexWrap: "wrap"
  },
  modePill: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.backgroundElevated
  },
  modePillActive: {
    borderColor: C.gold,
    backgroundColor: C.surface2
  },
  modeText: {
    color: C.muted,
    fontSize: 14,
    fontWeight: "800"
  },
  modeTextActive: {
    color: C.gold
  },
  audioReaderCard: {
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
    gap: 12
  },
  audioReaderHeader: {
    gap: 4
  },
  audioReaderTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: "900"
  },
  audioReaderMeta: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 19
  },
  audioReaderActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  audioReaderBtn: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.backgroundElevated,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  audioReaderBtnDisabled: {
    opacity: 0.55
  },
  audioReaderBtnText: {
    color: C.text,
    fontSize: 13,
    fontWeight: "800"
  },
  selectionCard: {
    marginBottom: 18,
    padding: 14,
    borderRadius: 12,
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.line,
    gap: 12
  },
  selectionHeader: {
    gap: 4
  },
  selectionTitle: {
    color: C.text,
    fontSize: 15,
    fontWeight: "900"
  },
  selectionMeta: {
    color: C.muted,
    fontSize: 13
  },
  selectionActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  selectionBtn: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  selectionBtnActive: {
    backgroundColor: C.gold,
    borderColor: C.gold
  },
  selectionBtnText: {
    color: C.text,
    fontSize: 13,
    fontWeight: "800"
  },
  selectionBtnTextActive: {
    color: C.textOnAccent
  },
  readerLabels: {
    flexDirection: "row",
    marginBottom: 20
  },
  readerLabel: {
    flex: 1,
    color: C.text,
    fontSize: 20,
    fontWeight: "900"
  },
  parallel: {
    gap: 16
  },
  singleColumn: {
    paddingBottom: 12
  },
  chapterHeading: {
    color: C.gold,
    fontSize: 32,
    fontWeight: "900",
    marginBottom: 24
  },
  verseText: {
    color: C.text,
    fontSize: 26,
    lineHeight: 42,
    fontWeight: "600",
    marginBottom: 0
  },
  verseNo: {
    color: C.green,
    fontSize: 17,
    fontWeight: "900"
  },
  parallelVerseRow: {
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    gap: 12
  },
  parallelVerseRowSelected: {
    borderColor: C.gold,
    shadowColor: C.gold,
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  parallelVerseRowHighlighted: {
    backgroundColor: C.surface2
  },
  parallelVerseTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  parallelVerseNo: {
    color: C.gold,
    fontSize: 16,
    fontWeight: "900"
  },
  parallelVerseBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  parallelVerseColumns: {
    flexDirection: "row",
    gap: 18
  },
  parallelVerseText: {
    flex: 1,
    color: C.text,
    fontWeight: "600"
  },
  singleVerseRow: {
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginBottom: 12
  },
  singleVerseRowSelected: {
    borderColor: C.gold,
    shadowColor: C.gold,
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  singleVerseRowHighlighted: {
    backgroundColor: C.surface2
  },
  fontIcon: {
    color: C.text,
    fontSize: 27,
    fontWeight: "900"
  },
  title: {
    color: C.text,
    fontSize: 20,
    fontWeight: "800"
  },
  searchPanel: {
    marginTop: 14,
    marginBottom: 18,
    padding: 14,
    borderRadius: 12,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line
  },
  searchInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: C.text,
    fontSize: 16,
    marginBottom: 12
  },
  searchResult: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.line
  },
  searchRef: {
    color: C.gold,
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 4
  },
  searchText: {
    color: C.text,
    fontSize: 15,
    lineHeight: 22
  },
  versionCard: {
    minHeight: 86,
    paddingHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    backgroundColor: C.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16
  },
  versionMeta: {
    flex: 1
  },
  versionTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: "800"
  },
  versionState: {
    color: C.gold,
    fontSize: 14,
    fontWeight: "900"
  },
  versionAction: {
    color: C.text,
    fontSize: 13,
    fontWeight: "800"
  },
  infoPanel: {
    marginBottom: 28,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.blue,
    backgroundColor: C.surface2
  },
  infoTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 8
  },
  infoText: {
    color: C.muted,
    fontSize: 14,
    lineHeight: 22
  },
  savedChapterCard: {
    minHeight: 86,
    paddingHorizontal: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    backgroundColor: C.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 16
  },
  emptyText: {
    color: C.muted,
    fontSize: 15,
    marginBottom: 26
  }
}));
