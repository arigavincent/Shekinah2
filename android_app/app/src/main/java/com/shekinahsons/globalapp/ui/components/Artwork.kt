package com.shekinahsons.globalapp.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.R
import com.shekinahsons.globalapp.data.Sermon
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Poster
import kotlin.math.absoluteValue

private fun pick(seed: String, n: Int) = (seed.hashCode().absoluteValue) % n

private fun displayCode(sermon: Sermon) = sermon.code.trim().uppercase()

// Title as poster type with the last word picked out in gold.
private fun posterTitle(title: String, accent: Color) = buildAnnotatedString {
    val words = title.trim().uppercase().split(Regex("\\s+"))
    words.forEachIndexed { i, w ->
        if (i == words.lastIndex && words.size > 1) withStyle(SpanStyle(color = accent)) { append(w) } else append(w)
        if (i != words.lastIndex) append(" ")
    }
}

private val posterShadow = Shadow(Color(0xCC000000), blurRadius = 18f)

@Composable
private fun CodeChip(code: String, bg: Color = Brand.Gold, fg: Color = Brand.Black, modifier: Modifier = Modifier) {
    if (code.isBlank()) return
    Text(
        code,
        style = TextStyle(fontFamily = Inter, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold, fontSize = 11.sp, letterSpacing = 0.8.sp),
        color = fg,
        modifier = modifier.background(bg, RoundedCornerShape(6.dp)).padding(horizontal = 8.dp, vertical = 3.dp),
    )
}

// Video sermon thumbnail dressed as an edited poster. The service frame is
// the photo; one of three layouts (chosen per sermon so a rail looks
// curated, not repeated) adds the type treatment.
@Composable
fun SermonPoster(sermon: Sermon, modifier: Modifier = Modifier, compact: Boolean = false) {
    val style = pick(sermon.id, 3)
    BoxWithConstraints(modifier.background(Brand.Surface2)) {
        val big = (maxWidth.value / if (compact) 10.5f else 9f).sp
        FadeImage(sermon.thumbnail, Modifier.fillMaxSize())
        when (style) {
            // Spotlight: speaker stays on the right, title set in the dark left third.
            0 -> {
                Box(Modifier.fillMaxSize().background(Brush.horizontalGradient(0f to Color(0xF2000000), 0.55f to Color(0x99000000), 1f to Color.Transparent)))
                Column(Modifier.fillMaxSize().padding(14.dp), verticalArrangement = Arrangement.Center) {
                    CodeChip(displayCode(sermon))
                    Spacer(Modifier.height(6.dp))
                    Text(
                        posterTitle(sermon.title, Brand.GoldLight),
                        style = TextStyle(fontFamily = Poster, fontSize = big, lineHeight = big * 1.02f, shadow = posterShadow),
                        color = Brand.White, maxLines = 3, overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.fillMaxWidth(0.62f),
                    )
                    if (!compact) {
                        Spacer(Modifier.height(6.dp))
                        Text(sermon.speaker.uppercase(), color = Brand.Gold, fontFamily = Inter, fontSize = 10.sp, letterSpacing = 1.4.sp, maxLines = 1)
                    }
                }
            }
            // Banner: gold rule and title across the bottom.
            1 -> {
                Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0.35f to Color.Transparent, 1f to Color(0xF5000000))))
                CodeChip(displayCode(sermon), modifier = Modifier.align(Alignment.TopStart).padding(12.dp))
                Column(Modifier.align(Alignment.BottomStart).padding(14.dp)) {
                    Box(Modifier.width(34.dp).height(3.dp).background(Brand.GoldGradient, RoundedCornerShape(2.dp)))
                    Spacer(Modifier.height(7.dp))
                    Text(
                        sermon.title.uppercase(),
                        style = TextStyle(fontFamily = Poster, fontSize = big * 0.92f, lineHeight = big * 0.98f, shadow = posterShadow),
                        color = Brand.White, maxLines = 2, overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            // Framed: thin gold inset frame, centred title, warm grade.
            else -> {
                Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0x55000000), Color(0x22000000), Color(0xE6000000)))))
                Box(Modifier.fillMaxSize().padding(8.dp).border(1.dp, Brand.Gold.copy(alpha = 0.7f), RoundedCornerShape(10.dp)))
                Column(
                    Modifier.align(Alignment.BottomCenter).padding(horizontal = 18.dp, vertical = 16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    CodeChip(displayCode(sermon), bg = Color(0x33D4AF37), fg = Brand.GoldLight)
                    Spacer(Modifier.height(5.dp))
                    Text(
                        posterTitle(sermon.title, Brand.GoldLight),
                        style = TextStyle(fontFamily = Poster, fontSize = big * 0.9f, lineHeight = big * 0.96f, textAlign = TextAlign.Center, shadow = posterShadow),
                        color = Brand.White, maxLines = 2, overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}

// Bright audio cover templates. Each sermon gets a palette by its code
// (or id), so the same message always wears the same cover.
private data class AudioPalette(val bg: Brush, val ink: Color, val accent: Color, val marble: Float, val glow: Color)

private val audioPalettes = listOf(
    // Gold leaf
    AudioPalette(Brush.linearGradient(listOf(Color(0xFFFFE9A8), Color(0xFFE7BE4A), Color(0xFFB8862A))), Color(0xFF1A1206), Color(0xFF6B4A0E), 0.35f, Color(0xFFE7BE4A)),
    // Sapphire
    AudioPalette(Brush.linearGradient(listOf(Color(0xFF6FA8FF), Color(0xFF2B5FD9), Color(0xFF14286B))), Color.White, Color(0xFFFFD86B), 0.22f, Color(0xFF3D7BFF)),
    // Ivory marble
    AudioPalette(Brush.linearGradient(listOf(Color(0xFFFFFFFF), Color(0xFFF4EEE2), Color(0xFFE2D6BC))), Color(0xFF1B1B1B), Color(0xFFB08A26), 0.85f, Color(0xFFF0D27A)),
    // Crimson
    AudioPalette(Brush.linearGradient(listOf(Color(0xFFFF7A6B), Color(0xFFD7263D), Color(0xFF6E0F24))), Color.White, Color(0xFFFFE08A), 0.2f, Color(0xFFE53935)),
    // Sunrise
    AudioPalette(Brush.linearGradient(listOf(Color(0xFFFFD3A5), Color(0xFFFF9F5A), Color(0xFFE2563B))), Color(0xFF2A0E05), Color.White, 0.25f, Color(0xFFFF8A4C)),
    // Emerald night
    AudioPalette(Brush.linearGradient(listOf(Color(0xFF5EE3B5), Color(0xFF13906B), Color(0xFF07382C))), Color.White, Color(0xFFFFE08A), 0.2f, Color(0xFF1FBF8C)),
)

fun audioGlowColor(sermon: Sermon): Color = audioPalettes[pick(sermon.code.ifBlank { sermon.id }, audioPalettes.size)].glow

private val grey = ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(0f) })

@Composable
fun AudioCover(sermon: Sermon, modifier: Modifier = Modifier) {
    val p = audioPalettes[pick(sermon.code.ifBlank { sermon.id }, audioPalettes.size)]
    BoxWithConstraints(modifier.background(p.bg)) {
        val w = maxWidth.value
        Image(
            painterResource(R.drawable.marble), null,
            contentScale = ContentScale.Crop, colorFilter = grey,
            modifier = Modifier.fillMaxSize().alpha(p.marble),
        )
        Column(Modifier.fillMaxSize().padding((w * 0.075f).dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Image(painterResource(R.drawable.dove_mark), null, Modifier.size((w * 0.11f).dp), colorFilter = ColorFilter.tint(p.ink))
                Spacer(Modifier.weight(1f))
                val code = displayCode(sermon)
                if (code.isNotBlank()) Text(code, color = p.ink, fontFamily = Inter, fontSize = (w * 0.06f).sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold, letterSpacing = 1.sp)
            }
            Spacer(Modifier.weight(1f))
            Text(
                posterTitle(sermon.title, p.accent),
                style = TextStyle(fontFamily = Poster, fontSize = (w * 0.115f).sp, lineHeight = (w * 0.12f).sp),
                color = p.ink, maxLines = 4, overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height((w * 0.04f).dp))
            Box(Modifier.width((w * 0.14f).dp).height(2.dp).background(p.accent))
            Spacer(Modifier.height((w * 0.035f).dp))
            Text(sermon.speaker.uppercase(), color = p.ink.copy(alpha = 0.85f), fontFamily = Inter, fontSize = (w * 0.045f).sp, letterSpacing = 1.4.sp, maxLines = 1)
        }
    }
}
