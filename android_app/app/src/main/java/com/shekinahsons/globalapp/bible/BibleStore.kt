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
    // Reading font (see BibleFonts); Roboto unless the reader picks another.
    val font: String = "roboto",
    // Set once the reader has been moved to the BSB as the main English Bible.
    val bsbDefault: Boolean = false,
)

fun ref(bookId: Int, chapter: Int, verse: Int) = "$bookId:$chapter:$verse"

// The reader's own marks and settings, kept on the phone.
class BibleStore(context: Context) {
    private val prefs = com.shekinahsons.globalapp.data.Accounts.prefs(context,"bible-state")
    private val json = Json { ignoreUnknownKeys = true }

    var state: BibleState = runCatching { json.decodeFromString<BibleState>(prefs.getString("state", "") ?: "") }.getOrDefault(BibleState())
        private set
    var version by mutableIntStateOf(0)
        private set

    init {
        // The BSB replaces the MSB as the main English Bible (once; a reader can switch back).
        if (!state.bsbDefault) update { s ->
            s.copy(
                single = if (s.single == BibleDb.MSB) BibleDb.ENGLISH else s.single,
                right = if (s.right == BibleDb.MSB) BibleDb.ENGLISH else s.right,
                left = if (s.left == BibleDb.MSB) BibleDb.ENGLISH else s.left,
                bsbDefault = true,
            )
        }
    }

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
