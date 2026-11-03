package com.shekinahsons.globalapp.bible

import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import com.shekinahsons.globalapp.R

// Reading fonts for the Bible. Roboto is the default; the others are chosen
// for long reading on a phone. All are free (SIL Open Font License), trimmed
// to Latin letters so the app stays small.
object BibleFonts {
    data class Choice(val id: String, val label: String, val note: String, val family: FontFamily)

    val all = listOf(
        Choice("roboto", "Roboto", "Clean and clear (default)", FontFamily(Font(R.font.bible_roboto, FontWeight.Normal))),
        Choice("atkinson", "Atkinson Hyperlegible", "Made for easy reading", FontFamily(Font(R.font.bible_atkinson, FontWeight.Normal))),
        Choice("literata", "Literata", "A book font for long reading", FontFamily(Font(R.font.bible_literata, FontWeight.Normal))),
        Choice("merriweather", "Merriweather", "Sturdy serif, great on screens", FontFamily(Font(R.font.bible_merriweather, FontWeight.Normal))),
        Choice("lora", "Lora", "Warm and elegant", FontFamily(Font(R.font.bible_lora, FontWeight.Normal))),
        Choice("notoserif", "Noto Serif", "Classic Bible look", FontFamily(Font(R.font.bible_notoserif, FontWeight.Normal))),
        Choice("playfair", "Playfair Italic", "The original Shekinah style", com.shekinahsons.globalapp.ui.theme.Scripture),
    )

    fun of(id: String): FontFamily = (all.firstOrNull { it.id == id } ?: all.first()).family
}
