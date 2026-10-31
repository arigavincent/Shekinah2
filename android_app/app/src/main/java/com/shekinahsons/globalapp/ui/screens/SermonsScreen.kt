package com.shekinahsons.globalapp.ui.screens

import android.content.Intent
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
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
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import com.shekinahsons.globalapp.ui.components.scrollEntrance
import com.shekinahsons.globalapp.ui.components.RecapTile
import com.shekinahsons.globalapp.ui.components.glass
import com.shekinahsons.globalapp.ui.components.lifted
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Sort
import androidx.compose.material.icons.outlined.DownloadForOffline
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.DownloadDone
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.GraphicEq
import androidx.compose.material.icons.rounded.Menu
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.R
import com.shekinahsons.globalapp.data.Clip
import com.shekinahsons.globalapp.data.HomeContent
import com.shekinahsons.globalapp.data.Library
import com.shekinahsons.globalapp.data.Sermon
import com.shekinahsons.globalapp.ui.components.AudioCover
import com.shekinahsons.globalapp.ui.components.FadeImage
import com.shekinahsons.globalapp.ui.components.NavBarHeight
import com.shekinahsons.globalapp.ui.components.SermonPoster
import com.shekinahsons.globalapp.ui.components.pressable
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Type

private val tabs = listOf("Video", "Audio", "Categories", "Recaps")
private enum class Sort(val label: String) { Newest("Newest first"), Oldest("Oldest first"), Title("Title A–Z") }
private enum class Shelf { All, Saved, Downloaded }

private fun Sermon.matches(q: String) = q.isBlank() || listOf(title, speaker, category, code, description).any { it.contains(q, ignoreCase = true) }

// The API lists newest first, so "oldest" is simply the reverse.
private fun List<Sermon>.sorted(sort: Sort) = when (sort) {
    Sort.Newest -> this
    Sort.Oldest -> reversed()
    Sort.Title -> sortedBy { it.title.lowercase() }
}

@Composable
fun SermonsScreen(
    content: HomeContent,
    library: Library,
    initialTab: String,
    initialCategory: String?,
    openMenu: () -> Unit,
    openVideo: (Sermon, List<Sermon>) -> Unit,
    openAudio: (Sermon, List<Sermon>) -> Unit,
    openClip: (Clip) -> Unit,
) {
    var tab by rememberSaveable { mutableStateOf(initialTab) }
    var query by rememberSaveable { mutableStateOf("") }
    var sort by rememberSaveable { mutableStateOf(Sort.Newest) }
    var shelf by rememberSaveable { mutableStateOf(Shelf.All) }
    var category by rememberSaveable { mutableStateOf(initialCategory) }

    Column(Modifier.fillMaxSize().background(Brand.Black)) {
        Row(Modifier.fillMaxWidth().statusBarsPadding().height(60.dp).padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(48.dp).clip(CircleShape).clickable(onClick = openMenu), contentAlignment = Alignment.Center) {
                Icon(Icons.Rounded.Menu, "Menu", tint = Brand.White, modifier = Modifier.size(28.dp))
            }
            Spacer(Modifier.width(10.dp))
            Image(painterResource(R.drawable.dove_mark), "Shekinah Sons Global", Modifier.size(40.dp))
            Spacer(Modifier.weight(1f))
            ShelfButton(if (shelf == Shelf.Downloaded) Icons.Rounded.DownloadDone else Icons.Rounded.Download, "Downloads", shelf == Shelf.Downloaded) {
                shelf = if (shelf == Shelf.Downloaded) Shelf.All else Shelf.Downloaded
            }
            ShelfButton(if (shelf == Shelf.Saved) Icons.Rounded.Favorite else Icons.Outlined.FavoriteBorder, "Saved", shelf == Shelf.Saved) {
                shelf = if (shelf == Shelf.Saved) Shelf.All else Shelf.Saved
            }
        }
        UnderlineTabs(tab) { tab = it; if (it != "Video") category = null }

        val searchable = tab != "Categories"
        if (searchable) {
            SearchBox(query, if (tab == "Video") "Search videos..." else if (tab == "Audio") "Search all sermons..." else "Search recaps...", sort, onSort = { sort = it }) { query = it }
        }
        val chips = listOfNotNull(
            category?.let { it to { category = null } },
            when (shelf) { Shelf.Saved -> "Saved" to { shelf = Shelf.All }; Shelf.Downloaded -> "Downloaded" to { shelf = Shelf.All }; else -> null },
        )
        if (chips.isNotEmpty() && searchable) {
            Row(Modifier.padding(horizontal = 16.dp).padding(bottom = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                chips.forEach { (label, clear) -> FilterChip(label, clear) }
            }
        }

        fun List<Sermon>.shelved() = when (shelf) {
            Shelf.All -> this
            Shelf.Saved -> filter { library.isSaved(it.id) }
            Shelf.Downloaded -> filter { library.isDownloaded(it) }
        }

        AnimatedContent(tab, transitionSpec = { fadeIn() togetherWith fadeOut() }, label = "tab") { t ->
            when (t) {
                "Audio" -> {
                    val list = content.audioSermons.filter { it.matches(query) }.shelved().sorted(sort)
                    val state = rememberLazyListState()
                    LazyColumn(state = state, contentPadding = PaddingValues(bottom = NavBarHeight + 110.dp)) {
                        itemsIndexed(list, key = { _, it -> it.id }) { i, s -> AudioRow(s, library, Modifier.scrollEntrance(state, i)) { openAudio(s, list) } }
                        if (list.isEmpty()) item { EmptyNote(shelf, "No audio sermons found") }
                    }
                }
                "Categories" -> CategoriesGrid(content) { name -> category = name; tab = "Video" }
                "Recaps" -> {
                    val list = content.clips.filter { query.isBlank() || it.title.contains(query, true) }
                    LazyVerticalGrid(
                        GridCells.Fixed(2),
                        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 6.dp, bottom = NavBarHeight + 110.dp),
                        horizontalArrangement = Arrangement.spacedBy(14.dp), verticalArrangement = Arrangement.spacedBy(14.dp),
                    ) {
                        items(list, key = { it.id }) { c ->
                            RecapTile(c, Modifier.fillMaxWidth().aspectRatio(3 / 4f)) { openClip(c) }
                        }
                    }
                }
                else -> {
                    val list = content.videoSermons.filter { it.matches(query) && (category == null || it.category.equals(category, true)) }.shelved().sorted(sort)
                    val state = rememberLazyListState()
                    LazyColumn(state = state, contentPadding = PaddingValues(bottom = NavBarHeight + 110.dp)) {
                        itemsIndexed(list, key = { _, it -> it.id }) { i, s -> VideoRow(s, Modifier.scrollEntrance(state, i)) { openVideo(s, list) } }
                        if (list.isEmpty()) item { EmptyNote(shelf, "No sermons found") }
                    }
                }
            }
        }
    }
}

@Composable
private fun ShelfButton(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, on: Boolean, onClick: () -> Unit) {
    Box(Modifier.size(46.dp).clip(CircleShape).clickable(onClick = onClick), contentAlignment = Alignment.Center) {
        Icon(icon, label, tint = if (on) Brand.Gold else Brand.White, modifier = Modifier.size(26.dp))
    }
}

@Composable
private fun UnderlineTabs(selected: String, onSelect: (String) -> Unit) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
            tabs.forEach { t ->
                val on = t == selected
                val bar by animateDpAsState(if (on) 28.dp else 0.dp, label = "bar")
                Column(
                    Modifier.clip(RoundedCornerShape(8.dp)).clickable { onSelect(t) }.padding(horizontal = 8.dp, vertical = 10.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(t, color = if (on) Brand.Gold else Brand.Text2, fontFamily = Inter, fontWeight = if (on) FontWeight.SemiBold else FontWeight.Medium, fontSize = 15.sp)
                    Spacer(Modifier.height(8.dp))
                    Box(Modifier.width(bar).height(3.dp).background(Brand.GoldGradient, RoundedCornerShape(2.dp)))
                }
            }
        }
        HorizontalDivider(color = Brand.Line)
    }
}

@Composable
private fun SearchBox(query: String, hint: String, sort: Sort, onSort: (Sort) -> Unit, onChange: (String) -> Unit) {
    var menu by remember { mutableStateOf(false) }
    Row(
        Modifier.padding(horizontal = 16.dp, vertical = 14.dp).fillMaxWidth().height(52.dp)
            .glass(com.shekinahsons.globalapp.ui.components.GlassShape, 0.8f).padding(start = 18.dp, end = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Rounded.Search, null, tint = Brand.Text2, modifier = Modifier.size(22.dp))
        Spacer(Modifier.width(12.dp))
        Box(Modifier.weight(1f)) {
            if (query.isEmpty()) Text(hint, style = Type.Body, color = Brand.Muted)
            BasicTextField(query, onChange, singleLine = true, textStyle = Type.Body.copy(color = Brand.White), cursorBrush = SolidColor(Brand.Gold), modifier = Modifier.fillMaxWidth())
        }
        if (query.isNotEmpty()) {
            Icon(Icons.Rounded.Close, "Clear search", tint = Brand.Muted, modifier = Modifier.size(40.dp).clip(CircleShape).clickable { onChange("") }.padding(9.dp))
        }
        Box {
            Icon(
                Icons.AutoMirrored.Rounded.Sort, "Sort", tint = if (sort != Sort.Newest) Brand.Gold else Brand.Text2,
                modifier = Modifier.size(40.dp).clip(CircleShape).clickable { menu = true }.padding(9.dp),
            )
            DropdownMenu(menu, onDismissRequest = { menu = false }, containerColor = Brand.Surface2) {
                Sort.entries.forEach { s ->
                    DropdownMenuItem(
                        text = { Text(s.label, color = if (s == sort) Brand.Gold else Brand.White, fontFamily = Inter) },
                        onClick = { onSort(s); menu = false },
                    )
                }
            }
        }
    }
}

@Composable
private fun FilterChip(label: String, onClear: () -> Unit) {
    Row(
        Modifier.clip(RoundedCornerShape(50)).background(Color(0x26D4AF37)).clickable(onClick = onClear).padding(start = 12.dp, end = 8.dp, top = 6.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, color = Brand.GoldLight, fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 13.sp)
        Spacer(Modifier.width(4.dp))
        Icon(Icons.Rounded.Close, "Clear $label", tint = Brand.GoldLight, modifier = Modifier.size(16.dp))
    }
}

@Composable
private fun EmptyNote(shelf: Shelf, fallback: String) {
    val text = when (shelf) {
        Shelf.Saved -> "Tap the heart on a sermon to save it here."
        Shelf.Downloaded -> "Download a sermon to listen without data."
        Shelf.All -> fallback
    }
    Text(text, style = Type.Body, color = Brand.Muted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(48.dp))
}

@Composable
private fun VideoRow(s: Sermon, modifier: Modifier, onOpen: () -> Unit) {
    Column(modifier.fillMaxWidth().pressable(onOpen)) {
        Row(Modifier.padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            SermonPoster(s, Modifier.width(128.dp).aspectRatio(16 / 10.5f).lifted(RoundedCornerShape(12.dp), 10.dp).clip(RoundedCornerShape(12.dp)), compact = true)
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    listOf(s.title, s.speaker).filter { it.isNotBlank() }.joinToString(" | "),
                    fontFamily = Inter, fontSize = 15.5.sp, lineHeight = 21.sp, color = Brand.White, maxLines = 3, overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(6.dp))
                Text(listOf(s.date, s.duration).filter { it.isNotBlank() }.joinToString("  •  "), fontFamily = Inter, fontSize = 13.5.sp, color = Brand.Text2)
                if(s.replayId.isNotBlank())Text(if(s.status!="ready")"Preparing replay…" else if(s.price>0)"KSh ${s.price} · Replay" else "Free replay",style=Type.Meta,color=Brand.Gold)
            }
        }
        HorizontalDivider(color = Brand.Line, modifier = Modifier.padding(horizontal = 16.dp))
    }
}

@Composable
private fun AudioRow(s: Sermon, library: Library, modifier: Modifier, onOpen: () -> Unit) {
    val context = LocalContext.current
    var more by remember { mutableStateOf(false) }
    val saved = library.isSaved(s.id)
    val busy = s.id in library.downloading
    val done = !busy && library.isDownloaded(s)
    Column(modifier.fillMaxWidth()) {
        Row(Modifier.clickable(onClick = onOpen).padding(start = 16.dp, end = 8.dp, top = 12.dp, bottom = 4.dp)) {
            AudioCover(s, Modifier.size(84.dp).lifted(RoundedCornerShape(12.dp), 10.dp, com.shekinahsons.globalapp.ui.components.audioGlowColor(s)).clip(RoundedCornerShape(12.dp)))
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(s.title, fontFamily = Inter, fontSize = 15.5.sp, lineHeight = 21.sp, color = Brand.White, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.GraphicEq, null, tint = Brand.Gold, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(listOf(s.duration, s.date).filter { it.isNotBlank() }.joinToString("  •  "), fontFamily = Inter, fontSize = 13.sp, color = Brand.Text2)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(44.dp).clip(CircleShape).clickable(enabled = !busy) { if (done) library.delete(s) else library.download(s) }, contentAlignment = Alignment.Center) {
                        when {
                            busy -> CircularProgressIndicator(progress = { library.downloading[s.id] ?: 0f }, color = Brand.Gold, trackColor = Color(0x33FFFFFF), strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                            done -> Icon(Icons.Rounded.DownloadDone, "Downloaded, tap to remove", tint = Brand.Gold, modifier = Modifier.size(24.dp))
                            else -> Icon(Icons.Outlined.DownloadForOffline, "Download", tint = Brand.Text2, modifier = Modifier.size(24.dp))
                        }
                    }
                    Box(Modifier.size(44.dp).clip(CircleShape).clickable { library.toggleSaved(s.id) }, contentAlignment = Alignment.Center) {
                        Icon(if (saved) Icons.Rounded.Favorite else Icons.Outlined.FavoriteBorder, if (saved) "Remove from saved" else "Save", tint = if (saved) Brand.Red else Brand.Text2, modifier = Modifier.size(23.dp))
                    }
                    Box {
                        Box(Modifier.size(44.dp).clip(CircleShape).clickable { more = true }, contentAlignment = Alignment.Center) {
                            Icon(Icons.Rounded.MoreVert, "More", tint = Brand.Text2, modifier = Modifier.size(22.dp))
                        }
                        DropdownMenu(more, onDismissRequest = { more = false }, containerColor = Brand.Surface2) {
                            DropdownMenuItem(text = { Text("Play", color = Brand.White, fontFamily = Inter) }, onClick = { more = false; onOpen() })
                            DropdownMenuItem(text = { Text("Share", color = Brand.White, fontFamily = Inter) }, onClick = {
                                more = false
                                val send = Intent(Intent.ACTION_SEND).setType("text/plain")
                                    .putExtra(Intent.EXTRA_TEXT, "${s.title} — ${s.speaker}\n${s.mediaUrl}\n\nShekinah Sons Global")
                                context.startActivity(Intent.createChooser(send, "Share sermon"))
                            })
                        }
                    }
                }
            }
        }
        HorizontalDivider(color = Brand.Line, modifier = Modifier.padding(horizontal = 16.dp))
    }
}

@Composable
private fun CategoriesGrid(content: HomeContent, onPick: (String) -> Unit) {
    // Counts come from the sermons themselves so they always match the list.
    val counts = content.videoSermons.groupingBy { it.category }.eachCount()
    val names = (content.categories.map { it.name } + counts.keys).filter { it.isNotBlank() }.distinct()
    val palettes = listOf(
        listOf(Color(0xFF5A4512), Color(0xFF1A140A)),
        listOf(Color(0xFF1E3D8F), Color(0xFF0B1430)),
        listOf(Color(0xFF7A1E2B), Color(0xFF220A10)),
        listOf(Color(0xFF155E4B), Color(0xFF07201A)),
    )
    LazyVerticalGrid(
        GridCells.Fixed(2),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = NavBarHeight + 110.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        items(names.size) { i ->
            val name = names[i]
            Box(
                Modifier.fillMaxWidth().aspectRatio(1.5f).clip(RoundedCornerShape(16.dp))
                    .background(Brush.linearGradient(palettes[i % palettes.size]))
                    .border(1.dp, Color(0x1FFFFFFF), RoundedCornerShape(16.dp))
                    .pressable { onPick(name) }.padding(14.dp),
            ) {
                Image(painterResource(R.drawable.dove_mark), null, Modifier.align(Alignment.TopEnd).size(30.dp), alpha = 0.5f)
                Column(Modifier.align(Alignment.BottomStart)) {
                    Text(name, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 17.sp, color = Brand.White)
                    val n = counts[name] ?: 0
                    Text(if (n == 1) "1 sermon" else "$n sermons", style = Type.Meta, color = Color(0xCCFFFFFF))
                }
            }
        }
    }
}
