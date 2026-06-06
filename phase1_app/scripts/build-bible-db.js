const { existsSync, mkdirSync, readFileSync, rmSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const BOOKS = [
  { id: 1, code: 'GEN', testament: 'OT', englishName: 'Genesis', swahiliName: 'Mwanzo' },
  { id: 2, code: 'EXO', testament: 'OT', englishName: 'Exodus', swahiliName: 'Kutoka' },
  { id: 3, code: 'LEV', testament: 'OT', englishName: 'Leviticus', swahiliName: 'Walawi' },
  { id: 4, code: 'NUM', testament: 'OT', englishName: 'Numbers', swahiliName: 'Hesabu' },
  { id: 5, code: 'DEU', testament: 'OT', englishName: 'Deuteronomy', swahiliName: 'Kumbukumbu la Torati' },
  { id: 6, code: 'JOS', testament: 'OT', englishName: 'Joshua', swahiliName: 'Yoshua' },
  { id: 7, code: 'JDG', testament: 'OT', englishName: 'Judges', swahiliName: 'Waamuzi' },
  { id: 8, code: 'RUT', testament: 'OT', englishName: 'Ruth', swahiliName: 'Ruthu' },
  { id: 9, code: '1SA', testament: 'OT', englishName: '1 Samuel', swahiliName: '1 Samweli' },
  { id: 10, code: '2SA', testament: 'OT', englishName: '2 Samuel', swahiliName: '2 Samweli' },
  { id: 11, code: '1KI', testament: 'OT', englishName: '1 Kings', swahiliName: '1 Wafalme' },
  { id: 12, code: '2KI', testament: 'OT', englishName: '2 Kings', swahiliName: '2 Wafalme' },
  { id: 13, code: '1CH', testament: 'OT', englishName: '1 Chronicles', swahiliName: '1 Mambo ya Nyakati' },
  { id: 14, code: '2CH', testament: 'OT', englishName: '2 Chronicles', swahiliName: '2 Mambo ya Nyakati' },
  { id: 15, code: 'EZR', testament: 'OT', englishName: 'Ezra', swahiliName: 'Ezra' },
  { id: 16, code: 'NEH', testament: 'OT', englishName: 'Nehemiah', swahiliName: 'Nehemia' },
  { id: 17, code: 'EST', testament: 'OT', englishName: 'Esther', swahiliName: 'Esta' },
  { id: 18, code: 'JOB', testament: 'OT', englishName: 'Job', swahiliName: 'Ayubu' },
  { id: 19, code: 'PSA', testament: 'OT', englishName: 'Psalms', swahiliName: 'Zaburi' },
  { id: 20, code: 'PRO', testament: 'OT', englishName: 'Proverbs', swahiliName: 'Mithali' },
  { id: 21, code: 'ECC', testament: 'OT', englishName: 'Ecclesiastes', swahiliName: 'Mhubiri' },
  { id: 22, code: 'SNG', testament: 'OT', englishName: 'Song of Songs', swahiliName: 'Wimbo Ulio Bora' },
  { id: 23, code: 'ISA', testament: 'OT', englishName: 'Isaiah', swahiliName: 'Isaya' },
  { id: 24, code: 'JER', testament: 'OT', englishName: 'Jeremiah', swahiliName: 'Yeremia' },
  { id: 25, code: 'LAM', testament: 'OT', englishName: 'Lamentations', swahiliName: 'Maombolezo' },
  { id: 26, code: 'EZK', testament: 'OT', englishName: 'Ezekiel', swahiliName: 'Ezekieli' },
  { id: 27, code: 'DAN', testament: 'OT', englishName: 'Daniel', swahiliName: 'Danieli' },
  { id: 28, code: 'HOS', testament: 'OT', englishName: 'Hosea', swahiliName: 'Hosea' },
  { id: 29, code: 'JOL', testament: 'OT', englishName: 'Joel', swahiliName: 'Yoeli' },
  { id: 30, code: 'AMO', testament: 'OT', englishName: 'Amos', swahiliName: 'Amosi' },
  { id: 31, code: 'OBA', testament: 'OT', englishName: 'Obadiah', swahiliName: 'Obadia' },
  { id: 32, code: 'JON', testament: 'OT', englishName: 'Jonah', swahiliName: 'Yona' },
  { id: 33, code: 'MIC', testament: 'OT', englishName: 'Micah', swahiliName: 'Mika' },
  { id: 34, code: 'NAM', testament: 'OT', englishName: 'Nahum', swahiliName: 'Nahumu' },
  { id: 35, code: 'HAB', testament: 'OT', englishName: 'Habakkuk', swahiliName: 'Habakuki' },
  { id: 36, code: 'ZEP', testament: 'OT', englishName: 'Zephaniah', swahiliName: 'Sefania' },
  { id: 37, code: 'HAG', testament: 'OT', englishName: 'Haggai', swahiliName: 'Hagai' },
  { id: 38, code: 'ZEC', testament: 'OT', englishName: 'Zechariah', swahiliName: 'Zekaria' },
  { id: 39, code: 'MAL', testament: 'OT', englishName: 'Malachi', swahiliName: 'Malaki' },
  { id: 40, code: 'MAT', testament: 'NT', englishName: 'Matthew', swahiliName: 'Mathayo' },
  { id: 41, code: 'MRK', testament: 'NT', englishName: 'Mark', swahiliName: 'Marko' },
  { id: 42, code: 'LUK', testament: 'NT', englishName: 'Luke', swahiliName: 'Luka' },
  { id: 43, code: 'JHN', testament: 'NT', englishName: 'John', swahiliName: 'Yohana' },
  { id: 44, code: 'ACT', testament: 'NT', englishName: 'Acts', swahiliName: 'Matendo' },
  { id: 45, code: 'ROM', testament: 'NT', englishName: 'Romans', swahiliName: 'Warumi' },
  { id: 46, code: '1CO', testament: 'NT', englishName: '1 Corinthians', swahiliName: '1 Wakorintho' },
  { id: 47, code: '2CO', testament: 'NT', englishName: '2 Corinthians', swahiliName: '2 Wakorintho' },
  { id: 48, code: 'GAL', testament: 'NT', englishName: 'Galatians', swahiliName: 'Wagalatia' },
  { id: 49, code: 'EPH', testament: 'NT', englishName: 'Ephesians', swahiliName: 'Waefeso' },
  { id: 50, code: 'PHP', testament: 'NT', englishName: 'Philippians', swahiliName: 'Wafilipi' },
  { id: 51, code: 'COL', testament: 'NT', englishName: 'Colossians', swahiliName: 'Wakolosai' },
  { id: 52, code: '1TH', testament: 'NT', englishName: '1 Thessalonians', swahiliName: '1 Wathesalonike' },
  { id: 53, code: '2TH', testament: 'NT', englishName: '2 Thessalonians', swahiliName: '2 Wathesalonike' },
  { id: 54, code: '1TI', testament: 'NT', englishName: '1 Timothy', swahiliName: '1 Timotheo' },
  { id: 55, code: '2TI', testament: 'NT', englishName: '2 Timothy', swahiliName: '2 Timotheo' },
  { id: 56, code: 'TIT', testament: 'NT', englishName: 'Titus', swahiliName: 'Tito' },
  { id: 57, code: 'PHM', testament: 'NT', englishName: 'Philemon', swahiliName: 'Filemoni' },
  { id: 58, code: 'HEB', testament: 'NT', englishName: 'Hebrews', swahiliName: 'Waebrania' },
  { id: 59, code: 'JAS', testament: 'NT', englishName: 'James', swahiliName: 'Yakobo' },
  { id: 60, code: '1PE', testament: 'NT', englishName: '1 Peter', swahiliName: '1 Petro' },
  { id: 61, code: '2PE', testament: 'NT', englishName: '2 Peter', swahiliName: '2 Petro' },
  { id: 62, code: '1JN', testament: 'NT', englishName: '1 John', swahiliName: '1 Yohana' },
  { id: 63, code: '2JN', testament: 'NT', englishName: '2 John', swahiliName: '2 Yohana' },
  { id: 64, code: '3JN', testament: 'NT', englishName: '3 John', swahiliName: '3 Yohana' },
  { id: 65, code: 'JUD', testament: 'NT', englishName: 'Jude', swahiliName: 'Yuda' },
  { id: 66, code: 'REV', testament: 'NT', englishName: 'Revelation', swahiliName: 'Ufunuo wa Yohana' },
];

const VERSIONS = [
  {
    id: 'eng_msb',
    name: 'Majority Standard Bible',
    shortLabel: 'English',
    abbreviation: 'MSB',
    languageCode: 'en',
    license: 'Public Domain',
    attribution: 'Translation by Berean Bible Translation Committee. Text from eBible.org.',
    sourceFile: 'engmsb_vpl.sql',
  },
  {
    id: 'swh_neno',
    name: 'Open Kiswahili Contemporary Version (Neno)',
    shortLabel: 'Kiswahili',
    abbreviation: 'NENO',
    languageCode: 'sw',
    license: 'CC BY-SA 4.0',
    attribution: 'Copyright 1984, 1989, 2009, 2015 Biblica, Inc. Shared via eBible.org.',
    sourceFile: 'swhonen_vpl.sql',
  },
];

const BOOKS_BY_CODE = new Map(BOOKS.map((book) => [book.code, book]));
const ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'tmp', 'bible-source');
const OUTPUT_DIR = path.join(ROOT, 'assets', 'bible');
const OUTPUT_DB = path.join(OUTPUT_DIR, 'bible.db');

function escapeSql(value) {
  return String(value ?? '').replace(/'/g, "''");
}

function parseInsertLine(line) {
  if (!line.startsWith('INSERT INTO ')) {
    return null;
  }

  const openIndex = line.indexOf('("');
  if (openIndex === -1 || !line.endsWith('");')) {
    throw new Error(`Unexpected SQL row format: ${line.slice(0, 120)}`);
  }

  const raw = line.slice(openIndex + 2, -3);
  const parts = raw.split('","');

  if (parts.length !== 7) {
    throw new Error(`Expected 7 fields, received ${parts.length}`);
  }

  const bookCode = parts[2];
  const chapter = Number.parseInt(parts[3], 10);
  const verse = Number.parseInt(parts[4], 10);
  const text = parts[6].trim();

  if (!BOOKS_BY_CODE.has(bookCode)) {
    throw new Error(`Unknown book code encountered: ${bookCode}`);
  }

  if (!Number.isFinite(chapter) || !Number.isFinite(verse)) {
    throw new Error(`Invalid chapter/verse for ${bookCode}: ${parts[3]}:${parts[4]}`);
  }

  return {
    bookCode,
    chapter,
    verse,
    text,
  };
}

function parseVersionRows(version) {
  const sourcePath = path.join(SOURCE_DIR, version.sourceFile);
  const contents = readFileSync(sourcePath, 'utf8');
  const rows = [];

  for (const line of contents.split(/\r?\n/)) {
    const row = parseInsertLine(line);
    if (row) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    throw new Error(`No verse rows found in ${version.sourceFile}`);
  }

  return rows;
}

function buildSql() {
  const statements = [
    'PRAGMA journal_mode = OFF;',
    'PRAGMA synchronous = OFF;',
    'PRAGMA temp_store = MEMORY;',
    'DROP TABLE IF EXISTS versions;',
    'DROP TABLE IF EXISTS books;',
    'DROP TABLE IF EXISTS book_labels;',
    'DROP TABLE IF EXISTS verses;',
    'CREATE TABLE versions (id TEXT PRIMARY KEY, name TEXT NOT NULL, short_label TEXT NOT NULL, abbreviation TEXT NOT NULL, language_code TEXT NOT NULL, license TEXT NOT NULL, attribution TEXT NOT NULL);',
    'CREATE TABLE books (id INTEGER PRIMARY KEY, code TEXT NOT NULL UNIQUE, testament TEXT NOT NULL, sort_order INTEGER NOT NULL UNIQUE);',
    'CREATE TABLE book_labels (version_id TEXT NOT NULL, book_id INTEGER NOT NULL, name TEXT NOT NULL, PRIMARY KEY (version_id, book_id));',
    'CREATE TABLE verses (version_id TEXT NOT NULL, book_id INTEGER NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL, text TEXT NOT NULL, PRIMARY KEY (version_id, book_id, chapter, verse));',
    'BEGIN;',
  ];

  for (const version of VERSIONS) {
    statements.push(
      `INSERT INTO versions (id, name, short_label, abbreviation, language_code, license, attribution) VALUES ('${escapeSql(version.id)}', '${escapeSql(version.name)}', '${escapeSql(version.shortLabel)}', '${escapeSql(version.abbreviation)}', '${escapeSql(version.languageCode)}', '${escapeSql(version.license)}', '${escapeSql(version.attribution)}');`
    );
  }

  for (const book of BOOKS) {
    statements.push(
      `INSERT INTO books (id, code, testament, sort_order) VALUES (${book.id}, '${escapeSql(book.code)}', '${escapeSql(book.testament)}', ${book.id});`
    );
    statements.push(
      `INSERT INTO book_labels (version_id, book_id, name) VALUES ('eng_msb', ${book.id}, '${escapeSql(book.englishName)}');`
    );
    statements.push(
      `INSERT INTO book_labels (version_id, book_id, name) VALUES ('swh_neno', ${book.id}, '${escapeSql(book.swahiliName)}');`
    );
  }

  for (const version of VERSIONS) {
    const rows = parseVersionRows(version);
    for (const row of rows) {
      const book = BOOKS_BY_CODE.get(row.bookCode);
      statements.push(
        `INSERT INTO verses (version_id, book_id, chapter, verse, text) VALUES ('${version.id}', ${book.id}, ${row.chapter}, ${row.verse}, '${escapeSql(row.text)}');`
      );
    }
  }

  statements.push(
    'COMMIT;',
    'CREATE INDEX idx_verses_reference ON verses(version_id, book_id, chapter, verse);',
    'CREATE INDEX idx_verses_chapter ON verses(book_id, chapter);',
    'VACUUM;'
  );

  return statements.join('\n');
}

function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  if (existsSync(OUTPUT_DB)) {
    rmSync(OUTPUT_DB);
  }

  const sql = buildSql();
  const result = spawnSync('sqlite3', [OUTPUT_DB], {
    input: sql,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || 'sqlite3 failed to build bible.db');
  }

  const verify = spawnSync(
    'sqlite3',
    [OUTPUT_DB, "SELECT (SELECT COUNT(*) FROM books), (SELECT COUNT(*) FROM versions), (SELECT COUNT(*) FROM verses);"],
    { encoding: 'utf8' }
  );

  if (verify.status !== 0) {
    throw new Error(verify.stderr || 'sqlite3 failed to verify bible.db');
  }

  const [bookCount, versionCount, verseCount] = String(verify.stdout || '')
    .trim()
    .split('|');

  console.log(`Built ${OUTPUT_DB}`);
  console.log(`Books: ${bookCount} | Versions: ${versionCount} | Verses: ${verseCount}`);
}

main();
