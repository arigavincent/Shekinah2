package com.shekinahsons.globalapp.ui.screens

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.material.icons.rounded.Share
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import com.shekinahsons.globalapp.data.Event
import com.shekinahsons.globalapp.data.Library
import com.shekinahsons.globalapp.data.asSermon
import com.shekinahsons.globalapp.extras.VerseImage
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import com.shekinahsons.globalapp.data.Update
import com.shekinahsons.globalapp.playback.VideoCache
import com.shekinahsons.globalapp.ui.components.offsetOf
import com.shekinahsons.globalapp.ui.components.scrollEntrance
import com.shekinahsons.globalapp.ui.components.RecapTile
import com.shekinahsons.globalapp.ui.components.glass
import com.shekinahsons.globalapp.ui.components.lifted
import com.shekinahsons.globalapp.ui.theme.Cinzel
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
    val seeEvents: () -> Unit,
    val seeUpdates: () -> Unit,
    val openCategory: (String) -> Unit,
    val refresh: () -> Unit,
    val openReference: (String) -> Unit,
    val openProfile: () -> Unit,
)

// Phaneroo's home order: today's devotional, then (when on air) the live
// preview, then the video, audio and recap rails.
@Composable
fun HomeScreen(content: HomeContent, library: Library, name: String, refreshing: Boolean, actions: HomeActions) {
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

        // Started-but-unfinished sermons; re-read whenever progress is saved.
        val everything = remember(content) { content.sermons + content.clips.map { it.asSermon() } }
        val continuing = remember(library.progressVersion, everything) { library.inProgress(everything).take(10) }
        val pull = rememberPullToRefreshState()

        PullToRefreshBox(
            isRefreshing = refreshing,
            onRefresh = actions.refresh,
            state = pull,
            modifier = Modifier.fillMaxSize(),
            indicator = { DoveRefreshIndicator(pull, refreshing) },
        ) {
        LazyColumn(state = list, contentPadding = PaddingValues(bottom = NavBarHeight + 120.dp), modifier = Modifier.fillMaxSize()) {
            item { HomeTopBar(actions.openMenu) }
            item { Greeting(name, actions.openProfile) }
            if (content.devotions.isNotEmpty()) item { DevotionCarousel(content.devotions, actions.openDevotion) }
            if (content.live.isLive) item { LiveCard(content, actions.openLive) }
            else item { ServiceStrip(content.live.nextService) }

            if (continuing.isNotEmpty()) {
                item { RailHeader("Continue", null) }
                item {
                    ContinueRail(continuing) { s ->
                        if (s.type == "audio") actions.openAudio(s, audios) else if (s.category == "Recap") actions.openVideo(s, content.clips.map { it.asSermon() }) else actions.openVideo(s, videos)
                    }
                }
            }

            if (videos.isNotEmpty()) {
                item { RailHeader("Latest Video Sermons", actions.seeVideos) }
                item {
                    val cardW = screenW * 0.54f
                    // Fetch the first seconds of the sermon in front (and the next) so it starts instantly.
                    LaunchedEffect(videoPager.settledPage) {
                        VideoCache.warm(videos.getOrNull(videoPager.settledPage)?.mediaUrl)
                        VideoCache.warm(videos.getOrNull(videoPager.settledPage + 1)?.mediaUrl)
                    }
                    CoverFlowRail(videos, cardW, spacing = 4.dp, depth = 0.7f, state = videoPager, startAligned = true) { s, offset ->
                        VideoCard(s, cardW, offset) { actions.openVideo(s, videos) }
                    }
                }
                val topics = videos.map { it.category }.filter { it.isNotBlank() }.distinct()
                if (topics.size > 1) item { CategoryChips(topics, actions.openCategory) }
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
                        items(content.clips, key = { it.id }) { c -> RecapTile(c, Modifier.padding(top = 14.dp, bottom = 18.dp).width(150.dp).aspectRatio(3 / 4f)) { actions.openClip(c) } }
                    }
                }
            }
            item { ScriptureCard(content, actions.openReference) }
            if (content.events.isNotEmpty()) {
                item { RailHeader("Upcoming Events", actions.seeEvents) }
                item {
                    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        items(content.events, key = { it.id }) { e -> EventCard(e) { actions.seeEvents() } }
                    }
                }
            }
            if (content.updates.isNotEmpty()) {
                item { RailHeader("Latest Updates", actions.seeUpdates) }
                content.updates.take(3).forEachIndexed { i, u ->
                    item(key = "update-${u.id}") {
                        val index = list.layoutInfo.totalItemsCount - content.updates.take(3).size + i
                        UpdateRow(u, Modifier.scrollEntrance(list, index)) { actions.seeUpdates() }
                    }
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
        Spacer(Modifier.width(6.dp))
        Image(painterResource(R.drawable.dove_mark), null, Modifier.size(40.dp))
        Spacer(Modifier.width(8.dp))
        Column(Modifier.semantics(mergeDescendants = true) { contentDescription = "Shekinah Sons Global" }) {
            Text("SHEKINAH", fontFamily = Cinzel, fontSize = 21.sp, lineHeight = 22.sp, letterSpacing = 1.5.sp, color = Brand.Gold)
            Text("SONS GLOBAL", fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 8.5.sp, lineHeight = 10.sp, letterSpacing = 3.2.sp, color = Brand.Text2)
        }
    }
}

// Section title with a "View All" pill, as Phaneroo does it.
@Composable
private fun RailHeader(title: String, onViewAll: (() -> Unit)?) {
    Row(
        Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 30.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(title, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 20.sp, letterSpacing = (-0.3).sp, color = Brand.White, modifier = Modifier.weight(1f))
        if (onViewAll != null) Text(
            "View All", color = Brand.GoldLight, fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 14.sp,
            modifier = Modifier.clip(RoundedCornerShape(50)).background(Color(0x1FD4AF37))
                .border(1.dp, Brush.verticalGradient(listOf(Color(0x55F0D27A), Color(0x0FD4AF37))), RoundedCornerShape(50))
                .clickable(onClick = onViewAll).padding(horizontal = 18.dp, vertical = 10.dp),
        )
    }
}

// Today's devotional: picture on the left, words on the right, with the
// next day's card peeking out underneath like a stack.
@Composable
private fun DevotionCard(d: Devotion, hasMore: Boolean, isToday: Boolean, onOpen: () -> Unit) {
    Box(Modifier.padding(horizontal = 16.dp).padding(top = 8.dp, bottom = if (hasMore) 12.dp else 0.dp)) {
        if (hasMore) {
            Box(
                Modifier.matchParentSize().padding(horizontal = 14.dp).graphicsLayer { translationY = 12.dp.toPx() }
                    .clip(RoundedCornerShape(22.dp)).background(Color(0xFF1A1813)),
            )
        }
        AmbientGlow(d.imageUrl, Modifier.matchParentSize().outset(0.dp, drop = 10.dp), blur = 26.dp, alpha = 0.75f)
        Row(
            Modifier.fillMaxWidth().height(172.dp).lifted(RoundedCornerShape(22.dp), 18.dp).clip(RoundedCornerShape(22.dp))
                .background(Brush.horizontalGradient(listOf(Color(0xFF1C1A14), Color(0xFF141416))))
                .border(1.dp, Color(0x14FFFFFF), RoundedCornerShape(22.dp))
                .pressable(onOpen),
        ) {
            FadeImage(d.imageUrl, Modifier.fillMaxHeight().width(124.dp), label = "DEVOTION")
            Column(Modifier.weight(1f).padding(start = 14.dp, end = 14.dp, top = 14.dp, bottom = 12.dp)) {
                Text(
                    if (isToday) "Today's Devotional" else "Devotional", color = Brand.Black, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 12.sp,
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
            Box(Modifier.fillMaxWidth().aspectRatio(16 / 9f).lifted(RoundedCornerShape(16.dp), 16.dp).clip(RoundedCornerShape(16.dp)).pressable(onOpen)) {
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
            Box(Modifier.size(136.dp).lifted(RoundedCornerShape(16.dp), 14.dp, audioGlowColor(s)).clip(RoundedCornerShape(16.dp)).pressable(onOpen)) {
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
private fun DevotionCarousel(devotions: List<Devotion>, open: (Devotion) -> Unit) {
    val pager = rememberPagerState { devotions.size }
    Column {
        HorizontalPager(
            state = pager,
            contentPadding = PaddingValues(horizontal = 0.dp),
            beyondViewportPageCount = 1,
        ) { page ->
            val offset = pager.offsetOf(page)
            Box(Modifier.graphicsLayer {
                val t = abs(offset).coerceAtMost(1f)
                scaleX = 1f - 0.08f * t; scaleY = scaleX
                alpha = 1f - 0.5f * t
            }) {
                DevotionCard(devotions[page], hasMore = page < devotions.lastIndex, isToday = page == 0) { open(devotions[page]) }
            }
        }
        if (devotions.size > 1) {
            Row(Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.Center) {
                devotions.indices.forEach { i ->
                    val on = i == pager.currentPage
                    val w by animateDpAsState(if (on) 20.dp else 7.dp, label = "dot")
                    Box(Modifier.padding(horizontal = 3.dp).height(7.dp).width(w).clip(CircleShape).background(if (on) Brand.Gold else Color(0x40FFFFFF)))
                }
            }
        }
    }
}

@Composable
private fun ScriptureCard(content: HomeContent, openReference: (String) -> Unit) {
    val context = androidx.compose.ui.platform.LocalContext.current
    // A new verse every morning from the offline Bible; the backend's verse if that fails.
    val daily = remember(java.time.LocalDate.now()) { runCatching { com.shekinahsons.globalapp.bible.DailyWord.today(context) }.getOrNull() }
    val s = daily?.let { com.shekinahsons.globalapp.data.Scripture("Verse of the Day", it.text, it.reference) } ?: content.scripture
    if (s.verse.isBlank()) return
    Column(
        Modifier.padding(horizontal = 16.dp).padding(top = 32.dp).fillMaxWidth()
            .clip(RoundedCornerShape(22.dp))
            .background(Brush.linearGradient(listOf(Color(0xFF2A2009), Color(0xFF15120A), Color(0xFF0E1526))))
            .border(1.dp, Brush.linearGradient(listOf(Brand.Gold.copy(alpha = 0.6f), Color(0x00D4AF37), Brand.Blue.copy(alpha = 0.45f))), RoundedCornerShape(22.dp))
            .clickable { openReference(s.reference) }
            .padding(22.dp),
    ) {
        Text(s.title.ifBlank { "Scripture of the Day" }.uppercase(), style = Type.Label, color = Brand.Gold)
        Spacer(Modifier.height(12.dp))
        Text("\u201C${s.verse}\u201D", style = Type.Verse, color = Brand.White)
        Spacer(Modifier.height(14.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(s.reference, color = Brand.GoldLight, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, modifier = Modifier.weight(1f))
            Box(
                Modifier.size(40.dp).clip(CircleShape).background(Color(0x1FFFFFFF)).pressable {
                    VerseImage.share(context, s.verse, s.reference)
                },
                contentAlignment = Alignment.Center,
            ) { Icon(Icons.Rounded.Share, "Share verse", tint = Brand.White, modifier = Modifier.size(18.dp)) }
        }
    }
}

@Composable
private fun EventCard(e: Event, onOpen: () -> Unit) {
    val parts = e.date.split(" ")
    Column(Modifier.width(250.dp).padding(top = 14.dp).pressable(onOpen)) {
        Box(Modifier.fillMaxWidth().aspectRatio(16 / 10f).lifted(RoundedCornerShape(16.dp), 12.dp).clip(RoundedCornerShape(16.dp))) {
            FadeImage(e.imageUrl, Modifier.fillMaxSize(), label = "EVENT")
            Column(
                Modifier.align(Alignment.TopStart).padding(10.dp).clip(RoundedCornerShape(12.dp)).background(Color(0xE6000000)).padding(horizontal = 10.dp, vertical = 6.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(parts.getOrNull(1)?.trim(',') ?: "", color = Color.White, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 18.sp, lineHeight = 20.sp)
                Text(parts.getOrNull(0)?.take(3)?.uppercase() ?: "", style = Type.Label.copy(fontSize = 10.sp), color = Brand.Gold)
            }
        }
        Spacer(Modifier.height(10.dp))
        Text(e.title, fontFamily = Inter, fontSize = 15.sp, lineHeight = 20.sp, color = Brand.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(listOf(e.time, e.location).filter { it.isNotBlank() }.joinToString(" \u00B7 "), style = Type.Meta, color = Brand.Text2, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun UpdateRow(u: Update, modifier: Modifier, onOpen: () -> Unit) {
    Row(
        modifier.padding(horizontal = 16.dp, vertical = 7.dp).fillMaxWidth().lifted(RoundedCornerShape(18.dp), 10.dp).glass(RoundedCornerShape(18.dp), 0.7f)
            .background(Color(0xCC111113)).pressable(onOpen).padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        FadeImage(u.image, Modifier.size(86.dp).clip(RoundedCornerShape(12.dp)), label = "UPDATE")
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(u.date.uppercase(), style = Type.Label.copy(fontSize = 10.sp), color = Brand.Gold)
            Spacer(Modifier.height(3.dp))
            Text(u.title, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = Brand.White, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(3.dp))
            Text(u.excerpt, style = Type.Meta.copy(fontSize = 13.sp, lineHeight = 18.sp), color = Brand.Text2, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
    }
}
