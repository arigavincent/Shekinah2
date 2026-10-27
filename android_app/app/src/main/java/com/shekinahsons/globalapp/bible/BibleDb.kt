package com.shekinahsons.globalapp.bible

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import java.io.File

data class BibleVersion(val id: String, val name: String, val label: String, val abbreviation: String, val language: String, val license: String)
data class Book(val id: Int, val code: String, val testament: String, val english: String, val swahili: String)
data class Verse(val number: Int, val text: String)
data class Hit(val versionId: String, val bookId: Int, val chapter: Int, val verse: Int, val text: String)

// The offline Bible: the database shipped with the app (Majority Standard
// Bible and Neno Kiswahili) plus any versions downloaded later, all in one
// SQLite file in the app's private storage.
class BibleDb private constructor(context: Context) {
    companion object {
        const val ENGLISH = "eng_msb"
        const val SWAHILI = "swh_neno"
        private const val SHIPPED = 1
        @Volatile private var instance: BibleDb? = null
        fun get(context: Context) = instance ?: synchronized(this) { instance ?: BibleDb(context.applicationContext).also { instance = it } }
    }

    val db: SQLiteDatabase

    init {
        val file = File(context.filesDir, "bible.db")
        val prefs = context.getSharedPreferences("bible", Context.MODE_PRIVATE)
        if (!file.exists() || prefs.getInt("shipped", 0) < SHIPPED) {
            context.assets.open("bible.db").use { input -> file.outputStream().use { input.copyTo(it) } }
            prefs.edit().putInt("shipped", SHIPPED).apply()
        }
        db = SQLiteDatabase.openDatabase(file.path, null, SQLiteDatabase.OPEN_READWRITE)
    }

    // Catalogue codes look like "ENG-KJV2006"; readers know it as "KJV".
    private fun shortCode(code: String) = code.substringAfter('-').replace(Regex("\\d{4}$"), "").ifBlank { code }

    fun versions(): List<BibleVersion> = db.rawQuery("SELECT id, name, short_label, abbreviation, language_code, license FROM versions ORDER BY id = '$ENGLISH' DESC, id = '$SWAHILI' DESC, name", null).use { c ->
        buildList { while (c.moveToNext()) add(BibleVersion(c.getString(0), c.getString(1), c.getString(2), shortCode(c.getString(3)), c.getString(4), c.getString(5))) }
    }

    private var bookCache: List<Book>? = null
    fun books(): List<Book> = bookCache ?: db.rawQuery(
        """SELECT b.id, b.code, b.testament,
               COALESCE((SELECT name FROM book_labels WHERE book_id = b.id AND version_id = '$ENGLISH'), b.code),
               COALESCE((SELECT name FROM book_labels WHERE book_id = b.id AND version_id = '$SWAHILI'), b.code)
           FROM books b ORDER BY b.sort_order""", null,
    ).use { c -> buildList { while (c.moveToNext()) add(Book(c.getInt(0), c.getString(1), c.getString(2), c.getString(3), c.getString(4))) } }.also { bookCache = it }

    fun book(id: Int) = books().firstOrNull { it.id == id }

    // Finds a book from a written reference ("1 John", "Matthew", "Mathayo").
    fun findBook(name: String): Book? {
        val n = name.trim().lowercase().replace(".", "")
        return books().firstOrNull { it.english.lowercase() == n || it.swahili.lowercase() == n || it.code.lowercase() == n }
            ?: books().firstOrNull { it.english.lowercase().startsWith(n) || it.swahili.lowercase().startsWith(n) }
    }

    fun chapterCount(bookId: Int): Int = db.rawQuery("SELECT MAX(chapter) FROM verses WHERE book_id = ? AND version_id = ?", arrayOf("$bookId", ENGLISH)).use { if (it.moveToFirst()) it.getInt(0) else 1 }.coerceAtLeast(1)

    fun verseCount(bookId: Int, chapter: Int): Int = db.rawQuery("SELECT MAX(verse) FROM verses WHERE book_id = ? AND chapter = ? AND version_id = ?", arrayOf("$bookId", "$chapter", ENGLISH)).use { if (it.moveToFirst()) it.getInt(0) else 1 }.coerceAtLeast(1)

    fun chapter(versionId: String, bookId: Int, chapter: Int): List<Verse> = db.rawQuery(
        "SELECT verse, text FROM verses WHERE version_id = ? AND book_id = ? AND chapter = ? ORDER BY verse", arrayOf(versionId, "$bookId", "$chapter"),
    ).use { c -> buildList { while (c.moveToNext()) add(Verse(c.getInt(0), c.getString(1))) } }

    fun verse(versionId: String, bookId: Int, chapter: Int, verse: Int): String? = db.rawQuery(
        "SELECT text FROM verses WHERE version_id = ? AND book_id = ? AND chapter = ? AND verse = ?", arrayOf(versionId, "$bookId", "$chapter", "$verse"),
    ).use { if (it.moveToFirst()) it.getString(0) else null }

    fun search(query: String, limit: Int = 80): List<Hit> {
        if (query.trim().length < 3) return emptyList()
        return db.rawQuery(
            "SELECT version_id, book_id, chapter, verse, text FROM verses WHERE text LIKE ? ORDER BY book_id, chapter, verse LIMIT $limit",
            arrayOf("%${query.trim()}%"),
        ).use { c -> buildList { while (c.moveToNext()) add(Hit(c.getString(0), c.getInt(1), c.getInt(2), c.getInt(3), c.getString(4))) } }
    }

    // Adds a version downloaded from eBible.org (VPL: "GEN 1:1 text" per line).
    fun installVpl(version: BibleVersion, lines: Sequence<String>) {
        val codes = books().associate { it.code to it.id }
        val pattern = Regex("""^([1-4A-Z]{3})\s+(\d+):(\d+)\s+(.*)$""")
        db.beginTransaction()
        try {
            db.delete("verses", "version_id = ?", arrayOf(version.id))
            db.insertWithOnConflict("versions", null, ContentValues().apply {
                put("id", version.id); put("name", version.name); put("short_label", version.label)
                put("abbreviation", version.abbreviation); put("language_code", version.language); put("license", version.license); put("attribution", "eBible.org")
            }, SQLiteDatabase.CONFLICT_REPLACE)
            val insert = db.compileStatement("INSERT OR REPLACE INTO verses (version_id, book_id, chapter, verse, text) VALUES (?, ?, ?, ?, ?)")
            for (line in lines) {
                val m = pattern.find(line.trim()) ?: continue
                val bookId = codes[m.groupValues[1]] ?: continue
                insert.bindString(1, version.id); insert.bindLong(2, bookId.toLong())
                insert.bindLong(3, m.groupValues[2].toLong()); insert.bindLong(4, m.groupValues[3].toLong()); insert.bindString(5, m.groupValues[4].trim())
                insert.executeInsert()
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    fun remove(versionId: String) {
        if (versionId == ENGLISH || versionId == SWAHILI) return
        db.delete("verses", "version_id = ?", arrayOf(versionId))
        db.delete("versions", "id = ?", arrayOf(versionId))
    }
}
