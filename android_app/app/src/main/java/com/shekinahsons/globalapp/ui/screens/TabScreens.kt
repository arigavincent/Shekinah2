package com.shekinahsons.globalapp.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.MenuBook
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.TextDecrease
import androidx.compose.material.icons.rounded.TextIncrease
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.data.Clip
import com.shekinahsons.globalapp.data.Devotion
import com.shekinahsons.globalapp.data.HomeContent
import com.shekinahsons.globalapp.data.Sermon
import com.shekinahsons.globalapp.ui.components.AmbientGlow
import com.shekinahsons.globalapp.ui.components.Breathing
import com.shekinahsons.globalapp.ui.components.ColorGlow
import com.shekinahsons.globalapp.ui.components.FadeImage
import com.shekinahsons.globalapp.ui.components.NavBarHeight
import com.shekinahsons.globalapp.ui.components.TopBar
import com.shekinahsons.globalapp.ui.components.pressable
import com.shekinahsons.globalapp.ui.components.outset
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Scripture
import com.shekinahsons.globalapp.ui.theme.Type

private val bottomGap = NavBarHeight + 110.dp

@Composable
private fun ScreenTitle(title: String, subtitle: String? = null) {
    Column(Modifier.padding(horizontal = 20.dp, vertical = 4.dp)) {
        Text(title, style = Type.Display, color = Brand.White)
        if (subtitle != null) Text(subtitle, style = Type.Meta.copy(fontSize = 13.5.sp), color = Brand.Text2)
    }
}

@Composable
private fun Segments(options: List<String>, selected: String, onSelect: (String) -> Unit) {
    LazyRow(contentPadding = PaddingValues(horizontal = 20.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(options) { o ->
            val on = o == selected
            Text(
                o, color = if (on) Brand.Black else Brand.White, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 14.sp,
                modifier = Modifier.clip(RoundedCornerShape(50))
                    .background(if (on) Brand.GoldGradient else SolidColor(Brand.Surface2))
                    .clickable { onSelect(o) }
                    .padding(horizontal = 18.dp, vertical = 9.dp),
            )
        }
    }
}

@Composable
private fun SearchField(query: String, onChange: (String) -> Unit) {
    Row(
        Modifier.padding(horizontal = 20.dp, vertical = 14.dp).fillMaxWidth().height(48.dp)
            .clip(RoundedCornerShape(50)).background(Brand.Surface2).padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Rounded.Search, null, tint = Brand.Muted, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(10.dp))
        Box(Modifier.weight(1f)) {
            if (query.isEmpty()) Text("Search sermons, speakers, topics", style = Type.Body, color = Brand.Muted)
            BasicTextField(query, onChange, singleLine = true, textStyle = Type.Body.copy(color = Brand.White), cursorBrush = SolidColor(Brand.Gold), modifier = Modifier.fillMaxWidth())
        }
        if (query.isNotEmpty()) Icon(Icons.Rounded.Close, "Clear", tint = Brand.Muted, modifier = Modifier.size(20.dp).clickable { onChange("") })
    }
}

private fun Sermon.matches(q: String) = q.isBlank() || listOf(title, speaker, category, code, description).any { it.contains(q, ignoreCase = true) }

@Composable
fun SermonsScreen(
    content: HomeContent,
    initialTab: String,
    openVideo: (Sermon, List<Sermon>) -> Unit,
    openAudio: (Sermon, List<Sermon>) -> Unit,
    openClip: (Clip) -> Unit,
) {
    var tab by rememberSaveable { mutableStateOf(initialTab) }
    var query by rememberSaveable { mutableStateOf("") }
    Column(Modifier.fillMaxSize().background(Brand.Black)) {
        TopBar()
        ScreenTitle("Sermons", "Messages to watch, hear and share")
        SearchField(query) { query = it }
        Segments(listOf("Video", "Audio", "Recaps"), tab) { tab = it }
        Spacer(Modifier.height(10.dp))
        AnimatedContent(tab, transitionSpec = { fadeIn() togetherWith fadeOut() }, label = "tab") { t ->
            when (t) {
                "Audio" -> {
                    val list = content.audioSermons.filter { it.matches(query) }
                    LazyColumn(contentPadding = PaddingValues(bottom = bottomGap)) {
                        items(list, key = { it.id }) { s -> SermonRow(s, audio = true) { openAudio(s, list) } }
                        if (list.isEmpty()) item { Empty("No audio sermons found") }
                    }
                }
                "Recaps" -> {
                    val list = content.clips.filter { query.isBlank() || it.title.contains(query, true) }
                    LazyVerticalGrid(GridCells.Fixed(2), contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 6.dp, bottom = bottomGap), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        items(list, key = { it.id }) { c ->
                            Box(Modifier.fillMaxWidth().aspectRatio(9 / 14f).clip(RoundedCornerShape(16.dp)).pressable { openClip(c) }) {
                                FadeImage(c.image, Modifier.fillMaxSize())
                                Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0.5f to Color.Transparent, 1f to Color(0xF0000000))))
                                Text(c.title, color = Color.White, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, maxLines = 3, overflow = TextOverflow.Ellipsis, modifier = Modifier.align(Alignment.BottomStart).padding(10.dp))
                            }
                        }
                    }
                }
                else -> {
                    val list = content.videoSermons.filter { it.matches(query) }
                    LazyColumn(contentPadding = PaddingValues(bottom = bottomGap)) {
                        items(list, key = { it.id }) { s -> SermonRow(s) { openVideo(s, list) } }
                        if (list.isEmpty()) item { Empty("No sermons found") }
                    }
                }
            }
        }
    }
}

@Composable
private fun Empty(text: String) {
    Text(text, style = Type.Body, color = Brand.Muted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(48.dp))
}

@Composable
fun DevotionsScreen(content: HomeContent, open: (Devotion) -> Unit) {
    LazyColumn(Modifier.fillMaxSize().background(Brand.Black), contentPadding = PaddingValues(bottom = bottomGap)) {
        item { TopBar() }
        item { ScreenTitle("Devotions", "A word for every day") }
        items(content.devotions, key = { it.id }) { d ->
            Column(Modifier.padding(horizontal = 20.dp, vertical = 10.dp).fillMaxWidth().pressable { open(d) }) {
                Box {
                    AmbientGlow(d.imageUrl, Modifier.matchParentSize().outset(4.dp, drop = 14.dp), blur = 26.dp, alpha = 0.7f)
                    FadeImage(d.imageUrl, Modifier.fillMaxWidth().aspectRatio(2f).clip(RoundedCornerShape(18.dp)))
                }
                Spacer(Modifier.height(12.dp))
                Text(d.date.uppercase(), style = Type.Label, color = Brand.Gold)
                Spacer(Modifier.height(4.dp))
                Text(d.title, style = Type.Title, color = Brand.White)
                Spacer(Modifier.height(4.dp))
                Text(d.excerpt, style = Type.Body.copy(fontSize = 14.sp, lineHeight = 21.sp), color = Brand.Text2, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

@Composable
fun DevotionReader(d: Devotion, onBack: () -> Unit) {
    var scale by rememberSaveable { mutableFloatStateOf(1f) }
    Box(Modifier.fillMaxSize().background(Brand.Black)) {
        Box(Modifier.fillMaxWidth().height(520.dp).clipToBounds()) {
            AmbientGlow(d.imageUrl, Modifier.fillMaxSize(), blur = 70.dp, alpha = 0.85f)
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color(0x44000000), 1f to Brand.Black)))
        }
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 60.dp)) {
            item {
                TopBar(title = "", onBack = onBack) {
                    Row {
                        Icon(Icons.Rounded.TextDecrease, "Smaller text", tint = Brand.White, modifier = Modifier.size(40.dp).clip(CircleShape).clickable { scale = (scale - 0.1f).coerceAtLeast(0.8f) }.padding(9.dp))
                        Icon(Icons.Rounded.TextIncrease, "Larger text", tint = Brand.White, modifier = Modifier.size(40.dp).clip(CircleShape).clickable { scale = (scale + 0.1f).coerceAtMost(1.6f) }.padding(9.dp))
                    }
                }
            }
            item {
                Box(Modifier.padding(horizontal = 20.dp)) {
                    AmbientGlow(d.imageUrl, Modifier.matchParentSize().outset(4.dp, drop = 16.dp), blur = 30.dp)
                    FadeImage(d.imageUrl, Modifier.fillMaxWidth().aspectRatio(1.5f).clip(RoundedCornerShape(22.dp)))
                }
            }
            item {
                Column(Modifier.padding(horizontal = 24.dp, vertical = 22.dp)) {
                    Text(d.date.uppercase(), style = Type.Label, color = Brand.Gold)
                    Spacer(Modifier.height(8.dp))
                    Text(d.title, style = Type.Display.copy(fontSize = (26 * scale).sp, lineHeight = (32 * scale).sp), color = Brand.White)
                    Spacer(Modifier.height(18.dp))
                    Text(d.body.ifBlank { d.excerpt }, style = Type.Body.copy(fontSize = (17 * scale).sp, lineHeight = (28 * scale).sp), color = Color(0xFFE6E6EA))
                }
            }
        }
    }
}

@Composable
fun LiveScreen(content: HomeContent) {
    val live = content.live
    val glow = Breathing(3600, 0.45f, 1f)
    Column(Modifier.fillMaxSize().background(Brand.Black)) {
        TopBar()
        ScreenTitle("Live", if (live.isLive) "We are live right now" else "Join us for the next service")
        Spacer(Modifier.height(20.dp))
        Box(Modifier.padding(horizontal = 20.dp)) {
            ColorGlow((if (live.isLive) Brand.Red else Brand.Gold).copy(alpha = 0.45f * glow), Modifier.matchParentSize().padding(10.dp), blur = 40.dp)
            Box(
                Modifier.fillMaxWidth().aspectRatio(16 / 10f).clip(RoundedCornerShape(22.dp))
                    .background(Brush.linearGradient(listOf(Color(0xFF241B06), Color(0xFF0B0B0D), Color(0xFF0B1630))))
                    .border(1.dp, Brand.Gold.copy(alpha = 0.35f), RoundedCornerShape(22.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(24.dp)) {
                    Text(if (live.isLive) "ON AIR" else "NEXT SERVICE", style = Type.Label, color = if (live.isLive) Brand.Red else Brand.Gold)
                    Spacer(Modifier.height(10.dp))
                    Text(if (live.isLive) live.title.ifBlank { "Live Service" } else live.nextService.ifBlank { "Sunday Service" }, style = Type.Display, color = Brand.White, textAlign = TextAlign.Center)
                    Spacer(Modifier.height(8.dp))
                    Text("Services stream here live. You will get a notification when we go on air.", style = Type.Meta.copy(fontSize = 13.sp), color = Brand.Text2, textAlign = TextAlign.Center)
                }
            }
        }
    }
}

@Composable
fun BibleScreen(content: HomeContent) {
    val s = content.scripture
    Column(Modifier.fillMaxSize().background(Brand.Black)) {
        TopBar()
        ScreenTitle("Bible", "Read, listen and highlight")
        Spacer(Modifier.height(20.dp))
        Column(
            Modifier.padding(horizontal = 20.dp).fillMaxWidth().clip(RoundedCornerShape(22.dp))
                .background(Brush.linearGradient(listOf(Color(0xFF231B08), Color(0xFF0E1526)))).padding(24.dp),
        ) {
            Icon(Icons.AutoMirrored.Rounded.MenuBook, null, tint = Brand.Gold, modifier = Modifier.size(30.dp))
            Spacer(Modifier.height(14.dp))
            Text("“${s.verse}”", style = TextStyle(fontFamily = Scripture, fontSize = 21.sp, lineHeight = 30.sp), color = Brand.White)
            Spacer(Modifier.height(10.dp))
            Text(s.reference, color = Brand.GoldLight, fontFamily = Inter, fontWeight = FontWeight.SemiBold)
        }
        Spacer(Modifier.height(16.dp))
        Text("The full Bible reader is being moved over from the old app next.", style = Type.Meta, color = Brand.Muted, modifier = Modifier.padding(horizontal = 24.dp))
    }
}
