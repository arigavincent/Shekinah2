package com.shekinahsons.globalapp.ui.screens

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Headphones
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Place
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsTopHeight
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.data.Clip
import com.shekinahsons.globalapp.data.Devotion
import com.shekinahsons.globalapp.data.Event
import com.shekinahsons.globalapp.data.HomeContent
import com.shekinahsons.globalapp.data.Sermon
import com.shekinahsons.globalapp.ui.components.AmbientGlow
import com.shekinahsons.globalapp.ui.components.AudioCover
import com.shekinahsons.globalapp.ui.components.ColorGlow
import com.shekinahsons.globalapp.ui.components.CoverFlowRail
import com.shekinahsons.globalapp.ui.components.FadeImage
import com.shekinahsons.globalapp.ui.components.LiveBadge
import com.shekinahsons.globalapp.ui.components.NavBarHeight
import com.shekinahsons.globalapp.ui.components.SectionHeader
import com.shekinahsons.globalapp.ui.components.SermonPoster
import com.shekinahsons.globalapp.ui.components.TopBar
import com.shekinahsons.globalapp.ui.components.audioGlowColor
import com.shekinahsons.globalapp.ui.components.pressable
import com.shekinahsons.globalapp.ui.components.outset
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Type
import java.util.Calendar
import kotlin.math.abs

class HomeActions(
    val openVideo: (Sermon, List<Sermon>) -> Unit,
    val openAudio: (Sermon, List<Sermon>) -> Unit,
    val openDevotion: (Devotion) -> Unit,
    val openClip: (Clip) -> Unit,
    val openLive: () -> Unit,
    val seeSermons: () -> Unit,
    val seeAudio: () -> Unit,
    val seeDevotions: () -> Unit,
)

private fun greeting(): String = when (Calendar.getInstance().get(Calendar.HOUR_OF_DAY)) {
    in 4..11 -> "Good morning"
    in 12..16 -> "Good afternoon"
    else -> "Good evening"
}

@Composable
fun HomeScreen(content: HomeContent, actions: HomeActions) {
    val screenW = LocalConfiguration.current.screenWidthDp.dp
    val videos = content.videoSermons
    val audios = content.audioSermons
    val videoPager = rememberPagerState { videos.size }
    val list = rememberLazyListState()

    // The focused sermon washes the top of the page in its colours.
    val focused by remember { derivedStateOf { videos.getOrNull(videoPager.currentPage)?.thumbnail } }
    val scrolled by remember { derivedStateOf { if (list.firstVisibleItemIndex > 0) 1f else (list.firstVisibleItemScrollOffset / 900f).coerceIn(0f, 1f) } }

    Box(Modifier.fillMaxSize().background(Brand.Black)) {
        Crossfade(focused, animationSpec = tween(700), label = "backdrop") { url ->
            Box(Modifier.fillMaxWidth().height(620.dp).clipToBounds().graphicsLayer { alpha = 1f - scrolled * 0.8f }) {
                AmbientGlow(url, Modifier.fillMaxSize(), blur = 70.dp, alpha = 0.9f)
                Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color(0x1A000000), 0.45f to Color(0x66000000), 1f to Brand.Black)))
            }
        }

        LazyColumn(state = list, contentPadding = PaddingValues(bottom = NavBarHeight + 48.dp), modifier = Modifier.fillMaxSize()) {
            item { TopBar() }
            item {
                Column(Modifier.padding(horizontal = 20.dp, vertical = 6.dp)) {
                    Text(greeting(), color = Brand.GoldLight, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    Text("Welcome home", style = Type.Display, color = Brand.White)
                }
            }
            if (content.live.isLive) item { LiveCard(content, actions.openLive) }
            content.devotions.firstOrNull()?.let { d -> item { DevotionHero(d) { actions.openDevotion(d) } } }
            if (content.scripture.verse.isNotBlank()) item { VerseCard(content) }

            if (videos.isNotEmpty()) {
                item { SectionHeader("Latest Sermons", onAction = actions.seeSermons) }
                item {
                    val cardW = screenW - 64.dp
                    CoverFlowRail(videos, cardW, state = videoPager) { s, offset ->
                        VideoRailCard(s, cardW, offset) { actions.openVideo(s, videos) }
                    }
                }
            }
            if (audios.isNotEmpty()) {
                item { SectionHeader("Latest Audio", onAction = actions.seeAudio) }
                item {
                    CoverFlowRail(audios, 196.dp, spacing = 10.dp, depth = 1.3f) { s, offset ->
                        AudioRailCard(s, offset) { actions.openAudio(s, audios) }
                    }
                }
            }
            if (content.clips.isNotEmpty()) {
                item { SectionHeader("Recaps", action = null) }
                item {
                    LazyRow(contentPadding = PaddingValues(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        items(content.clips, key = { it.id }) { RecapCard(it) { actions.openClip(it) } }
                    }
                }
            }
            if (content.events.isNotEmpty()) {
                item { SectionHeader("Upcoming Events", action = null) }
                items(content.events, key = { it.id }) { EventRow(it) }
            }
        }
        // Keeps scrolled content from colliding with the clock and icons.
        Box(Modifier.fillMaxWidth().windowInsetsTopHeight(WindowInsets.statusBars).background(Brush.verticalGradient(listOf(Color(0xFA000000), Color(0xE0000000)))))
    }
}

@Composable
private fun LiveCard(content: HomeContent, onOpen: () -> Unit) {
    Box(Modifier.padding(horizontal = 20.dp, vertical = 14.dp)) {
        ColorGlow(Brand.Red.copy(alpha = 0.8f * com.shekinahsons.globalapp.ui.components.Breathing()), Modifier.matchParentSize().outset(4.dp, drop = 8.dp), blur = 30.dp)
        Box(
            Modifier.fillMaxWidth().aspectRatio(16 / 9f).clip(RoundedCornerShape(20.dp))
                .border(1.dp, Brand.Red.copy(alpha = 0.6f), RoundedCornerShape(20.dp)).pressable(onOpen),
        ) {
            FadeImage(content.videoSermons.firstOrNull()?.thumbnail, Modifier.fillMaxSize())
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color(0x88000000), 0.4f to Color.Transparent, 1f to Color(0xE6000000))))
            LiveBadge(Modifier.align(Alignment.TopStart).padding(12.dp))
            Column(Modifier.align(Alignment.BottomStart).padding(14.dp)) {
                Text(content.live.title.ifBlank { "Live Service" }, style = Type.Title, color = Color.White, maxLines = 1)
                Text("Tap to watch and join the service", style = Type.Meta, color = Color(0xCCFFFFFF))
            }
        }
    }
}

@Composable
private fun DevotionHero(d: Devotion, onOpen: () -> Unit) {
    Column(Modifier.padding(horizontal = 20.dp).padding(top = 18.dp)) {
        Box {
            AmbientGlow(d.imageUrl, Modifier.matchParentSize().outset(6.dp, drop = 16.dp), blur = 30.dp)
            Box(Modifier.fillMaxWidth().aspectRatio(1.45f).clip(RoundedCornerShape(22.dp)).pressable(onOpen)) {
                FadeImage(d.imageUrl, Modifier.fillMaxSize())
                Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0.3f to Color.Transparent, 1f to Color(0xF0000000))))
                Text(
                    "TODAY'S DEVOTION", style = Type.Label, color = Brand.Black,
                    modifier = Modifier.align(Alignment.TopStart).padding(14.dp).background(Brand.GoldGradient, RoundedCornerShape(6.dp)).padding(horizontal = 8.dp, vertical = 4.dp),
                )
                Column(Modifier.align(Alignment.BottomStart).padding(18.dp)) {
                    Text(d.title, style = Type.Display.copy(fontSize = 23.sp, lineHeight = 28.sp), color = Color.White, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Spacer(Modifier.height(4.dp))
                    Text(d.excerpt, style = Type.Meta.copy(fontSize = 13.5.sp, lineHeight = 19.sp), color = Color(0xD9FFFFFF), maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Spacer(Modifier.height(12.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            "Read now", color = Brand.Black, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 13.sp,
                            modifier = Modifier.background(Brand.Gold, RoundedCornerShape(50)).padding(horizontal = 16.dp, vertical = 8.dp),
                        )
                        Spacer(Modifier.width(12.dp))
                        Text(d.date, style = Type.Meta, color = Color(0xB3FFFFFF))
                    }
                }
            }
        }
    }
}

@Composable
private fun VerseCard(content: HomeContent) {
    val context = LocalContext.current
    val s = content.scripture
    Column(
        Modifier.padding(horizontal = 20.dp).padding(top = 22.dp).fillMaxWidth()
            .clip(RoundedCornerShape(22.dp))
            .background(Brush.linearGradient(listOf(Color(0xFF231B08), Color(0xFF15120A), Color(0xFF0E1526))))
            .border(1.dp, Brush.linearGradient(listOf(Brand.Gold.copy(alpha = 0.7f), Color(0x00D4AF37), Brand.Blue.copy(alpha = 0.5f))), RoundedCornerShape(22.dp))
            .padding(22.dp),
    ) {
        Text("VERSE OF THE DAY", style = Type.Label, color = Brand.Gold)
        Spacer(Modifier.height(12.dp))
        Text("“${s.verse}”", style = Type.Verse, color = Brand.White)
        Spacer(Modifier.height(14.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(s.reference, color = Brand.GoldLight, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, modifier = Modifier.weight(1f))
            Box(
                Modifier.size(38.dp).clip(CircleShape).background(Color(0x1FFFFFFF)).pressable {
                    val send = android.content.Intent(android.content.Intent.ACTION_SEND).setType("text/plain")
                        .putExtra(android.content.Intent.EXTRA_TEXT, "“${s.verse}” — ${s.reference}\n\nShekinah Sons Global")
                    context.startActivity(android.content.Intent.createChooser(send, "Share verse"))
                },
                contentAlignment = Alignment.Center,
            ) { Icon(Icons.Rounded.Share, "Share verse", tint = Brand.White, modifier = Modifier.size(18.dp)) }
        }
    }
}

@Composable
private fun VideoRailCard(s: Sermon, width: androidx.compose.ui.unit.Dp, offset: Float, onOpen: () -> Unit) {
    val focus = (1f - abs(offset)).coerceIn(0f, 1f)
    Column(Modifier.width(width).padding(vertical = 26.dp)) {
        Box {
            AmbientGlow(s.thumbnail, Modifier.matchParentSize().outset(4.dp, drop = 14.dp), blur = 28.dp, alpha = focus)
            Box(Modifier.fillMaxWidth().aspectRatio(16 / 9f).clip(RoundedCornerShape(18.dp)).pressable(onOpen)) {
                SermonPoster(s, Modifier.fillMaxSize())
                if (s.duration.isNotBlank()) {
                    Text(
                        s.duration, color = Color.White, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 11.sp,
                        modifier = Modifier.align(Alignment.BottomEnd).padding(10.dp).background(Color(0xB3000000), RoundedCornerShape(6.dp)).padding(horizontal = 6.dp, vertical = 2.dp),
                    )
                }
            }
        }
        Spacer(Modifier.height(14.dp))
        Text(s.title, style = Type.CardTitle.copy(fontSize = 16.sp), color = Brand.White, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.graphicsLayer { alpha = 0.3f + 0.7f * focus })
        Text("${s.speaker} · ${s.date}", style = Type.Meta, color = Brand.Text2, maxLines = 1, modifier = Modifier.graphicsLayer { alpha = focus })
    }
}

@Composable
private fun AudioRailCard(s: Sermon, offset: Float, onOpen: () -> Unit) {
    val focus = (1f - abs(offset)).coerceIn(0f, 1f)
    Column(Modifier.width(196.dp).padding(vertical = 24.dp)) {
        Box {
            ColorGlow(audioGlowColor(s).copy(alpha = 0.9f * focus), Modifier.matchParentSize().outset(2.dp, drop = 14.dp), blur = 26.dp)
            Box(Modifier.size(196.dp).clip(RoundedCornerShape(18.dp)).pressable(onOpen)) {
                AudioCover(s, Modifier.fillMaxSize())
                Box(
                    Modifier.align(Alignment.BottomEnd).padding(10.dp).graphicsLayer { alpha = focus }.size(38.dp).background(Color(0xE6000000), CircleShape),
                    contentAlignment = Alignment.Center,
                ) { Icon(Icons.Rounded.PlayArrow, "Play", tint = Brand.Gold, modifier = Modifier.size(24.dp)) }
            }
        }
        Spacer(Modifier.height(12.dp))
        Text(s.title, style = Type.CardTitle, color = Brand.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Rounded.Headphones, null, tint = Brand.Gold, modifier = Modifier.size(13.dp))
            Spacer(Modifier.width(4.dp))
            Text(listOf(s.speaker, s.duration).filter { it.isNotBlank() }.joinToString(" · "), style = Type.Meta, color = Brand.Text2, maxLines = 1)
        }
    }
}

@Composable
private fun RecapCard(c: Clip, onOpen: () -> Unit) {
    Box(Modifier.width(132.dp).aspectRatio(9 / 15f).clip(RoundedCornerShape(16.dp)).pressable(onOpen)) {
        FadeImage(c.image, Modifier.fillMaxSize())
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0.45f to Color.Transparent, 1f to Color(0xF2000000))))
        Box(Modifier.align(Alignment.TopEnd).padding(8.dp).size(28.dp).background(Color(0x66000000), CircleShape), contentAlignment = Alignment.Center) {
            Icon(Icons.Rounded.PlayArrow, null, tint = Color.White, modifier = Modifier.size(18.dp))
        }
        Column(Modifier.align(Alignment.BottomStart).padding(10.dp)) {
            Text(c.title, color = Color.White, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 12.5.sp, lineHeight = 16.sp, maxLines = 3, overflow = TextOverflow.Ellipsis)
            if (c.duration.isNotBlank()) Text(c.duration, style = Type.Meta.copy(fontSize = 11.sp), color = Brand.GoldLight)
        }
    }
}

@Composable
private fun EventRow(e: Event) {
    val parts = e.date.split(" ")
    Row(
        Modifier.padding(horizontal = 20.dp, vertical = 6.dp).fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Brand.Surface).padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(78.dp).clip(RoundedCornerShape(14.dp))) {
            FadeImage(e.imageUrl, Modifier.fillMaxSize())
            Box(Modifier.fillMaxSize().background(Color(0x66000000)))
            Column(Modifier.align(Alignment.Center), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(parts.getOrNull(1)?.trim(',') ?: "", color = Color.White, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 24.sp)
                Text(parts.getOrNull(0)?.take(3)?.uppercase() ?: "", style = Type.Label, color = Brand.Gold)
            }
        }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(e.title, style = Type.CardTitle, color = Brand.White, maxLines = 2)
            Spacer(Modifier.height(5.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Rounded.Schedule, null, tint = Brand.BlueText, modifier = Modifier.size(13.dp))
                Spacer(Modifier.width(4.dp))
                Text(e.time, style = Type.Meta, color = Brand.Text2)
                Spacer(Modifier.width(10.dp))
                Icon(Icons.Rounded.Place, null, tint = Brand.BlueText, modifier = Modifier.size(13.dp))
                Spacer(Modifier.width(3.dp))
                Text(e.location, style = Type.Meta, color = Brand.Text2, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}
