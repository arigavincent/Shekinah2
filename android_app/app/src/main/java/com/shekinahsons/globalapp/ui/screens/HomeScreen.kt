package com.shekinahsons.globalapp.ui.screens

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsTopHeight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.rounded.Menu
import androidx.compose.material.icons.rounded.PlayArrow
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.R
import com.shekinahsons.globalapp.data.Clip
import com.shekinahsons.globalapp.data.Devotion
import com.shekinahsons.globalapp.data.HomeContent
import com.shekinahsons.globalapp.data.Sermon
import com.shekinahsons.globalapp.ui.components.AmbientGlow
import com.shekinahsons.globalapp.ui.components.AudioCover
import com.shekinahsons.globalapp.ui.components.Breathing
import com.shekinahsons.globalapp.ui.components.ColorGlow
import com.shekinahsons.globalapp.ui.components.CoverFlowRail
import com.shekinahsons.globalapp.ui.components.FadeImage
import com.shekinahsons.globalapp.ui.components.LiveBadge
import com.shekinahsons.globalapp.ui.components.NavBarHeight
import com.shekinahsons.globalapp.ui.components.SermonPoster
import com.shekinahsons.globalapp.ui.components.audioGlowColor
import com.shekinahsons.globalapp.ui.components.outset
import com.shekinahsons.globalapp.ui.components.pressable
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Type
import kotlin.math.abs

class HomeActions(
    val openMenu: () -> Unit,
    val openVideo: (Sermon, List<Sermon>) -> Unit,
    val openAudio: (Sermon, List<Sermon>) -> Unit,
    val openDevotion: (Devotion) -> Unit,
    val openClip: (Clip) -> Unit,
    val openLive: () -> Unit,
    val seeVideos: () -> Unit,
    val seeAudio: () -> Unit,
    val seeRecaps: () -> Unit,
    val seeDevotions: () -> Unit,
)

// Phaneroo's home order: today's devotional, then (when on air) the live
// preview, then the video, audio and recap rails.
@Composable
fun HomeScreen(content: HomeContent, actions: HomeActions) {
    val screenW = LocalConfiguration.current.screenWidthDp.dp
    val videos = content.videoSermons
    val audios = content.audioSermons
    val videoPager = rememberPagerState { videos.size }
    val list = rememberLazyListState()
    val devotion = content.devotions.firstOrNull()

    // The page is washed in the colours of today's devotional; as you reach
    // the sermons it takes on the focused sermon's colours instead.
    val nearSermons by remember { derivedStateOf { list.firstVisibleItemIndex >= 2 } }
    val washUrl by remember(devotion) {
        derivedStateOf { if (nearSermons) videos.getOrNull(videoPager.currentPage)?.thumbnail else devotion?.imageUrl }
    }

    Box(Modifier.fillMaxSize().background(Brand.Black)) {
        Crossfade(washUrl, animationSpec = tween(900), label = "wash") { url ->
            Box(Modifier.fillMaxWidth().height(640.dp).clipToBounds()) {
                AmbientGlow(url, Modifier.fillMaxSize(), blur = 70.dp, alpha = 0.85f)
                Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color(0x26000000), 0.5f to Color(0x8C000000), 1f to Brand.Black)))
            }
        }

        LazyColumn(state = list, contentPadding = PaddingValues(bottom = NavBarHeight + 120.dp), modifier = Modifier.fillMaxSize()) {
            item { HomeTopBar(actions.openMenu) }
            devotion?.let { d -> item { DevotionCard(d, hasMore = content.devotions.size > 1) { actions.openDevotion(d) } } }
            if (content.live.isLive) item { LiveCard(content, actions.openLive) }

            if (videos.isNotEmpty()) {
                item { RailHeader("Latest Video Sermons", actions.seeVideos) }
                item {
                    val cardW = screenW * 0.62f
                    CoverFlowRail(videos, cardW, spacing = 4.dp, depth = 0.7f, state = videoPager, startAligned = true) { s, offset ->
                        VideoCard(s, cardW, offset) { actions.openVideo(s, videos) }
                    }
                }
            }
            if (audios.isNotEmpty()) {
                item { RailHeader("Latest Audio Sermons", actions.seeAudio) }
                item {
                    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        items(audios, key = { it.id }) { s -> AudioCard(s) { actions.openAudio(s, audios) } }
                    }
                }
            }
            if (content.clips.isNotEmpty()) {
                item { RailHeader("Recaps", actions.seeRecaps) }
                item {
                    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        items(content.clips, key = { it.id }) { RecapCard(it) { actions.openClip(it) } }
                    }
                }
            }
        }
        // Keeps scrolled content from colliding with the clock and icons.
        Box(Modifier.fillMaxWidth().windowInsetsTopHeight(WindowInsets.statusBars).background(Color(0xF2000000)))
    }
}

@Composable
private fun HomeTopBar(onMenu: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().statusBarsPadding().height(64.dp).padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(48.dp).clip(CircleShape).clickable(onClick = onMenu),
            contentAlignment = Alignment.Center,
        ) { Icon(Icons.Rounded.Menu, "Menu", tint = Brand.White, modifier = Modifier.size(28.dp)) }
        Spacer(Modifier.width(10.dp))
        Image(painterResource(R.drawable.dove_mark), "Shekinah Sons Global", Modifier.size(42.dp))
    }
}

// Section title with a "View All" pill, as Phaneroo does it.
@Composable
private fun RailHeader(title: String, onViewAll: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 30.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(title, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 20.sp, letterSpacing = (-0.3).sp, color = Brand.White, modifier = Modifier.weight(1f))
        Text(
            "View All", color = Brand.GoldLight, fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 14.sp,
            modifier = Modifier.clip(RoundedCornerShape(50)).background(Color(0x1FD4AF37)).clickable(onClick = onViewAll)
                .padding(horizontal = 18.dp, vertical = 10.dp),
        )
    }
}

// Today's devotional: picture on the left, words on the right, with the
// next day's card peeking out underneath like a stack.
@Composable
private fun DevotionCard(d: Devotion, hasMore: Boolean, onOpen: () -> Unit) {
    Box(Modifier.padding(horizontal = 16.dp).padding(top = 8.dp, bottom = if (hasMore) 12.dp else 0.dp)) {
        if (hasMore) {
            Box(
                Modifier.matchParentSize().padding(horizontal = 14.dp).graphicsLayer { translationY = 12.dp.toPx() }
                    .clip(RoundedCornerShape(22.dp)).background(Color(0xFF1A1813)),
            )
        }
        AmbientGlow(d.imageUrl, Modifier.matchParentSize().outset(0.dp, drop = 10.dp), blur = 26.dp, alpha = 0.75f)
        Row(
            Modifier.fillMaxWidth().height(172.dp).clip(RoundedCornerShape(22.dp))
                .background(Brush.horizontalGradient(listOf(Color(0xFF1C1A14), Color(0xFF141416))))
                .border(1.dp, Color(0x14FFFFFF), RoundedCornerShape(22.dp))
                .pressable(onOpen),
        ) {
            FadeImage(d.imageUrl, Modifier.fillMaxHeight().width(124.dp))
            Column(Modifier.weight(1f).padding(start = 14.dp, end = 14.dp, top = 14.dp, bottom = 12.dp)) {
                Text(
                    "Today's Devotional", color = Brand.Black, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 12.sp,
                    modifier = Modifier.background(Brand.GoldGradient, RoundedCornerShape(50)).padding(horizontal = 12.dp, vertical = 5.dp),
                )
                Spacer(Modifier.height(9.dp))
                Text(d.title, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 20.sp, color = Brand.White, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(5.dp))
                Text("“${d.excerpt}”", fontFamily = Inter, fontSize = 13.sp, lineHeight = 18.sp, color = Brand.Text2, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.weight(1f))
                Row(
                    Modifier.background(Color(0x1AD4AF37), RoundedCornerShape(50)).padding(horizontal = 10.dp, vertical = 5.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Outlined.CalendarMonth, null, tint = Brand.GoldLight, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(d.date, color = Brand.GoldLight, fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 12.sp)
                }
            }
        }
    }
}

@Composable
private fun LiveCard(content: HomeContent, onOpen: () -> Unit) {
    Column(Modifier.padding(horizontal = 16.dp).padding(top = 26.dp)) {
        Box {
            ColorGlow(Brand.Red.copy(alpha = 0.8f * Breathing()), Modifier.matchParentSize().outset(4.dp, drop = 8.dp), blur = 30.dp)
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
}

// Video sermon: the edited thumbnail with its own glow, the title in two
// plain lines beneath (Phaneroo's style).
@Composable
private fun VideoCard(s: Sermon, width: Dp, offset: Float, onOpen: () -> Unit) {
    val focus = (1f - abs(offset)).coerceIn(0f, 1f)
    Column(Modifier.width(width).padding(top = 14.dp, bottom = 22.dp)) {
        Box {
            AmbientGlow(s.thumbnail, Modifier.matchParentSize().outset(2.dp, drop = 12.dp), blur = 24.dp, alpha = focus)
            Box(Modifier.fillMaxWidth().aspectRatio(16 / 9f).clip(RoundedCornerShape(16.dp)).pressable(onOpen)) {
                SermonPoster(s, Modifier.fillMaxSize())
                if (s.duration.isNotBlank()) {
                    Text(
                        s.duration, color = Color.White, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 11.sp,
                        modifier = Modifier.align(Alignment.BottomEnd).padding(8.dp).background(Color(0xB3000000), RoundedCornerShape(6.dp)).padding(horizontal = 6.dp, vertical = 2.dp),
                    )
                }
            }
        }
        Spacer(Modifier.height(12.dp))
        Text(
            listOf(s.title, s.speaker).filter { it.isNotBlank() }.joinToString(" | "),
            fontFamily = Inter, fontSize = 15.sp, lineHeight = 20.sp, color = Brand.White, maxLines = 2, overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = 4.dp).graphicsLayer { alpha = 0.45f + 0.55f * focus },
        )
    }
}

@Composable
private fun AudioCard(s: Sermon, onOpen: () -> Unit) {
    Column(Modifier.width(136.dp).padding(top = 14.dp)) {
        Box {
            ColorGlow(audioGlowColor(s).copy(alpha = 0.55f), Modifier.matchParentSize().outset(0.dp, drop = 10.dp), blur = 18.dp)
            Box(Modifier.size(136.dp).clip(RoundedCornerShape(16.dp)).pressable(onOpen)) {
                AudioCover(s, Modifier.fillMaxSize())
                Box(
                    Modifier.align(Alignment.BottomEnd).padding(8.dp).size(32.dp).background(Color(0xD9000000), CircleShape),
                    contentAlignment = Alignment.Center,
                ) { Icon(Icons.Rounded.PlayArrow, "Play", tint = Brand.Gold, modifier = Modifier.size(20.dp)) }
            }
        }
        Spacer(Modifier.height(12.dp))
        Text(s.title, fontFamily = Inter, fontSize = 15.sp, lineHeight = 20.sp, color = Brand.White, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(horizontal = 2.dp))
    }
}

@Composable
private fun RecapCard(c: Clip, onOpen: () -> Unit) {
    Column(Modifier.width(132.dp).padding(top = 14.dp)) {
        Box(Modifier.fillMaxWidth().aspectRatio(9 / 15f).clip(RoundedCornerShape(16.dp)).pressable(onOpen)) {
            FadeImage(c.image, Modifier.fillMaxSize())
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0.55f to Color.Transparent, 1f to Color(0xD9000000))))
            Box(Modifier.align(Alignment.TopEnd).padding(8.dp).size(28.dp).background(Color(0x66000000), CircleShape), contentAlignment = Alignment.Center) {
                Icon(Icons.Rounded.PlayArrow, null, tint = Color.White, modifier = Modifier.size(18.dp))
            }
            if (c.duration.isNotBlank()) {
                Text(c.duration, style = Type.Meta.copy(fontSize = 11.sp), color = Brand.GoldLight, modifier = Modifier.align(Alignment.BottomStart).padding(10.dp))
            }
        }
        Spacer(Modifier.height(10.dp))
        Text(c.title, fontFamily = Inter, fontSize = 14.sp, lineHeight = 19.sp, color = Brand.White, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}
