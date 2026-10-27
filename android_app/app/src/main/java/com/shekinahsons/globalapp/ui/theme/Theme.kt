package com.shekinahsons.globalapp.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.R

// Brand: gold leads, blue is the highlight (Phaneroo's green), red means live.
object Brand {
    val Black = Color(0xFF000000)
    val Surface = Color(0xFF121212)
    val Surface2 = Color(0xFF1C1C1E)
    val Surface3 = Color(0xFF2A2A2D)
    val Line = Color(0x1FFFFFFF)
    val Gold = Color(0xFFD4AF37)
    val GoldLight = Color(0xFFF0D27A)
    val GoldDeep = Color(0xFFA8841F)
    val Blue = Color(0xFF4A8BFF)
    val BlueText = Color(0xFF7DAEFF)
    val Red = Color(0xFFE53935)
    val White = Color(0xFFFFFFFF)
    val Text2 = Color(0xFFB8B8BD)
    val Muted = Color(0xFF7C7C82)

    val GoldGradient = Brush.linearGradient(listOf(GoldLight, Gold, GoldDeep))
}

val Inter = FontFamily(
    Font(R.font.inter_regular, FontWeight.Normal),
    Font(R.font.inter_medium, FontWeight.Medium),
    Font(R.font.inter_semibold, FontWeight.SemiBold),
    Font(R.font.inter_bold, FontWeight.Bold),
)
val Cinzel = FontFamily(Font(R.font.cinzel_bold, FontWeight.Bold))
val Scripture = FontFamily(Font(R.font.playfair_italic, FontWeight.Medium))
val Poster = FontFamily(Font(R.font.anton_regular))

object Type {
    val Display = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 26.sp, lineHeight = 31.sp, letterSpacing = (-0.4).sp)
    val Title = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 19.sp, lineHeight = 24.sp, letterSpacing = (-0.2).sp)
    val CardTitle = TextStyle(fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, lineHeight = 20.sp)
    val Body = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Normal, fontSize = 15.sp, lineHeight = 23.sp)
    val Meta = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 12.5.sp, lineHeight = 17.sp)
    val Label = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 11.sp, letterSpacing = 1.2.sp)
    val Verse = TextStyle(fontFamily = Scripture, fontWeight = FontWeight.Medium, fontSize = 22.sp, lineHeight = 31.sp)
}

@Composable
fun ShekinahTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = Brand.Gold,
            onPrimary = Brand.Black,
            secondary = Brand.Blue,
            background = Brand.Black,
            surface = Brand.Surface,
            onBackground = Brand.White,
            onSurface = Brand.White,
            error = Brand.Red,
        ),
        content = content,
    )
}
