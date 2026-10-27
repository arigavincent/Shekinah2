package com.shekinahsons.globalapp.bible

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class Place(val bookId: Int, val chapter: Int)

@Serializable
data class BibleState(
    // Reading: one version, or two side by side.
    val sideBySide: Boolean = true,
    val left: String = BibleDb.SWAHILI,
    val right: String = BibleDb.ENGLISH,
    val single: String = BibleDb.ENGLISH,
    val textScale: Float = 1f,
    val last: Place? = null,
    val recent: List<Place> = emptyList(),
    val favourites: List<Place> = emptyList(),
    // "book:chapter:verse" -> colour name
    val highlights: Map<String, String> = emptyMap(),
    val bookmarks: List<String> = emptyList(),
    val notes: Map<String, String> = emptyMap(),
)

fun ref(bookId: Int, chapter: Int, verse: Int) = "$bookId:$chapter:$verse"

// The reader's own marks and settings, kept on the phone.
class BibleStore(context: Context) {
    private val prefs = context.getSharedPreferences("bible-state", Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }

    var state: BibleState = runCatching { json.decodeFromString<BibleState>(prefs.getString("state", "") ?: "") }.getOrDefault(BibleState())
        private set
    var version by mutableIntStateOf(0)
        private set

    fun update(change: (BibleState) -> BibleState) {
        state = change(state)
        prefs.edit().putString("state", json.encodeToString(BibleState.serializer(), state)).apply()
        version++
    }

    fun visit(bookId: Int, chapter: Int) = update { s ->
        val p = Place(bookId, chapter)
        s.copy(last = p, recent = (listOf(p) + s.recent.filter { it != p }).take(12))
    }
}
