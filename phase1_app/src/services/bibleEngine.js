import verses from "../data/bible/kjv-verses.json";

export const BIBLE_VERSION = "KJV";

export const CANONICAL_BOOKS = [
  "Genesis",
  "Exodus",
  "Leviticus",
  "Numbers",
  "Deuteronomy",
  "Joshua",
  "Judges",
  "Ruth",
  "1 Samuel",
  "2 Samuel",
  "1 Kings",
  "2 Kings",
  "1 Chronicles",
  "2 Chronicles",
  "Ezra",
  "Nehemiah",
  "Esther",
  "Job",
  "Psalms",
  "Proverbs",
  "Ecclesiastes",
  "Song of Solomon",
  "Isaiah",
  "Jeremiah",
  "Lamentations",
  "Ezekiel",
  "Daniel",
  "Hosea",
  "Joel",
  "Amos",
  "Obadiah",
  "Jonah",
  "Micah",
  "Nahum",
  "Habakkuk",
  "Zephaniah",
  "Haggai",
  "Zechariah",
  "Malachi",
  "Matthew",
  "Mark",
  "Luke",
  "John",
  "Acts",
  "Romans",
  "1 Corinthians",
  "2 Corinthians",
  "Galatians",
  "Ephesians",
  "Philippians",
  "Colossians",
  "1 Thessalonians",
  "2 Thessalonians",
  "1 Timothy",
  "2 Timothy",
  "Titus",
  "Philemon",
  "Hebrews",
  "James",
  "1 Peter",
  "2 Peter",
  "1 John",
  "2 John",
  "3 John",
  "Jude",
  "Revelation"
];

function normalizeVerseText(text) {
  return String(text || "")
    .replace(/^#\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseBibleReference(reference) {
  const match = String(reference || "").trim().match(/^(.+)\s+(\d+):(\d+)$/);

  if (!match) return null;

  return {
    reference: match[0],
    book: match[1],
    chapter: Number(match[2]),
    verse: Number(match[3])
  };
}

export const BIBLE_VERSES = Object.entries(verses)
  .map(([reference, text]) => {
    const parsed = parseBibleReference(reference);

    if (!parsed) return null;

    return {
      ...parsed,
      text: normalizeVerseText(text)
    };
  })
  .filter(Boolean);

const bookMap = new Map();

for (const verse of BIBLE_VERSES) {
  if (!bookMap.has(verse.book)) {
    bookMap.set(verse.book, new Map());
  }

  const chapterMap = bookMap.get(verse.book);

  if (!chapterMap.has(verse.chapter)) {
    chapterMap.set(verse.chapter, []);
  }

  chapterMap.get(verse.chapter).push(verse);
}

const discoveredBooks = Array.from(bookMap.keys());

export const BOOKS = [
  ...CANONICAL_BOOKS.filter(book => bookMap.has(book)),
  ...discoveredBooks.filter(book => !CANONICAL_BOOKS.includes(book))
];

export function getBooks() {
  return BOOKS;
}

export function getChapters(book) {
  const chapterMap = bookMap.get(book);

  if (!chapterMap) return [];

  return Array.from(chapterMap.keys()).sort((a, b) => a - b);
}

export function getChapterVerses(book, chapter) {
  const chapterMap = bookMap.get(book);

  if (!chapterMap) return [];

  return [...(chapterMap.get(Number(chapter)) || [])].sort((a, b) => a.verse - b.verse);
}

export function getVerse(reference) {
  const parsed = parseBibleReference(reference);

  if (!parsed) return null;

  return (
    getChapterVerses(parsed.book, parsed.chapter)
      .find(item => item.verse === parsed.verse) || null
  );
}

export function getDefaultReference() {
  return {
    book: "Psalms",
    chapter: 27
  };
}

export function getBookTestament(book) {
  const index = BOOKS.indexOf(book);
  const matthewIndex = BOOKS.indexOf("Matthew");

  if (index < 0) return "Unknown";

  return index >= matthewIndex ? "New Testament" : "Old Testament";
}

export function searchBible(query, limit = 80) {
  const q = String(query || "").trim().toLowerCase();

  if (q.length < 2) return [];

  const exact = getVerse(query);

  if (exact) return [exact];

  const results = [];

  for (const verse of BIBLE_VERSES) {
    if (
      verse.reference.toLowerCase().includes(q) ||
      verse.text.toLowerCase().includes(q)
    ) {
      results.push(verse);

      if (results.length >= limit) break;
    }
  }

  return results;
}

export function nextChapter(book, chapter) {
  const chapters = getChapters(book);
  const currentChapter = Number(chapter);
  const chapterIndex = chapters.indexOf(currentChapter);

  if (chapterIndex >= 0 && chapterIndex < chapters.length - 1) {
    return {
      book,
      chapter: chapters[chapterIndex + 1]
    };
  }

  const bookIndex = BOOKS.indexOf(book);
  const nextBook = BOOKS[bookIndex + 1];

  if (!nextBook) return null;

  return {
    book: nextBook,
    chapter: getChapters(nextBook)[0]
  };
}

export function previousChapter(book, chapter) {
  const chapters = getChapters(book);
  const currentChapter = Number(chapter);
  const chapterIndex = chapters.indexOf(currentChapter);

  if (chapterIndex > 0) {
    return {
      book,
      chapter: chapters[chapterIndex - 1]
    };
  }

  const bookIndex = BOOKS.indexOf(book);
  const previousBook = BOOKS[bookIndex - 1];

  if (!previousBook) return null;

  const previousChapters = getChapters(previousBook);

  return {
    book: previousBook,
    chapter: previousChapters[previousChapters.length - 1]
  };
}

export function formatVerseShare(verse) {
  return `${verse.reference}\n${verse.text}\n\n${BIBLE_VERSION}`;
}
