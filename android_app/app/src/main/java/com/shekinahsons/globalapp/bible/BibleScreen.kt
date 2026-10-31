package com.shekinahsons.globalapp.bible

import android.content.ClipData
import android.content.ClipboardManager
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
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
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.VolumeUp
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.rounded.Bookmark
import androidx.compose.material.icons.rounded.MoreHoriz
import androidx.compose.material.icons.rounded.RecordVoiceOver
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.SkipNext
import androidx.compose.material.icons.rounded.SkipPrevious
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Compare
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.EditNote
import androidx.compose.material.icons.rounded.ExpandMore
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.FormatColorReset
import androidx.compose.material.icons.rounded.LibraryBooks
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material.icons.rounded.Stop
import androidx.compose.material.icons.rounded.TextFields
import androidx.compose.material.icons.rounded.ViewColumn
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.BaselineShift
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.BuildConfig
import com.shekinahsons.globalapp.data.Api
import com.shekinahsons.globalapp.extras.VerseImage
import com.shekinahsons.globalapp.ui.components.Field
import com.shekinahsons.globalapp.ui.components.NavBarHeight
import com.shekinahsons.globalapp.ui.components.TopBar
import com.shekinahsons.globalapp.ui.components.glass
import com.shekinahsons.globalapp.ui.components.lifted
import com.shekinahsons.globalapp.ui.components.pressable
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Scripture
import com.shekinahsons.globalapp.ui.theme.Type
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import okhttp3.Request
import java.util.zip.ZipInputStream

// Where the Bible should open next (a reading plan or Home's verse of the day).
object BibleLink {
    var pending: Triple<Int, Int, Int>? = null

    // "Matthew 6:6", "Psalm 23", "1 John 4:19" -> book, chapter, verse.
    fun parse(bible: BibleDb, reference: String): Triple<Int, Int, Int>? {
        val m = Regex("""^\s*(.+?)\s+(\d+)(?::(\d+))?""").find(reference) ?: return null
        val name = m.groupValues[1]
        val book = bible.findBook(name) ?: bible.findBook(if (name.equals("Psalm", true)) "Psalms" else name + "s") ?: return null
        return Triple(book.id, m.groupValues[2].toInt(), m.groupValues[3].toIntOrNull() ?: 1)
    }
}

private sealed interface View {
    data object Books : View
    data class Chapters(val book: Book) : View
    data class Verses(val book: Book, val chapter: Int) : View
    data class Reader(val book: Book, val chapter: Int, val verse: Int) : View
    data object Library : View
    data object Search : View
}

private val highlightColors = listOf(
    "gold" to Color(0x59D4AF37), "blue" to Color(0x594A8BFF), "green" to Color(0x594ADE80), "pink" to Color(0x59F07EB5), "purple" to Color(0x59B98CFF),
)
private fun highlightOf(name: String?) = highlightColors.firstOrNull { it.first == name }?.second

@Composable
fun BibleScreen() {
    val context = LocalContext.current
    val bible = remember { BibleDb.get(context) }
    val store = remember(com.shekinahsons.globalapp.data.Accounts.current) { BibleStore(context) }
    var view by remember { mutableStateOf<View>(View.Books) }

    // Opened from elsewhere at a reference.
    LaunchedEffect(Unit) {
        BibleLink.pending?.let { (b, c, v) -> bible.book(b)?.let { view = View.Reader(it, c, v) } }
        BibleLink.pending = null
    }
    BackHandler(enabled = view != View.Books) {
        view = when (val v = view) {
            is View.Verses -> View.Chapters(v.book)
            is View.Reader -> View.Books
            else -> View.Books
        }
    }

    AnimatedContent(view, transitionSpec = { fadeIn() togetherWith fadeOut() }, label = "bible", modifier = Modifier.fillMaxSize().background(Brand.Black)) { v ->
        when (v) {
            View.Books -> BooksView(bible, store, open = { view = it })
            is View.Chapters -> NumberGrid(
                title = "${v.book.swahili} ~ ${v.book.english}", label = "Select a chapter", count = bible.chapterCount(v.book.id),
                onBack = { view = View.Books }, pick = { view = View.Verses(v.book, it) },
            )
            is View.Verses -> NumberGrid(
                title = "${v.book.english} ${v.chapter}", label = "Select a verse", count = bible.verseCount(v.book.id, v.chapter),
                onBack = { view = View.Chapters(v.book) }, pick = { view = View.Reader(v.book, v.chapter, it) },
            )
            is View.Reader -> Reader(bible, store, v.book, v.chapter, v.verse, onBack = { view = View.Books }, openLibrary = { view = View.Library }, openSearch = { view = View.Search })
            View.Library -> LibraryView(bible, store, onBack = { view = View.Books }, open = { view = it })
            View.Search -> SearchView(bible, onBack = { view = View.Books }, open = { view = it })
        }
    }
}

@Composable
private fun BooksView(bible: BibleDb, store: BibleStore, open: (View) -> Unit) {
    var tab by remember { mutableStateOf("All") }
    val books = remember { bible.books() }
    val shown = when (tab) { "Old" -> books.filter { it.testament == "OT" }; "New" -> books.filter { it.testament == "NT" }; else -> books }
    Column(Modifier.fillMaxSize()) {
        TopBar {
            Row {
                Icon(Icons.Rounded.Search, "Search the Bible", tint = Brand.White, modifier = Modifier.size(44.dp).clip(CircleShape).clickable { open(View.Search) }.padding(10.dp))
                Icon(Icons.Rounded.LibraryBooks, "Bible library", tint = Brand.White, modifier = Modifier.size(44.dp).clip(CircleShape).clickable { open(View.Library) }.padding(10.dp))
            }
        }
        LazyVerticalGrid(GridCells.Fixed(2), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = NavBarHeight + 40.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item(span = { GridItemSpan(2) }) {
                Column {
                    Text("Holy Bible", style = Type.Display, color = Brand.White)
                    Text("Biblia Takatifu · offline", style = Type.Meta, color = Brand.GoldLight)
                }
            }
            store.state.last?.let { last -> bible.book(last.bookId)?.let { b ->
                item(span = { GridItemSpan(2) }) {
                    Row(
                        Modifier.fillMaxWidth().lifted(RoundedCornerShape(20.dp), 12.dp).clip(RoundedCornerShape(20.dp))
                            .background(Brush.linearGradient(listOf(Color(0xFF3A2C0A), Color(0xFF15120A), Color(0xFF0E1A3A))))
                            .border(1.dp, Color(0x40D4AF37), RoundedCornerShape(20.dp)).clickable { open(View.Reader(b, last.chapter, 1)) }.padding(18.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text("CONTINUE READING", style = Type.Label.copy(fontSize = 10.sp), color = Brand.Gold)
                            Text("${b.english} ${last.chapter}", style = Type.Title, color = Brand.White)
                            Text("${b.swahili} ${last.chapter}", style = Type.Meta, color = Brand.Text2)
                        }
                        Icon(Icons.Rounded.ViewColumn, null, tint = Brand.GoldLight, modifier = Modifier.size(28.dp))
                    }
                }
            } }
            item(span = { GridItemSpan(2) }) {
                Row(Modifier.fillMaxWidth().glass(com.shekinahsons.globalapp.ui.components.GlassShape, 0.8f).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    listOf("All" to "All Books", "Old" to "Old Testament", "New" to "New Testament").forEach { (key, label) ->
                        val on = tab == key
                        Box(Modifier.weight(1f).height(38.dp).clip(RoundedCornerShape(50)).background(if (on) Brand.GoldGradient else SolidColor(Color.Transparent)).clickable { tab = key }, contentAlignment = Alignment.Center) {
                            Text(label, color = if (on) Brand.Black else Brand.Text2, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 12.5.sp, maxLines = 1)
                        }
                    }
                }
            }
            items(shown, key = { it.id }) { b ->
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Brush.linearGradient(listOf(Color(0xFF17150F), Color(0xFF111114))))
                        .border(1.dp, Color(0x14FFFFFF), RoundedCornerShape(16.dp)).pressable { open(View.Chapters(b)) }.padding(horizontal = 14.dp, vertical = 12.dp),
                ) {
                    Text(b.english, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = Brand.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(b.swahili, style = Type.Meta, color = Brand.GoldLight, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }
    }
}

@Composable
private fun NumberGrid(title: String, label: String, count: Int, onBack: () -> Unit, pick: (Int) -> Unit) {
    Column(Modifier.fillMaxSize()) {
        TopBar(title = title, onBack = onBack)
        Text(label, style = Type.Title, color = Brand.White, modifier = Modifier.padding(horizontal = 18.dp, vertical = 6.dp))
        LazyVerticalGrid(GridCells.Fixed(5), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = NavBarHeight + 40.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items((1..count).toList()) { n ->
                Box(Modifier.aspectRatio(1f).glass(RoundedCornerShape(16.dp), 0.8f).clickable { pick(n) }, contentAlignment = Alignment.Center) {
                    Text("$n", fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 17.sp, color = Brand.White)
                }
            }
        }
    }
}

@Composable
private fun Reader(bible: BibleDb, store: BibleStore, book: Book, startChapter: Int, startVerse: Int, onBack: () -> Unit, openLibrary: () -> Unit, openSearch: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val chapters = remember(book.id) { bible.chapterCount(book.id) }
    val pager = rememberPagerState(initialPage = startChapter - 1) { chapters }
    val chapter = pager.currentPage + 1
    val versions = remember(store.version) { bible.versions() }
    val s = store.state.also { store.version }
    val narrator = remember { Narrator(context.applicationContext) }
    DisposableEffect(Unit) { onDispose { narrator.shutdown() } }
    // Which version is read aloud; in side-by-side either column can be chosen.
    var listenId by remember { mutableStateOf(if (s.sideBySide) s.right else s.single) }
    var readingChapter by remember { mutableStateOf(0) }
    var advancing by remember { mutableStateOf(false) }

    fun versionOf(id: String) = versions.firstOrNull { it.id == id }
    fun heading(id: String, ch: Int): String {
        val lang = versionOf(id)?.language.orEmpty()
        return if (lang.startsWith("sw")) "${book.swahili}, sura ya $ch." else "${book.english}, chapter $ch."
    }
    fun readChapter(ch: Int, from: Int) {
        val id = listenId
        readingChapter = ch
        scope.launch { narrator.readChapter(id,book.code,ch,versionOf(id)?.language ?: "en", heading(id, ch), bible.chapter(id, book.id, ch), from) {
            // Carry on into the next chapter, turning the page with it.
            if (ch < chapters) scope.launch {
                advancing = true
                pager.animateScrollToPage(ch)
                advancing = false
                readChapter(ch + 1, 1)
            } else narrator.stop()
        } }
    }

    LaunchedEffect(pager.settledPage) {
        store.visit(book.id, pager.settledPage + 1)
        // Swiping to another chapter by hand stops the reading.
        if (narrator.active && !advancing && pager.settledPage + 1 != readingChapter) narrator.stop()
    }
    val favourite = s.favourites.contains(Place(book.id, chapter))

    Box(Modifier.fillMaxSize()) {
    Column(Modifier.fillMaxSize()) {
        Row(Modifier.fillMaxWidth().statusBarsPadding().height(58.dp).padding(horizontal = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back", tint = Brand.White, modifier = Modifier.size(44.dp).clip(CircleShape).clickable(onClick = onBack).padding(10.dp))
            Column(Modifier.weight(1f).padding(start = 4.dp)) {
                Text("${book.english} $chapter", fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 17.sp, color = Brand.White, maxLines = 1)
                Text("${book.swahili} $chapter", style = Type.Meta, color = Brand.GoldLight, maxLines = 1)
            }
            Icon(if (favourite) Icons.Rounded.Favorite else Icons.Outlined.FavoriteBorder, "Favourite chapter", tint = if (favourite) Brand.Red else Brand.White,
                modifier = Modifier.size(42.dp).clip(CircleShape).clickable {
                    val p = Place(book.id, chapter)
                    store.update { st -> st.copy(favourites = if (p in st.favourites) st.favourites - p else listOf(p) + st.favourites) }
                }.padding(10.dp))
            Icon(if (narrator.active) Icons.Rounded.Stop else Icons.AutoMirrored.Rounded.VolumeUp, if (narrator.active) "Stop reading" else "Listen to this chapter", tint = if (narrator.active) Brand.Gold else Brand.White,
                modifier = Modifier.size(42.dp).clip(CircleShape).clickable {
                    if (narrator.active) narrator.stop() else readChapter(chapter, 1)
                }.padding(10.dp))
            Icon(Icons.Rounded.TextFields, "Text size", tint = Brand.White, modifier = Modifier.size(42.dp).clip(CircleShape).clickable {
                store.update { st -> st.copy(textScale = listOf(0.85f, 1f, 1.15f, 1.3f, 1.5f).let { l -> l[(l.indexOf(st.textScale).coerceAtLeast(0) + 1) % l.size] }) }
            }.padding(10.dp))
            Icon(Icons.Rounded.Search, "Search", tint = Brand.White, modifier = Modifier.size(42.dp).clip(CircleShape).clickable(onClick = openSearch).padding(10.dp))
        }
        // Reading mode: two versions side by side, or one.
        LazyRow(contentPadding = PaddingValues(horizontal = 14.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(bottom = 6.dp)) {
            item { ModeChip("Side by side", s.sideBySide) { store.update { it.copy(sideBySide = true) } } }
            items(versions, key = { it.id }) { v -> ModeChip(v.abbreviation, !s.sideBySide && s.single == v.id) { store.update { it.copy(sideBySide = false, single = v.id) }; listenId = v.id } }
            item { ModeChip("+ More", false) { openLibrary() } }
        }
        if (s.sideBySide) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 4.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ColumnPicker(versions, s.left, Modifier.weight(1f)) { id -> store.update { it.copy(left = id) } }
                ColumnPicker(versions, s.right, Modifier.weight(1f)) { id -> store.update { it.copy(right = id) } }
            }
        }
        HorizontalPager(pager, modifier = Modifier.weight(1f), beyondViewportPageCount = 1) { page ->
            val ch = page + 1
            ChapterPage(
                bible, store, book, ch, if (ch == startChapter) startVerse else 1,
                speaking = if (narrator.active && readingChapter == ch) narrator.verse else -1,
                listenOne = { n, id ->
                    listenId = id
                    bible.chapter(id, book.id, ch).firstOrNull { it.number == n }?.let { v -> readingChapter = ch; narrator.readOne(versionOf(id)?.language ?: "en", v) }
                },
                listenFrom = { n, id -> listenId = id; readChapter(ch, n) },
            )
        }
    }
    if (narrator.active) {
        ListenBar(
            narrator, Modifier.align(Alignment.BottomCenter),
            where = "${book.english} $readingChapter" + if (narrator.verse > 0) ":${narrator.verse}" else "",
            versionLabel = versionOf(listenId)?.abbreviation ?: "",
            switchVersion = if (s.sideBySide) ({
                listenId = if (listenId == s.right) s.left else s.right
                readChapter(readingChapter, narrator.verse.coerceAtLeast(1))
            }) else null,
        )
    }
    }
}

// The floating "now reading" bar: where we are, voice, speed and controls.
@Composable
private fun ListenBar(narrator: Narrator, modifier: Modifier, where: String, versionLabel: String, switchVersion: (() -> Unit)?) {
    val context = LocalContext.current
    var voiceMenu by remember { mutableStateOf(false) }
    val shape = RoundedCornerShape(22.dp)
    Column(
        modifier.navigationBarsPadding().padding(start = 12.dp, end = 12.dp, bottom = NavBarHeight + 10.dp).fillMaxWidth()
            .lifted(shape, 20.dp).clip(shape)
            .background(Brush.linearGradient(listOf(Color(0xF52A2210), Color(0xF5141418))))
            .border(1.dp, Brush.verticalGradient(listOf(Color(0x55F0D27A), Color(0x10FFFFFF))), shape)
            .padding(horizontal = 14.dp, vertical = 10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(if(narrator.recorded)"RECORDED NARRATION" else "DEVICE VOICE", style = Type.Label.copy(fontSize = 9.5.sp), color = Brand.Gold)
                Text(where, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = Brand.White, maxLines = 1)
            }
            if (versionLabel.isNotBlank()) {
                Text(versionLabel + if (switchVersion != null) " ⇄" else "", color = Brand.GoldLight, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 12.sp,
                    modifier = Modifier.glass().clickable(enabled = switchVersion != null) { switchVersion?.invoke() }.padding(horizontal = 10.dp, vertical = 5.dp))
            }
            Icon(Icons.Rounded.Close, "Stop reading", tint = Brand.Text2, modifier = Modifier.padding(start = 6.dp).size(34.dp).clip(CircleShape).clickable { narrator.stop() }.padding(6.dp))
        }
        if(narrator.recorded) Text(narrator.attribution,style=Type.Meta,color=Brand.Text2)
        if (narrator.missingLanguage) {
            Text("This phone has no voice for this language yet. Tap to add one in speech settings.", style = Type.Meta, color = Color(0xFFFFD58A),
                modifier = Modifier.padding(top = 6.dp).clickable {
                    runCatching { context.startActivity(android.content.Intent("com.android.settings.TTS_SETTINGS").addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)) }
                })
        }
        Spacer(Modifier.height(8.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box {
                Row(Modifier.glass().clickable(enabled=!narrator.recorded) { voiceMenu = true }.padding(horizontal = 10.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.RecordVoiceOver, null, tint = Brand.GoldLight, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(5.dp))
                    Text("Voice", color = Brand.White, fontSize = 12.5.sp)
                }
                DropdownMenu(voiceMenu, { voiceMenu = false }, containerColor = Brand.Surface2) {
                    narrator.voices.take(12).forEachIndexed { i, v ->
                        DropdownMenuItem(text = { Text(narrator.label(v, i), color = if (v == narrator.voice) Brand.Gold else Brand.White, fontSize = 13.sp) }, onClick = { voiceMenu = false; narrator.chooseVoice(v) })
                    }
                }
            }
            Spacer(Modifier.weight(1f))
            Icon(Icons.Rounded.SkipPrevious, "Previous verse", tint = Brand.White, modifier = Modifier.size(42.dp).clip(CircleShape).clickable { narrator.previous() }.padding(8.dp))
            Box(Modifier.padding(horizontal = 6.dp).size(50.dp).clip(CircleShape).background(Brand.GoldGradient).clickable { narrator.toggle() }, contentAlignment = Alignment.Center) {
                Icon(if (narrator.playing) Icons.Rounded.Pause else Icons.Rounded.PlayArrow, if (narrator.playing) "Pause" else "Play", tint = Brand.Black, modifier = Modifier.size(28.dp))
            }
            Icon(Icons.Rounded.SkipNext, "Next verse", tint = Brand.White, modifier = Modifier.size(42.dp).clip(CircleShape).clickable { narrator.next() }.padding(8.dp))
            Spacer(Modifier.weight(1f))
            val speeds = listOf(0.8f, 0.95f, 1.1f, 1.25f)
            Text("${"%.2f".format(narrator.rate).trimEnd('0').trimEnd('.')}x", color = Brand.White, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold,
                modifier = Modifier.glass().clickable { narrator.changeRate(speeds[(speeds.indexOf(narrator.rate).coerceAtLeast(0) + 1) % speeds.size]) }.padding(horizontal = 12.dp, vertical = 6.dp))
        }
    }
}

@Composable
private fun ModeChip(label: String, on: Boolean, onClick: () -> Unit) {
    Text(
        label, color = if (on) Brand.Black else Brand.White, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
        modifier = (if (on) Modifier.clip(RoundedCornerShape(50)).background(Brand.GoldGradient) else Modifier.glass()).clickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 7.dp),
    )
}

@Composable
private fun ColumnPicker(versions: List<BibleVersion>, selected: String, modifier: Modifier, pick: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box(modifier) {
        Row(Modifier.fillMaxWidth().glass(RoundedCornerShape(12.dp), 0.7f).clickable { open = true }.padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            val v = versions.firstOrNull { it.id == selected }
            Column(Modifier.weight(1f)) {
                Text(v?.abbreviation ?: selected, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Brand.GoldLight)
                Text(v?.label ?: "", style = Type.Meta.copy(fontSize = 11.sp), color = Brand.Text2, maxLines = 1)
            }
            Icon(Icons.Rounded.ExpandMore, "Change version", tint = Brand.Text2)
        }
        DropdownMenu(open, { open = false }, containerColor = Brand.Surface2) {
            versions.forEach { v -> DropdownMenuItem(text = { Text("${v.abbreviation} · ${v.name}", color = if (v.id == selected) Brand.Gold else Brand.White) }, onClick = { open = false; pick(v.id) }) }
        }
    }
}

@Composable
private fun ChapterPage(
    bible: BibleDb, store: BibleStore, book: Book, chapter: Int, focusVerse: Int,
    speaking: Int, listenOne: (Int, String) -> Unit, listenFrom: (Int, String) -> Unit,
) {
    val s = store.state.also { store.version }
    val left = remember(s.left, book.id, chapter) { bible.chapter(s.left, book.id, chapter) }
    val right = remember(s.right, book.id, chapter) { bible.chapter(s.right, book.id, chapter) }
    val single = remember(s.single, book.id, chapter) { bible.chapter(s.single, book.id, chapter) }
    val numbers = if (s.sideBySide) (left.map { it.number } + right.map { it.number }).distinct().sorted() else single.map { it.number }
    val list = rememberLazyListState(initialFirstVisibleItemIndex = (focusVerse - 1).coerceIn(0, (numbers.size - 1).coerceAtLeast(0)))
    var sheet by remember { mutableStateOf<Int?>(null) }
    var selected by remember { mutableStateOf<Int?>(null) }
    val size = 18f * s.textScale
    val readId = if (s.sideBySide) s.right else s.single

    // Follow the voice down the page.
    LaunchedEffect(speaking) {
        val i = numbers.indexOf(speaking)
        if (i >= 0) list.animateScrollToItem(i, -220)
    }

    LazyColumn(state = list, contentPadding = PaddingValues(start = 14.dp, end = 14.dp, top = 6.dp, bottom = NavBarHeight + 190.dp)) {
        items(numbers, key = { it }) { n ->
            val key = ref(book.id, chapter, n)
            val tint = highlightOf(s.highlights[key])
            val focused = n == focusVerse && focusVerse > 1
            val reading = n == speaking
            val shape = RoundedCornerShape(12.dp)
            Column(
                Modifier.fillMaxWidth().padding(vertical = 2.dp).clip(shape)
                    .background(if (reading) Color(0x2ED4AF37) else tint ?: if (focused || selected == n) Color(0x14D4AF37) else Color.Transparent)
                    .border(1.dp, if (reading) Color(0x88D4AF37) else Color.Transparent, shape)
                    .combinedClickable(onClick = { selected = if (selected == n) null else n }, onLongClick = { selected = null; sheet = n })
                    .padding(horizontal = 8.dp, vertical = 8.dp),
            ) {
                if (s.sideBySide) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("$n", color = Brand.Gold, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        if (reading) Icon(Icons.AutoMirrored.Rounded.VolumeUp, null, tint = Brand.Gold, modifier = Modifier.padding(start = 6.dp).size(14.dp))
                        if (key in s.bookmarks) Icon(Icons.Rounded.Bookmark, null, tint = Brand.Gold, modifier = Modifier.padding(start = 4.dp).size(14.dp))
                        if (s.notes[key] != null) Icon(Icons.Rounded.EditNote, null, tint = Brand.BlueText, modifier = Modifier.padding(start = 4.dp).size(15.dp))
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                        Text(left.firstOrNull { it.number == n }?.text.orEmpty(), fontFamily = Scripture, fontSize = size.sp, lineHeight = (size * 1.5f).sp, color = Brand.White, modifier = Modifier.weight(1f))
                        Text(right.firstOrNull { it.number == n }?.text.orEmpty(), fontFamily = Scripture, fontSize = size.sp, lineHeight = (size * 1.5f).sp, color = Color(0xFFE8E2D2), modifier = Modifier.weight(1f))
                    }
                } else {
                    val text = single.firstOrNull { it.number == n }?.text.orEmpty()
                    Text(buildAnnotatedString {
                        withStyle(SpanStyle(color = Brand.Gold, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = (size * 0.62f).sp, baselineShift = BaselineShift.Superscript)) { append("$n ") }
                        append(text)
                    }, fontFamily = Scripture, fontSize = (size * 1.12f).sp, lineHeight = (size * 1.75f).sp, color = Brand.White)
                }
                s.notes[key]?.let { Text("\u270E $it", style = Type.Meta, color = Brand.BlueText, modifier = Modifier.padding(top = 6.dp)) }
                // Tap a verse: quick actions appear right under it.
                if (selected == n) {
                    Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        QuickChip(Icons.AutoMirrored.Rounded.VolumeUp, "Listen") { selected = null; listenOne(n, readId) }
                        QuickChip(Icons.Rounded.PlayArrow, "Read from here") { selected = null; listenFrom(n, readId) }
                        QuickChip(Icons.Rounded.MoreHoriz, "More") { selected = null; sheet = n }
                    }
                }
            }
        }
    }
    sheet?.let { n -> VerseSheet(bible, store, book, chapter, n, listen = { listenOne(n, readId) }, listenFromHere = { listenFrom(n, readId) }) { sheet = null } }
}

@Composable
private fun QuickChip(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, onClick: () -> Unit) {
    Row(Modifier.clip(RoundedCornerShape(50)).background(Color(0x26D4AF37)).border(1.dp, Color(0x40D4AF37), RoundedCornerShape(50)).clickable(onClick = onClick).padding(horizontal = 12.dp, vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = Brand.Gold, modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(6.dp))
        Text(label, color = Brand.White, fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 13.sp)
    }
}

@Composable
private fun VerseSheet(bible: BibleDb, store: BibleStore, book: Book, chapter: Int, verse: Int, listen: () -> Unit, listenFromHere: () -> Unit, close: () -> Unit) {
    val context = LocalContext.current
    val s = store.state
    val key = ref(book.id, chapter, verse)
    val primary = if (s.sideBySide) s.right else s.single
    val text = bible.verse(primary, book.id, chapter, verse).orEmpty()
    val reference = "${book.english} $chapter:$verse"
    var compare by remember { mutableStateOf(false) }
    var noting by remember { mutableStateOf(false) }
    var note by remember { mutableStateOf(s.notes[key].orEmpty()) }
    ModalBottomSheet(onDismissRequest = close, containerColor = Color(0xFF16161A)) {
        Column(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 20.dp).padding(bottom = 20.dp)) {
            Text(reference, style = Type.Title, color = Brand.White)
            Text(text, fontFamily = Scripture, fontSize = 17.sp, lineHeight = 25.sp, color = Brand.Text2, maxLines = 4, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 6.dp))
            Spacer(Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                highlightColors.forEach { (name, color) ->
                    Box(Modifier.size(36.dp).clip(CircleShape).background(color.copy(alpha = 1f)).border(2.dp, if (s.highlights[key] == name) Color.White else Color.Transparent, CircleShape)
                        .clickable { store.update { it.copy(highlights = it.highlights + (key to name)) }; close() })
                }
                Icon(Icons.Rounded.FormatColorReset, "Remove highlight", tint = Brand.Text2, modifier = Modifier.size(36.dp).clip(CircleShape).clickable { store.update { it.copy(highlights = it.highlights - key) }; close() }.padding(6.dp))
            }
            Spacer(Modifier.height(10.dp))
            SheetAction(Icons.AutoMirrored.Rounded.VolumeUp, "Listen to this verse") { close(); listen() }
            SheetAction(Icons.Rounded.PlayArrow, "Listen from here to the end") { close(); listenFromHere() }
            val marked = key in s.bookmarks
            SheetAction(if (marked) Icons.Rounded.Bookmark else Icons.Outlined.BookmarkBorder, if (marked) "Remove bookmark" else "Bookmark") {
                store.update { it.copy(bookmarks = if (marked) it.bookmarks - key else listOf(key) + it.bookmarks) }; close()
            }
            SheetAction(Icons.Rounded.EditNote, if (s.notes[key] != null) "Edit note" else "Add a note") { noting = true }
            SheetAction(Icons.Rounded.Compare, "Compare in all versions") { compare = !compare }
            if (compare) {
                bible.versions().forEach { v ->
                    bible.verse(v.id, book.id, chapter, verse)?.let { t ->
                        Column(Modifier.fillMaxWidth().padding(vertical = 6.dp).glass(RoundedCornerShape(12.dp), 0.6f).padding(12.dp)) {
                            Text(v.abbreviation, color = Brand.Gold, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            Text(t, fontFamily = Scripture, fontSize = 16.sp, lineHeight = 23.sp, color = Brand.White)
                        }
                    }
                }
            }
            SheetAction(Icons.Rounded.ContentCopy, "Copy") {
                context.getSystemService(ClipboardManager::class.java).setPrimaryClip(ClipData.newPlainText(reference, "“$text” — $reference")); close()
            }
            SheetAction(Icons.Rounded.Share, "Share as picture") { VerseImage.share(context, text, reference); close() }
        }
    }
    if (noting) {
        AlertDialog(
            onDismissRequest = { noting = false },
            containerColor = Color(0xFF1C1C20),
            title = { Text("Note on $reference", color = Brand.White) },
            text = { Field("YOUR NOTE", note, { note = it }, minHeight = 110.dp, singleLine = false) },
            confirmButton = { TextButton({ store.update { it.copy(notes = if (note.isBlank()) it.notes - key else it.notes + (key to note.trim())) }; noting = false; close() }) { Text("Save", color = Brand.Gold) } },
            dismissButton = { TextButton({ noting = false }) { Text("Cancel", color = Brand.Text2) } },
        )
    }
}

@Composable
private fun SheetAction(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable(onClick = onClick).padding(vertical = 13.dp, horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = Brand.Gold, modifier = Modifier.size(22.dp))
        Spacer(Modifier.width(16.dp))
        Text(label, fontFamily = Inter, fontSize = 15.5.sp, color = Brand.White)
    }
}

@Serializable
private data class CatalogVersion(val id: String = "", val name: String = "", val abbreviation: String = "", val languageCode: String = "", val languageName: String = "", val license: String = "", val downloadUrl: String = "")

@Composable
private fun LibraryView(bible: BibleDb, store: BibleStore, onBack: () -> Unit, open: (View) -> Unit) {
    val scope = rememberCoroutineScope()
    var installed by remember { mutableStateOf(bible.versions()) }
    var query by remember { mutableStateOf("") }
    val catalog = remember { mutableStateListOf<CatalogVersion>() }
    var searching by remember { mutableStateOf(false) }
    var installing by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    val s = store.state.also { store.version }

    fun search() = scope.launch {
        searching = true; error = null
        runCatching { catalog.clear(); catalog.addAll(Api.decode<List<CatalogVersion>>(Api.get("/bible/versions?query=${android.net.Uri.encode(query.trim())}")["versions"]).take(40)) }
            .onFailure { error = it.message }
        searching = false
    }

    fun install(v: CatalogVersion) = scope.launch {
        installing = v.id; error = null
        runCatching {
            withContext(Dispatchers.IO) {
                // Straight from the publisher (eBible.org) when we know the file, else via the church server.
                val sources = listOfNotNull(v.downloadUrl.takeIf { it.startsWith("https://") }, "${BuildConfig.API_BASE}/api/v1/bible/versions/${v.id}/download")
                val slow = Api.http.newBuilder().readTimeout(3, java.util.concurrent.TimeUnit.MINUTES).build()
                var lastError: Throwable? = null
                val bytes = sources.firstNotNullOfOrNull { url ->
                    runCatching {
                        slow.newCall(Request.Builder().url(url).build()).execute().use { res ->
                            if (!res.isSuccessful) error("Download failed (${res.code})")
                            res.body!!.bytes()
                        }
                    }.onFailure { lastError = it }.getOrNull()
                } ?: throw (lastError ?: IllegalStateException("Download failed"))
                run {
                    val text = if (bytes.size > 2 && bytes[0] == 'P'.code.toByte() && bytes[1] == 'K'.code.toByte()) {
                        ZipInputStream(bytes.inputStream()).use { zip ->
                            generateSequence { zip.nextEntry }.firstOrNull { it.name.endsWith(".txt") && it.name.contains("vpl", true) }
                                ?: error("No verse file in the package")
                            zip.readBytes().decodeToString()
                        }
                    } else bytes.decodeToString()
                    bible.installVpl(BibleVersion(v.id, v.name, v.languageName, v.abbreviation, v.languageCode, v.license), text.lineSequence())
                }
            }
        }.onSuccess { installed = bible.versions() }.onFailure { error = it.message }
        installing = null
    }

    Column(Modifier.fillMaxSize().imePadding()) {
        TopBar(title = "Bible Library", onBack = onBack)
        LazyColumn(contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = NavBarHeight + 40.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item { Text("Installed versions", style = Type.Title, color = Brand.White) }
            items(installed, key = { it.id }) { v ->
                Row(Modifier.fillMaxWidth().glass(RoundedCornerShape(16.dp), 0.7f).padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(46.dp).clip(RoundedCornerShape(12.dp)).background(Brand.GoldGradient), contentAlignment = Alignment.Center) {
                        Text(v.abbreviation.take(4), color = Brand.Black, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(v.name, style = Type.CardTitle, color = Brand.White, maxLines = 2)
                        Text(listOf(v.label, v.license).filter { it.isNotBlank() }.joinToString(" · "), style = Type.Meta, color = Brand.Text2, maxLines = 1)
                    }
                    if (v.id != BibleDb.ENGLISH && v.id != BibleDb.SWAHILI) {
                        Text("Remove", color = Brand.Red, fontSize = 13.sp, modifier = Modifier.clickable {
                            bible.remove(v.id); installed = bible.versions()
                            store.update { st -> st.copy(left = if (st.left == v.id) BibleDb.SWAHILI else st.left, right = if (st.right == v.id) BibleDb.ENGLISH else st.right, single = if (st.single == v.id) BibleDb.ENGLISH else st.single) }
                        }.padding(8.dp))
                    }
                }
            }
            item {
                Text("Download more", style = Type.Title, color = Brand.White, modifier = Modifier.padding(top = 12.dp))
                Text("Search by language or name: Kikuyu, Luo, French, KJV…", style = Type.Meta, color = Brand.Text2)
                Spacer(Modifier.height(10.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.weight(1f).glass(com.shekinahsons.globalapp.ui.components.GlassShape, 0.8f).padding(horizontal = 18.dp, vertical = 14.dp)) {
                        if (query.isEmpty()) Text("Language or version", style = Type.Body, color = Brand.Muted)
                        BasicTextField(query, { query = it }, singleLine = true, textStyle = Type.Body.copy(color = Brand.White), cursorBrush = SolidColor(Brand.Gold), modifier = Modifier.fillMaxWidth())
                    }
                    Spacer(Modifier.width(8.dp))
                    Box(Modifier.size(50.dp).clip(CircleShape).background(Brand.GoldGradient).clickable(enabled = query.trim().length >= 2) { search() }, contentAlignment = Alignment.Center) {
                        if (searching) CircularProgressIndicator(color = Brand.Black, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
                        else Icon(Icons.Rounded.Search, "Search", tint = Brand.Black)
                    }
                }
                error?.let { Text(it, color = Color(0xFFFFB4AE), fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp)) }
            }
            items(catalog.filter { c -> installed.none { it.id == c.id } }, key = { "cat-" + it.id }) { v ->
                Row(Modifier.fillMaxWidth().glass(RoundedCornerShape(16.dp), 0.6f).padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(v.name, style = Type.CardTitle, color = Brand.White, maxLines = 2)
                        Text("${v.languageName} · ${v.abbreviation}", style = Type.Meta, color = Brand.GoldLight)
                    }
                    if (installing == v.id) CircularProgressIndicator(color = Brand.Gold, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
                    else Text("Download", color = Brand.Black, fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                        modifier = Modifier.clip(RoundedCornerShape(50)).background(Brand.Gold).clickable(enabled = installing == null) { install(v) }.padding(horizontal = 14.dp, vertical = 8.dp))
                }
            }
            if (s.bookmarks.isNotEmpty()) {
                item { Text("Bookmarked verses", style = Type.Title, color = Brand.White, modifier = Modifier.padding(top = 12.dp)) }
                items(s.bookmarks, key = { "bm-$it" }) { k -> PlaceRow(bible, k, open) }
            }
            if (s.favourites.isNotEmpty()) {
                item { Text("Favourite chapters", style = Type.Title, color = Brand.White, modifier = Modifier.padding(top = 12.dp)) }
                items(s.favourites, key = { "fav-${it.bookId}-${it.chapter}" }) { p -> PlaceRow(bible, ref(p.bookId, p.chapter, 1), open, chapterOnly = true) }
            }
            if (s.recent.isNotEmpty()) {
                item { Text("Recent chapters", style = Type.Title, color = Brand.White, modifier = Modifier.padding(top = 12.dp)) }
                items(s.recent, key = { "rec-${it.bookId}-${it.chapter}" }) { p -> PlaceRow(bible, ref(p.bookId, p.chapter, 1), open, chapterOnly = true) }
            }
        }
    }
}

@Composable
private fun PlaceRow(bible: BibleDb, key: String, open: (View) -> Unit, chapterOnly: Boolean = false) {
    val (b, c, v) = key.split(":").map { it.toInt() }
    val book = bible.book(b) ?: return
    Row(Modifier.fillMaxWidth().glass(RoundedCornerShape(14.dp), 0.5f).clickable { open(View.Reader(book, c, v)) }.padding(14.dp)) {
        Column {
            Text(if (chapterOnly) "${book.english} $c" else "${book.english} $c:$v", style = Type.CardTitle, color = Brand.White)
            if (!chapterOnly) Text(bible.verse(BibleDb.ENGLISH, b, c, v).orEmpty(), style = Type.Meta, color = Brand.Text2, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun SearchView(bible: BibleDb, onBack: () -> Unit, open: (View) -> Unit) {
    var query by remember { mutableStateOf("") }
    var hits by remember { mutableStateOf<List<Hit>>(emptyList()) }
    val versions = remember { bible.versions().associateBy { it.id } }
    LaunchedEffect(query) {
        kotlinx.coroutines.delay(300)
        hits = withContext(Dispatchers.IO) { bible.search(query) }
    }
    Column(Modifier.fillMaxSize().imePadding()) {
        TopBar(title = "Search the Bible", onBack = onBack)
        Box(Modifier.padding(horizontal = 16.dp).fillMaxWidth().glass(com.shekinahsons.globalapp.ui.components.GlassShape, 0.8f).padding(horizontal = 18.dp, vertical = 14.dp)) {
            if (query.isEmpty()) Text("Words or a phrase (English or Kiswahili)", style = Type.Body, color = Brand.Muted)
            BasicTextField(query, { query = it }, singleLine = true, textStyle = Type.Body.copy(color = Brand.White), cursorBrush = SolidColor(Brand.Gold), modifier = Modifier.fillMaxWidth())
        }
        LazyColumn(contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = NavBarHeight + 40.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (query.trim().length >= 3 && hits.isEmpty()) item { Text("No verses found.", style = Type.Body, color = Brand.Muted) }
            items(hits, key = { "${it.versionId}-${it.bookId}-${it.chapter}-${it.verse}" }) { h ->
                val book = bible.book(h.bookId) ?: return@items
                Column(Modifier.fillMaxWidth().glass(RoundedCornerShape(14.dp), 0.5f).clickable { open(View.Reader(book, h.chapter, h.verse)) }.padding(14.dp)) {
                    Text("${book.english} ${h.chapter}:${h.verse} · ${versions[h.versionId]?.abbreviation ?: h.versionId}", color = Brand.Gold, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                    Text(h.text, fontFamily = Scripture, fontSize = 16.sp, lineHeight = 23.sp, color = Brand.White)
                }
            }
        }
    }
}
