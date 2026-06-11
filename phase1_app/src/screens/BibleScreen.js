import React, { useEffect, useMemo, useState } from "react";
import { BackHandler, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { openDatabaseAsync } from "expo-sqlite";
import * as FileSystem from "expo-file-system/legacy";
import { Asset } from "expo-asset";

import { Screen } from "../components/Screen";
import { s } from "../styles/appStyles";
import {
  DEFAULT_BIBLE_STATE,
  loadBibleState,
  saveBibleState
} from "../services/bibleStorage";

const DB_NAME = "bible.db";
const DB_ASSET = require("../../assets/bible/bible.db");

const ENGLISH = "eng_msb";
const SWAHILI = "swh_neno";
const FONT_SCALES = [0.85, 1, 1.15, 1.3];
const VIEW_MODES = [
  { key: "parallel", label: "Parallel" },
  { key: SWAHILI, label: "Kiswahili" },
  { key: ENGLISH, label: "English" }
];
const BUNDLED_VERSIONS = [
  { id: ENGLISH, name: "English (KJV style)", source: "Bundled offline" },
  { id: SWAHILI, name: "Kiswahili", source: "Bundled offline" }
];

function chapterRef(bookId, chapter) {
  return `${bookId}:${chapter}`;
}

function recentKey(bookId, chapter) {
  return `${bookId}:${chapter}`;
}

async function ensureBibleDb() {
  const dir = `${FileSystem.documentDirectory}SQLite`;
  const target = `${dir}/${DB_NAME}`;

  const info = await FileSystem.getInfoAsync(target);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

    const asset = Asset.fromModule(DB_ASSET);
    await asset.downloadAsync();

    await FileSystem.copyAsync({
      from: asset.localUri || asset.uri,
      to: target
    });
  }
}

async function openBibleDb() {
  await ensureBibleDb();
  return openDatabaseAsync(DB_NAME);
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
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable style={styles.iconBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </Pressable>
      ) : (
        <View style={styles.iconGhost} />
      )}

      <View style={styles.headerTitleWrap}>
        <Text style={styles.headerTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
      </View>

      <View style={styles.headerRight}>{right}</View>
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

export function BibleScreen({ go }) {
  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState("books");
  const [tab, setTab] = useState("ALL");
  const [books, setBooks] = useState([]);
  const [book, setBook] = useState(null);
  const [chapter, setChapter] = useState(1);
  const [chapterCount, setChapterCount] = useState(1);
  const [verseCount, setVerseCount] = useState(1);
  const [verses, setVerses] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);
  const [bibleState, setBibleState] = useState(() => ({
    ...DEFAULT_BIBLE_STATE,
    bookmarks: [...DEFAULT_BIBLE_STATE.bookmarks],
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
    let alive = true;

    Promise.all([openBibleDb(), loadBibleState()])
      .then(async ([database, savedState]) => {
        if (!alive) return;
        setDb(database);
        setBibleState(savedState);
        setFontScaleIndex(savedState.preferences.fontScaleIndex);
        setReadingMode(savedState.preferences.readingMode);

        const rows = await getBooks(database);
        if (!alive) return;
        setBooks(rows);
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
    setVerses([]);

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
    setVerses([]);

    Promise.all([
      getVerseCount(db, book.id, chapter),
      getParallelVerses(db, book.id, chapter)
    ]).then(([count, rows]) => {
      if (!alive) return;
      setVerseCount(count);
      setVerses(rows);
    });

    return () => {
      alive = false;
    };
  }, [db, book?.id, chapter]);

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

  function openBook(nextBook) {
    setBook(nextBook);
    setChapter(1);
    setChapterCount(0);
    setVerseCount(0);
    setVerses([]);
    setStage("chapters");
  }

  function openChapter(nextChapter) {
    setChapter(nextChapter);
    setStage("verses");
  }

  async function persistBibleState(nextState) {
    setBibleState(nextState);
    await saveBibleState(nextState);
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
    setStage("reader");
    if (book) {
      void rememberRecent(book, chapter);
    }
    setTimeout(() => {}, nextVerse);
  }

  function openSavedChapter(nextBook, nextChapter) {
    setBook(nextBook);
    setChapter(nextChapter);
    setStage("reader");
    void rememberRecent(nextBook, nextChapter);
  }

  const currentRef = book ? chapterRef(book.id, chapter) : "";
  const isFavorite = currentRef ? favoriteRefs.has(currentRef) : false;

  async function toggleFavorite() {
    if (!currentRef) return;

    const nextBookmarks = favoriteRefs.has(currentRef)
      ? bibleState.bookmarks.filter(ref => ref !== currentRef)
      : [...bibleState.bookmarks, currentRef];
    const nextState = {
      ...bibleState,
      bookmarks: nextBookmarks
    };

    await persistBibleState(nextState);
  }

  function cycleFontSize() {
    const nextIndex = (fontScaleIndex + 1) % FONT_SCALES.length;
    setFontScaleIndex(nextIndex);
    void persistBibleState({
      ...bibleState,
      preferences: {
        ...bibleState.preferences,
        fontScaleIndex: nextIndex,
        readingMode
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
        readingMode: nextMode
      }
    });
  }

  function openSearchResult(item) {
    const nextBook = books.find(b => b.id === item.book_id);
    if (!nextBook) return;

    setBook(nextBook);
    setChapter(item.chapter);
    setQuery("");
    setResults([]);
    setShowSearch(false);
    setStage("reader");
    void rememberRecent(nextBook, item.chapter);
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
          title="Books"
          onBack={() => go?.("Home")}
          right={
            <Pressable onPress={() => setStage("library")}>
              <Ionicons name="library-outline" size={28} color="#fff" />
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
              <Text style={styles.tabText}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView contentContainerStyle={styles.page}>
          {visibleBooks.map(item => (
            <Pressable
              key={item.id}
              style={styles.bookCard}
              onPress={() => openBook(item)}
            >
              <Ionicons name="book" size={36} color="#b2223a" />

              <View style={styles.bookMeta}>
                <Text style={styles.bookTitle}>
                  {item.swahili_name} ~ {item.english_name}
                </Text>
                <TestamentLabel value={item.testament} />
              </View>

              <Ionicons name="arrow-forward" size={34} color="#777" />
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
          title="Version Library"
          subtitle="Offline bundled versions and saved chapters"
          onBack={() => setStage("books")}
        />

        <ScrollView contentContainerStyle={styles.page}>
          <Text style={styles.sectionTitle}>Installed Versions</Text>
          {BUNDLED_VERSIONS.map(version => {
            const installed = bibleState.preferences.installedVersions.includes(version.id);

            return (
              <View key={version.id} style={styles.versionCard}>
                <View style={styles.versionMeta}>
                  <Text style={styles.versionTitle}>{version.name}</Text>
                  <Text style={styles.muted}>{version.source}</Text>
                </View>
                <Text style={styles.versionState}>
                  {installed ? "Installed" : "Unavailable"}
                </Text>
              </View>
            );
          })}

          <View style={styles.infoPanel}>
            <Text style={styles.infoTitle}>Download More Versions</Text>
            <Text style={styles.infoText}>
              Additional Bible versions need a configured source and licensing feed.
              The reader is ready for them, but this build ships with English and
              Kiswahili offline.
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Recent Chapters</Text>
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
                  <Text style={styles.muted}>Chapter {item.chapter}</Text>
                </View>
                <Ionicons name="arrow-forward" size={26} color="#777" />
              </Pressable>
            ))
          ) : (
            <Text style={styles.emptyText}>Your recent chapters will appear here.</Text>
          )}

          <Text style={styles.sectionTitle}>Bookmarked Chapters</Text>
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
                  <Text style={styles.muted}>Chapter {item.chapter}</Text>
                </View>
                <Ionicons name="heart" size={24} color="#ff5a5f" />
              </Pressable>
            ))
          ) : (
            <Text style={styles.emptyText}>Saved chapters will appear here.</Text>
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
              <Ionicons name="library-outline" size={28} color="#fff" />
            </Pressable>
          }
        />

        <ScrollView contentContainerStyle={styles.page}>
          <Text style={styles.sectionTitle}>Select a Chapter</Text>

          <View style={styles.grid}>
            {Array.from({ length: chapterCount }, (_, i) => i + 1).map(item => (
              <Pressable
                key={item}
                style={styles.gridCell}
                onPress={() => openChapter(item)}
              >
                <Text style={styles.gridNumber}>{item}.</Text>
                <Text style={styles.gridLabel}>Chapter</Text>
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
          <Text style={styles.sectionTitle}>Select a Verse</Text>

          <View style={styles.grid}>
            {Array.from({ length: verseCount }, (_, i) => i + 1).map(item => (
              <Pressable
                key={item}
                style={styles.gridCell}
                onPress={() => openReader(item)}
              >
                <Text style={styles.gridNumber}>{item}.</Text>
                <Text style={styles.gridLabel}>Verse</Text>
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
                color={isFavorite ? "#ff5a5f" : "#fff"}
              />
            </Pressable>

            <Pressable onPress={() => setShowSearch(v => !v)}>
              <Ionicons name="search" size={28} color="#fff" />
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
              placeholder="Search English or Kiswahili..."
              placeholderTextColor="#888"
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
          {VIEW_MODES.map(item => (
            <Pressable
              key={item.key}
              style={[styles.modePill, readingMode === item.key && styles.modePillActive]}
              onPress={() => selectReadingMode(item.key)}
            >
              <Text
                style={[
                  styles.modeText,
                  readingMode === item.key && styles.modeTextActive
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {readingMode === "parallel" ? (
          <>
            <View style={styles.readerLabels}>
              <Text style={styles.readerLabel}>Kiswahili</Text>
              <Text style={styles.readerLabel}>English</Text>
            </View>

            <View style={styles.parallel}>
              <View style={styles.column}>
                <Text style={styles.chapterHeading}>{book?.swahili_name}</Text>
                {verses.map(item => (
                  <Text
                    key={`sw-${item.verse}`}
                    style={[
                      styles.verseText,
                      { fontSize: 26 * fontScale, lineHeight: 42 * fontScale }
                    ]}
                  >
                    <Text style={styles.verseNo}>{item.verse} </Text>
                    {item.swahili_text}
                  </Text>
                ))}
              </View>

              <View style={styles.column}>
                {verses.map(item => (
                  <Text
                    key={`en-${item.verse}`}
                    style={[
                      styles.verseText,
                      { fontSize: 26 * fontScale, lineHeight: 42 * fontScale }
                    ]}
                  >
                    <Text style={styles.verseNo}>{item.verse} </Text>
                    {item.english_text}
                  </Text>
                ))}
              </View>
            </View>
          </>
        ) : (
          <View style={styles.singleColumn}>
            <Text style={styles.chapterHeading}>
              {readingMode === SWAHILI ? book?.swahili_name : book?.english_name}
            </Text>
            {verses.map(item => (
              <Text
                key={`${readingMode}-${item.verse}`}
                style={[
                  styles.verseText,
                  { fontSize: 28 * fontScale, lineHeight: 44 * fontScale }
                ]}
              >
                <Text style={styles.verseNo}>{item.verse} </Text>
                {readingMode === SWAHILI ? item.swahili_text : item.english_text}
              </Text>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = {
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  header: {
    minHeight: 76,
    paddingHorizontal: 18,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center"
  },
  iconGhost: {
    width: 44
  },
  headerTitleWrap: {
    flex: 1
  },
  headerTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900"
  },
  headerSubtitle: {
    color: "#999",
    fontSize: 13,
    marginTop: 3
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#2d3699"
  },
  tab: {
    flex: 1,
    paddingVertical: 17,
    alignItems: "center",
    borderBottomWidth: 4,
    borderBottomColor: "transparent"
  },
  tabActive: {
    borderBottomColor: "#ff6b35"
  },
  tabText: {
    color: "#fff",
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
    borderColor: "#444",
    borderRadius: 8,
    backgroundColor: "#191919",
    flexDirection: "row",
    alignItems: "center",
    gap: 18
  },
  bookMeta: {
    flex: 1
  },
  bookTitle: {
    color: "#f4f4f4",
    fontSize: 21,
    fontWeight: "700"
  },
  muted: {
    color: "#888",
    fontSize: 16,
    marginTop: 8
  },
  sectionTitle: {
    color: "#ddd",
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
    borderColor: "#3d2b2b",
    borderRadius: 8,
    backgroundColor: "#1d1d1d",
    alignItems: "center",
    justifyContent: "center"
  },
  gridNumber: {
    color: "#d7d3df",
    fontSize: 28,
    fontWeight: "900"
  },
  gridLabel: {
    color: "#888",
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
    borderColor: "#444",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111"
  },
  modePillActive: {
    borderColor: "#f4c542",
    backgroundColor: "#2a2312"
  },
  modeText: {
    color: "#bbb",
    fontSize: 14,
    fontWeight: "800"
  },
  modeTextActive: {
    color: "#f4c542"
  },
  readerLabels: {
    flexDirection: "row",
    marginBottom: 20
  },
  readerLabel: {
    flex: 1,
    color: "#cfcbd8",
    fontSize: 20,
    fontWeight: "900"
  },
  parallel: {
    flexDirection: "row",
    gap: 24
  },
  singleColumn: {
    paddingBottom: 12
  },
  column: {
    flex: 1
  },
  chapterHeading: {
    color: "#ff5a5f",
    fontSize: 32,
    fontWeight: "900",
    marginBottom: 24
  },
  verseText: {
    color: "#d7d3df",
    fontSize: 26,
    lineHeight: 42,
    fontWeight: "600",
    marginBottom: 26
  },
  verseNo: {
    color: "#4caf63",
    fontSize: 17,
    fontWeight: "900"
  },
  fontIcon: {
    color: "#fff",
    fontSize: 27,
    fontWeight: "900"
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800"
  },
  searchPanel: {
    marginTop: 14,
    marginBottom: 18,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#171717",
    borderWidth: 1,
    borderColor: "#333"
  },
  searchInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 10,
    paddingHorizontal: 12,
    color: "#fff",
    fontSize: 16,
    marginBottom: 12
  },
  searchResult: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#333"
  },
  searchRef: {
    color: "#f4c542",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 4
  },
  searchText: {
    color: "#ddd",
    fontSize: 15,
    lineHeight: 22
  },
  versionCard: {
    minHeight: 86,
    paddingHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 10,
    backgroundColor: "#141414",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16
  },
  versionMeta: {
    flex: 1
  },
  versionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800"
  },
  versionState: {
    color: "#f4c542",
    fontSize: 14,
    fontWeight: "900"
  },
  infoPanel: {
    marginBottom: 28,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2d3699",
    backgroundColor: "#11162f"
  },
  infoTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 8
  },
  infoText: {
    color: "#c6cee8",
    fontSize: 14,
    lineHeight: 22
  },
  savedChapterCard: {
    minHeight: 86,
    paddingHorizontal: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 10,
    backgroundColor: "#141414",
    flexDirection: "row",
    alignItems: "center",
    gap: 16
  },
  emptyText: {
    color: "#888",
    fontSize: 15,
    marginBottom: 26
  }
};
