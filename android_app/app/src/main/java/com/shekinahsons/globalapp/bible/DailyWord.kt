package com.shekinahsons.globalapp.bible

import android.content.Context
import java.time.LocalDateTime

data class DailyVerse(val text: String, val reference: String, val bookId: Int, val chapter: Int, val verse: Int)

// The verse of the day (and the greeting's verse), read from the offline Bible.
// A new day starts at 7 AM wherever the phone is. If the church chose topics in
// the admin (e.g. Faith and Healing for a series), the verses come from those.
object DailyWord {
    data class Topic(val id: String, val label: String, val verses: List<String>)

    val topics = listOf(
        Topic("faith", "Faith", listOf("HEB 11 1", "HEB 11 6", "ROM 10 17", "MRK 11 24", "2CO 5 7", "MAT 17 20", "EPH 2 8", "GAL 2 20", "JAS 2 17", "1JN 5 4", "PRO 3 5", "MRK 9 23", "ROM 1 17")),
        Topic("hope", "Hope", listOf("JER 29 11", "ROM 15 13", "ROM 5 5", "ROM 8 28", "LAM 3 22", "LAM 3 25", "PSA 42 11", "PSA 62 5", "HEB 6 19", "ISA 40 31", "1PE 1 3", "PSA 147 11", "PRO 23 18")),
        Topic("love", "Love", listOf("JHN 3 16", "1JN 4 19", "1JN 4 8", "ROM 5 8", "ROM 8 38", "1CO 13 4", "1CO 13 13", "JHN 15 13", "EPH 3 18", "ZEP 3 17", "1JN 3 1", "JHN 13 34", "COL 3 14")),
        Topic("peace", "Peace", listOf("JHN 14 27", "PHP 4 7", "ISA 26 3", "PSA 4 8", "NUM 6 24", "COL 3 15", "ROM 5 1", "JHN 16 33", "PSA 29 11", "ISA 9 6", "MAT 11 28", "2TH 3 16", "PSA 46 10")),
        Topic("strength", "Strength", listOf("PHP 4 13", "ISA 41 10", "ISA 40 31", "JOS 1 9", "NEH 8 10", "PSA 46 1", "2CO 12 9", "DEU 31 6", "PSA 18 2", "PSA 28 7", "EPH 6 10", "HAB 3 19", "PSA 73 26")),
        Topic("healing", "Healing", listOf("JER 17 14", "ISA 53 5", "PSA 103 2", "PSA 103 3", "EXO 15 26", "JAS 5 15", "PSA 147 3", "JER 30 17", "MAT 4 23", "3JN 1 2", "MAL 4 2", "PSA 30 2", "1PE 2 24")),
        Topic("provision", "Provision", listOf("PHP 4 19", "MAT 6 33", "PSA 23 1", "PSA 34 10", "2CO 9 8", "MAL 3 10", "DEU 8 18", "PSA 37 25", "MAT 6 26", "PSA 84 11", "LUK 6 38", "PRO 3 9", "GEN 22 14")),
        Topic("prayer", "Prayer", listOf("JER 33 3", "PHP 4 6", "MAT 7 7", "1TH 5 17", "JAS 5 16", "MRK 11 24", "1JN 5 14", "MAT 6 6", "PSA 145 18", "2CH 7 14", "ROM 8 26", "HEB 4 16", "PSA 55 22")),
        Topic("salvation", "Salvation", listOf("ROM 10 9", "JHN 3 16", "EPH 2 8", "ACT 4 12", "JHN 14 6", "ROM 6 23", "2CO 5 17", "TIT 3 5", "JHN 1 12", "1JN 1 9", "ROM 5 8", "ISA 1 18", "REV 3 20")),
        Topic("guidance", "Guidance", listOf("PRO 3 5", "PRO 3 6", "PSA 32 8", "PSA 119 105", "ISA 30 21", "JAS 1 5", "PRO 16 3", "PSA 37 23", "PSA 25 4", "PRO 16 9", "JHN 16 13", "ISA 58 11", "PSA 143 8")),
        Topic("thanksgiving", "Thanksgiving", listOf("1TH 5 18", "PSA 100 4", "PSA 107 1", "PSA 118 24", "COL 3 17", "PSA 9 1", "PSA 136 1", "EPH 5 20", "PHP 4 6", "PSA 103 2", "PSA 34 1", "HEB 13 15", "1CH 16 34")),
        Topic("holyspirit", "Holy Spirit", listOf("ACT 1 8", "JHN 14 26", "ROM 8 26", "GAL 5 22", "ACT 2 4", "ROM 8 14", "1CO 6 19", "JHN 16 13", "EZK 36 27", "ROM 15 13", "EPH 5 18", "2TI 1 7", "ZEC 4 6")),
    )

    // The day for verses: it turns over at 7 AM local time.
    fun dayKey(now: LocalDateTime = LocalDateTime.now()): Long = now.minusHours(7).toLocalDate().toEpochDay()

    private fun prefs(context: Context) = context.getSharedPreferences("daily-word", Context.MODE_PRIVATE)

    // The topics the church chose (empty = all), saved for offline use.
    fun chosenTopics(context: Context): List<String> = prefs(context).getString("topics", "").orEmpty().split(",").filter { it.isNotBlank() }

    fun saveTopics(context: Context, topics: List<String>) = prefs(context).edit().putString("topics", topics.joinToString(",")).apply()

    private fun pool(context: Context): List<String> {
        val chosen = chosenTopics(context)
        val use = topics.filter { chosen.isEmpty() || it.id in chosen }.ifEmpty { topics }
        return use.flatMap { it.verses }.distinct()
    }

    // slot 0: the Verse of the Day card; slot 1: the line under the greeting.
    fun today(context: Context, slot: Int = 0, day: Long = dayKey()): DailyVerse? {
        val bible = BibleDb.get(context)
        val picks = pool(context)
        if (picks.isEmpty()) return null
        // Spread consecutive days across the list so neighbouring days differ.
        val start = ((day * 7919 + slot * 104729) % picks.size).toInt().let { if (it < 0) it + picks.size else it }
        val books = bible.books()
        for (i in picks.indices) {
            val (code, ch, v) = picks[(start + i) % picks.size].split(" ")
            val book = books.firstOrNull { it.code == code } ?: continue
            val text = bible.verse(BibleDb.ENGLISH, book.id, ch.toInt(), v.toInt()) ?: continue
            return DailyVerse(text, "${book.english} $ch:$v", book.id, ch.toInt(), v.toInt())
        }
        return null
    }
}
