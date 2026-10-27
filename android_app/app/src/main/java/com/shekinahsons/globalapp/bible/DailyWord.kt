package com.shekinahsons.globalapp.bible

import android.content.Context
import java.util.Calendar

data class DailyVerse(val text: String, val reference: String, val bookId: Int, val chapter: Int, val verse: Int)

// A new verse of the day every morning, the same for every member: picked
// by the date from a list of well-loved verses and read from the offline Bible.
object DailyWord {
    private val picks = listOf(
        "PSA 27 1", "JHN 3 16", "JER 29 11", "PRO 3 5", "ISA 40 31", "PHP 4 13", "ROM 8 28", "PSA 23 1", "JOS 1 9", "MAT 11 28",
        "LAM 3 22", "PSA 46 1", "ISA 41 10", "2CO 5 17", "GAL 2 20", "EPH 2 8", "HEB 11 1", "JAS 1 5", "1PE 5 7", "1JN 4 19",
        "PSA 119 105", "PRO 18 10", "ISA 26 3", "MAT 6 33", "JHN 14 27", "ROM 12 2", "PHP 4 6", "COL 3 23", "2TI 1 7", "HEB 13 8",
        "PSA 37 4", "PSA 91 1", "PSA 121 1", "ISA 43 2", "ZEP 3 17", "MIC 6 8", "MAT 5 14", "JHN 15 5", "ROM 15 13", "1CO 13 4",
        "2CO 12 9", "GAL 5 22", "EPH 3 20", "PHP 1 6", "COL 3 2", "1TH 5 16", "HEB 4 16", "JAS 4 8", "1PE 2 9", "REV 21 4",
        "PSA 34 8", "PSA 51 10", "PSA 103 2", "PSA 139 14", "PRO 16 3", "ISA 9 6", "ISA 54 17", "JER 33 3", "JOL 2 25", "HAB 3 19",
        "MAT 28 20", "MRK 11 24", "LUK 1 37", "JHN 8 32", "JHN 10 10", "ACT 1 8", "ROM 5 8", "ROM 10 9", "1CO 2 9", "2CO 4 18",
        "DEU 31 6", "NUM 6 24", "2CH 7 14", "NEH 8 10", "PSA 16 11", "PSA 18 2", "PSA 62 1", "PSA 84 11", "PSA 100 4", "PRO 4 23",
    )

    fun today(context: Context): DailyVerse? {
        val bible = BibleDb.get(context)
        val day = Calendar.getInstance().let { it.get(Calendar.YEAR) * 400 + it.get(Calendar.DAY_OF_YEAR) }
        for (i in picks.indices) {
            val (code, ch, v) = picks[(day + i) % picks.size].split(" ")
            val book = bible.books().firstOrNull { it.code == code } ?: continue
            val text = bible.verse(BibleDb.ENGLISH, book.id, ch.toInt(), v.toInt()) ?: continue
            return DailyVerse(text, "${book.english} $ch:$v", book.id, ch.toInt(), v.toInt())
        }
        return null
    }
}
