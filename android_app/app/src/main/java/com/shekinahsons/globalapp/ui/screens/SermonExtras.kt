package com.shekinahsons.globalapp.ui.screens

import android.annotation.SuppressLint
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.PlaylistAdd
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.shekinahsons.globalapp.data.Api
import com.shekinahsons.globalapp.data.HomeContent
import com.shekinahsons.globalapp.data.Library
import com.shekinahsons.globalapp.data.Sermon
import com.shekinahsons.globalapp.data.asSermon
import com.shekinahsons.globalapp.ui.components.*
import com.shekinahsons.globalapp.ui.theme.*
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.jsonPrimitive

// ---------------- Playlists ----------------

@Serializable
data class Playlist(
    val id: String = "", val name: String = "", val description: String = "", val coverUrl: String = "",
    val official: Boolean = false, val mine: Boolean = false, val items: List<String> = emptyList(),
)

// Playlists are kept on the member's account, so they follow them to a new phone.
object Playlists {
    val all = mutableStateListOf<Playlist>()
    var loaded by mutableStateOf(false); private set

    suspend fun load() {
        runCatching { Api.decode<List<Playlist>>(Api.get("/playlists")["playlists"]) }.onSuccess { all.clear(); all.addAll(it); loaded = true }
    }

    suspend fun create(name: String, items: List<String> = emptyList()): Playlist {
        val p = Api.decode<Playlist>(Api.post("/playlists", mapOf("name" to name.trim(), "items" to items))["playlist"])
        all.add(all.count { it.official }, p)
        return p
    }

    suspend fun save(p: Playlist, name: String? = null, items: List<String>? = null) {
        val body = buildMap<String, Any?> { name?.let { put("name", it.trim()) }; items?.let { put("items", it) } }
        val saved = Api.decode<Playlist>(Api.patch("/playlists/${p.id}", body)["playlist"])
        val i = all.indexOfFirst { it.id == p.id }
        if (i >= 0) all[i] = saved
    }

    suspend fun delete(p: Playlist) {
        Api.delete("/playlists/${p.id}")
        all.removeAll { it.id == p.id }
    }
}

private fun HomeContent.allPlayable(): Map<String, Sermon> =
    (sermons + clips.map { it.asSermon() }).associateBy { it.id }

// The "Playlists" tab in Sermons: the church's playlists and the member's own.
@Composable
fun PlaylistsTab(content: HomeContent, library: Library, openVideo: (Sermon, List<Sermon>) -> Unit, openAudio: (Sermon, List<Sermon>) -> Unit, bottomPadding: androidx.compose.ui.unit.Dp) {
    val scope = rememberCoroutineScope()
    var openId by rememberSaveableString()
    var creating by remember { mutableStateOf(false) }
    LaunchedEffect(Api.token) { Playlists.load() }
    val byId = remember(content) { content.allPlayable() }
    val open = Playlists.all.firstOrNull { it.id == openId }
    if (open != null) {
        androidx.activity.compose.BackHandler { openId = "" }
        PlaylistDetail(open, byId, library, openVideo, openAudio, bottomPadding) { openId = "" }
        return
    }
    LazyColumn(contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = bottomPadding), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        val official = Playlists.all.filter { it.official }
        val mine = Playlists.all.filter { it.mine }
        if (official.isNotEmpty()) {
            item { Text("FROM THE CHURCH", style = Type.Label, color = Brand.Gold, modifier = Modifier.padding(top = 6.dp)) }
            items(official, key = { it.id }) { p -> PlaylistRow(p, byId) { openId = p.id } }
        }
        item {
            Row(Modifier.fillMaxWidth().padding(top = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("YOUR PLAYLISTS", style = Type.Label, color = Brand.Gold, modifier = Modifier.weight(1f))
                if (Api.token != null) Text("+ New playlist", color = Brand.GoldLight, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 13.5.sp,
                    modifier = Modifier.clip(RoundedCornerShape(50)).clickable { creating = true }.padding(horizontal = 10.dp, vertical = 6.dp))
            }
        }
        if (Api.token == null) item { Text("Sign in to make your own playlists. They're saved to your account, so they come with you to a new phone.", style = Type.Body, color = Brand.Text2) }
        else if (mine.isEmpty()) item {
            Text("Make a playlist of sermons you love, like a series to listen through on the way to work. Tap \"+ New playlist\", or \"Add to playlist\" on any sermon.", style = Type.Body, color = Brand.Text2)
        }
        items(mine, key = { it.id }) { p -> PlaylistRow(p, byId) { openId = p.id } }
    }
    if (creating) NameDialog("New playlist", "") { name ->
        creating = false
        if (name != null) scope.launch { runCatching { Playlists.create(name) }.onSuccess { openId = it.id } }
    }
}

@Composable
private fun rememberSaveableString() = androidx.compose.runtime.saveable.rememberSaveable { mutableStateOf("") }

@Composable
private fun PlaylistRow(p: Playlist, byId: Map<String, Sermon>, onClick: () -> Unit) {
    val first = p.items.firstNotNullOfOrNull { byId[it] }
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).glass(RoundedCornerShape(18.dp), 0.85f).clickable(onClick = onClick).padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(62.dp).clip(RoundedCornerShape(12.dp)).background(Brand.GoldGradient), contentAlignment = Alignment.Center) {
            val cover = p.coverUrl.ifBlank { first?.thumbnail.orEmpty() }
            if (cover.isNotBlank()) FadeImage(cover, Modifier.fillMaxSize())
            else Icon(Icons.Rounded.QueueMusic, null, tint = Brand.Black, modifier = Modifier.size(30.dp))
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(p.name, color = Brand.White, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 15.5.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            val n = p.items.count { it in byId }
            Text((if (p.official) "Shekinah Sons Global · " else "") + "$n sermon${if (n == 1) "" else "s"}", style = Type.Meta, color = Brand.Text2)
        }
        Icon(Icons.Rounded.ChevronRight, null, tint = Brand.Text2)
    }
}

@Composable
private fun PlaylistDetail(
    p: Playlist, byId: Map<String, Sermon>, library: Library,
    openVideo: (Sermon, List<Sermon>) -> Unit, openAudio: (Sermon, List<Sermon>) -> Unit,
    bottomPadding: androidx.compose.ui.unit.Dp, close: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val list = p.items.mapNotNull { byId[it] }
    var renaming by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf(false) }
    var menu by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    fun play(items: List<Sermon>) {
        val first = items.firstOrNull() ?: return
        if (first.type == "audio") openAudio(first, items.filter { it.type == "audio" })
        else openVideo(first, items.filter { it.type != "audio" })
    }
    fun move(from: Int, to: Int) {
        if (to !in list.indices) return
        val ids = list.map { it.id }.toMutableList().apply { add(to, removeAt(from)) }
        scope.launch { runCatching { Playlists.save(p, items = ids) }.onFailure { error = it.message } }
    }
    LazyColumn(contentPadding = PaddingValues(bottom = bottomPadding)) {
        item {
            Row(Modifier.fillMaxWidth().padding(horizontal = 6.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back to playlists", tint = Brand.White, modifier = Modifier.size(44.dp).clip(CircleShape).clickable(onClick = close).padding(10.dp))
                Spacer(Modifier.weight(1f))
                if (p.mine) Box {
                    Icon(Icons.Rounded.MoreVert, "Playlist options", tint = Brand.White, modifier = Modifier.size(44.dp).clip(CircleShape).clickable { menu = true }.padding(10.dp))
                    DropdownMenu(menu, { menu = false }, containerColor = Brand.Surface2) {
                        DropdownMenuItem(text = { Text("Rename", color = Brand.White) }, onClick = { menu = false; renaming = true })
                        DropdownMenuItem(text = { Text("Download all", color = Brand.White) }, onClick = {
                            menu = false
                            list.filter { it.youtubeId.isBlank() && !library.isDownloaded(it) && it.id !in library.downloading }.forEach { library.download(it) }
                        })
                        DropdownMenuItem(text = { Text("Delete playlist", color = Brand.Red) }, onClick = { menu = false; deleting = true })
                    }
                }
            }
        }
        item {
            Column(Modifier.padding(horizontal = 20.dp)) {
                if (p.official) Text("FROM THE CHURCH", style = Type.Label, color = Brand.Gold)
                Text(p.name, style = Type.Display.copy(fontSize = 26.sp), color = Brand.White)
                if (p.description.isNotBlank()) Text(p.description, style = Type.Body, color = Brand.Text2, modifier = Modifier.padding(top = 4.dp))
                Text("${list.size} sermon${if (list.size == 1) "" else "s"}", style = Type.Meta, color = Brand.Text2, modifier = Modifier.padding(top = 4.dp))
                if (list.isNotEmpty()) Row(Modifier.padding(top = 14.dp, bottom = 8.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(Modifier.clip(RoundedCornerShape(50)).background(Brand.GoldGradient).clickable { play(list) }.padding(horizontal = 20.dp, vertical = 11.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Rounded.PlayArrow, null, tint = Brand.Black, modifier = Modifier.size(20.dp)); Spacer(Modifier.width(6.dp))
                        Text("Play all", color = Brand.Black, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }
                    Row(Modifier.clip(RoundedCornerShape(50)).glass().clickable { play(list.shuffled()) }.padding(horizontal = 18.dp, vertical = 11.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Rounded.Shuffle, null, tint = Brand.GoldLight, modifier = Modifier.size(19.dp)); Spacer(Modifier.width(6.dp))
                        Text("Shuffle", color = Brand.White, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    }
                }
                ErrorNote(error)
            }
        }
        if (list.isEmpty()) item {
            Text(if (p.mine) "This playlist is empty. Open any sermon and tap \"Add to playlist\"." else "No sermons here yet.",
                style = Type.Body, color = Brand.Text2, modifier = Modifier.padding(20.dp))
        }
        items(list.size, key = { list[it].id }) { i ->
            val s = list[i]
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f)) { SermonRow(s, audio = s.type == "audio") { play(list.drop(i)) } }
                if (p.mine) {
                    Column {
                        Icon(Icons.Rounded.KeyboardArrowUp, "Move up", tint = if (i > 0) Brand.Text2 else Color.Transparent, modifier = Modifier.size(30.dp).clip(CircleShape).clickable(enabled = i > 0) { move(i, i - 1) }.padding(3.dp))
                        Icon(Icons.Rounded.KeyboardArrowDown, "Move down", tint = if (i < list.lastIndex) Brand.Text2 else Color.Transparent, modifier = Modifier.size(30.dp).clip(CircleShape).clickable(enabled = i < list.lastIndex) { move(i, i + 1) }.padding(3.dp))
                    }
                    Icon(Icons.Rounded.Close, "Remove from playlist", tint = Brand.Text2, modifier = Modifier.padding(end = 8.dp).size(36.dp).clip(CircleShape).clickable {
                        scope.launch { runCatching { Playlists.save(p, items = p.items - s.id) }.onFailure { error = it.message } }
                    }.padding(8.dp))
                }
            }
        }
    }
    if (renaming) NameDialog("Rename playlist", p.name) { name ->
        renaming = false
        if (name != null) scope.launch { runCatching { Playlists.save(p, name = name) }.onFailure { error = it.message } }
    }
    if (deleting) AlertDialog(
        onDismissRequest = { deleting = false }, containerColor = Color(0xFF1C1C20),
        title = { Text("Delete \"${p.name}\"?", color = Brand.White) },
        text = { Text("The sermons stay in the app; only this playlist is removed.", color = Brand.Text2) },
        confirmButton = { TextButton({ deleting = false; scope.launch { runCatching { Playlists.delete(p) }.onSuccess { close() } } }) { Text("Delete", color = Brand.Red) } },
        dismissButton = { TextButton({ deleting = false }) { Text("Cancel", color = Brand.Text2) } },
    )
}

@Composable
private fun NameDialog(title: String, initial: String, done: (String?) -> Unit) {
    var name by remember { mutableStateOf(initial) }
    AlertDialog(
        onDismissRequest = { done(null) }, containerColor = Color(0xFF1C1C20),
        title = { Text(title, color = Brand.White) },
        text = { Field("NAME", name, { name = it.take(80) }, hint = "e.g. Faith series") },
        confirmButton = { TextButton({ done(name) }, enabled = name.isNotBlank()) { Text("Save", color = Brand.Gold) } },
        dismissButton = { TextButton({ done(null) }) { Text("Cancel", color = Brand.Text2) } },
    )
}

// "Add to playlist": tick the playlists this sermon belongs in, or start a new one.
@Composable
fun AddToPlaylistChip(sermon: Sermon) {
    var open by remember { mutableStateOf(false) }
    Row(
        Modifier.clip(RoundedCornerShape(50)).glass().clickable { open = true }.padding(horizontal = 14.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.AutoMirrored.Rounded.PlaylistAdd, null, tint = Brand.GoldLight, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(6.dp))
        Text("Add to playlist", color = Brand.White, fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 13.sp)
    }
    if (open) AddToPlaylistSheet(sermon) { open = false }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddToPlaylistSheet(sermon: Sermon, close: () -> Unit) {
    val scope = rememberCoroutineScope()
    var newName by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) { if (!Playlists.loaded) Playlists.load() }
    ModalBottomSheet(onDismissRequest = close, containerColor = Color(0xFF16161A)) {
        Column(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 20.dp).padding(bottom = 20.dp)) {
            Text("Add to playlist", style = Type.Title, color = Brand.White)
            Text(sermon.title, style = Type.Meta, color = Brand.Text2, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(12.dp))
            if (Api.token == null) {
                Text("Sign in to make playlists. They're saved to your account.", style = Type.Body, color = Brand.Text2)
                return@Column
            }
            Playlists.all.filter { it.mine }.forEach { p ->
                val inIt = sermon.id in p.items
                Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).clickable {
                    scope.launch { runCatching { Playlists.save(p, items = if (inIt) p.items - sermon.id else p.items + sermon.id) }.onFailure { error = it.message } }
                }.padding(vertical = 10.dp, horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(if (inIt) Icons.Rounded.CheckCircle else Icons.Rounded.AddCircleOutline, null, tint = if (inIt) Brand.Gold else Brand.Text2, modifier = Modifier.size(24.dp))
                    Spacer(Modifier.width(12.dp))
                    Text(p.name, color = Brand.White, fontFamily = Inter, fontSize = 15.sp, modifier = Modifier.weight(1f))
                    Text("${p.items.size}", style = Type.Meta, color = Brand.Text2)
                }
            }
            Spacer(Modifier.height(10.dp))
            Row(verticalAlignment = Alignment.Bottom) {
                Field("NEW PLAYLIST", newName, { newName = it.take(80) }, Modifier.weight(1f), hint = "e.g. Sons of God series")
                Spacer(Modifier.width(10.dp))
                Text("Create", color = Brand.Black, fontWeight = FontWeight.Bold, fontSize = 13.5.sp, modifier = Modifier.clip(RoundedCornerShape(50))
                    .background(if (newName.isBlank()) Brush.linearGradient(listOf(Color(0x55D4AF37), Color(0x55D4AF37))) else Brand.GoldGradient)
                    .clickable(enabled = newName.isNotBlank()) {
                        scope.launch { runCatching { Playlists.create(newName, listOf(sermon.id)) }.onSuccess { newName = "" }.onFailure { error = it.message } }
                    }.padding(horizontal = 18.dp, vertical = 14.dp))
            }
            ErrorNote(error)
        }
    }
}

private typealias Brush = androidx.compose.ui.graphics.Brush

// ---------------- Sermon notes ----------------

private val referencePattern = Regex("""\b((?:[1-3]\s?)?[A-Z][a-z]+(?:\s(?:of\s)?[A-Z][a-z]+)?)\s(\d{1,3})(?::(\d{1,3})(?:\s?[-–]\s?\d{1,3})?)?""")

// The overview (the sermon's description) and the preacher's notes, with
// Bible references that open in the Bible tab.
@Composable
fun SermonNotesSection(sermon: Sermon, openReference: (String) -> Unit) {
    val context = LocalContext.current
    var notes by remember(sermon.id) { mutableStateOf("") }
    LaunchedEffect(sermon.id) {
        if (sermon.id.isNotBlank() && !sermon.id.startsWith("replay-")) runCatching { Api.get("/sermons/${sermon.id}/notes")["notes"]?.jsonPrimitive?.content.orEmpty() }.onSuccess { notes = it }
    }
    if (sermon.description.isBlank() && notes.isBlank()) return
    val bible = remember { com.shekinahsons.globalapp.bible.BibleDb.get(context) }
    Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp).fillMaxWidth().glass(RoundedCornerShape(20.dp), 0.85f).padding(16.dp)) {
        if (sermon.description.isNotBlank()) {
            Text("OVERVIEW", style = Type.Label, color = Brand.Gold)
            LinkedText(sermon.description, bible, openReference, Modifier.padding(top = 4.dp))
        }
        if (notes.isNotBlank()) {
            Text("SERMON NOTES", style = Type.Label, color = Brand.Gold, modifier = Modifier.padding(top = if (sermon.description.isNotBlank()) 14.dp else 0.dp))
            notes.lines().forEach { line ->
                val t = line.trim()
                when {
                    t.isEmpty() -> Spacer(Modifier.height(6.dp))
                    t.startsWith("- ") || t.startsWith("• ") || t.startsWith("* ") -> Row(Modifier.padding(top = 4.dp)) {
                        Text("•", color = Brand.Gold, fontSize = 15.sp, modifier = Modifier.padding(end = 8.dp))
                        LinkedText(t.drop(2), bible, openReference)
                    }
                    t.endsWith(":") || (t.length < 60 && t == t.uppercase() && t.any(Char::isLetter)) ->
                        Text(t.trimEnd(':'), fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = Brand.White, modifier = Modifier.padding(top = 8.dp))
                    else -> LinkedText(t, bible, openReference, Modifier.padding(top = 4.dp))
                }
            }
            Text("Tap a Bible reference to read it.", style = Type.Meta.copy(fontSize = 11.5.sp), color = Brand.Muted, modifier = Modifier.padding(top = 10.dp))
        }
    }
}

@Composable
private fun LinkedText(text: String, bible: com.shekinahsons.globalapp.bible.BibleDb, openReference: (String) -> Unit, modifier: Modifier = Modifier) {
    val refs = remember(text) {
        referencePattern.findAll(text).filter { com.shekinahsons.globalapp.bible.BibleLink.parse(bible, it.value) != null }.toList()
    }
    if (refs.isEmpty()) { Text(text, style = Type.Body, color = Brand.Text2, modifier = modifier); return }
    val annotated = buildAnnotatedString {
        var at = 0
        refs.forEach { m ->
            append(text.substring(at, m.range.first))
            pushStringAnnotation("ref", m.value)
            withStyle(SpanStyle(color = Brand.GoldLight, fontWeight = FontWeight.SemiBold)) { append(m.value) }
            pop()
            at = m.range.last + 1
        }
        append(text.substring(at))
    }
    @Suppress("DEPRECATION")
    androidx.compose.foundation.text.ClickableText(annotated, modifier, style = Type.Body.copy(color = Brand.Text2)) { offset ->
        annotated.getStringAnnotations("ref", offset, offset).firstOrNull()?.let { openReference(it.item) }
    }
}

// ---------------- YouTube sermons ----------------

// Plays a YouTube video with YouTube's own player, inside the app.
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun YouTubePlayer(videoId: String, modifier: Modifier = Modifier) {
    val html = """
        <!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
        <style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{position:absolute;inset:0;width:100%;height:100%;border:0}</style></head>
        <body><iframe src="https://www.youtube.com/embed/$videoId?playsinline=1&autoplay=1&rel=0&modestbranding=1&origin=https://shekinah-sons-global.onrender.com"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></body></html>
    """.trimIndent()
    AndroidView(
        factory = { ctx ->
            WebView(ctx).apply {
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.mediaPlaybackRequiresUserGesture = false
                webChromeClient = WebChromeClient()
                webViewClient = WebViewClient()
                setBackgroundColor(android.graphics.Color.BLACK)
                // A real web address as the page's origin: YouTube refuses embeds without one.
                loadDataWithBaseURL("https://shekinah-sons-global.onrender.com/", html, "text/html", "utf-8", null)
            }
        },
        onRelease = { it.stopLoading(); it.loadUrl("about:blank"); it.destroy() },
        modifier = modifier,
    )
}

// A sermon published as a YouTube link: YouTube's player, then the usual details.
@Composable
fun YouTubeSermonScreen(sermon: Sermon, queue: List<Sermon>, library: Library, openReference: (String) -> Unit, onOpen: (Sermon) -> Unit, onBack: () -> Unit) {
    val context = LocalContext.current
    LaunchedEffect(sermon.id) { library.opened(sermon.id); library.remember(sermon) }
    val saved = library.isSaved(sermon.id)
    val upNext = queue.filter { it.id != sermon.id }
    androidx.activity.compose.BackHandler(onBack = onBack)
    LazyColumn(Modifier.fillMaxSize().background(Brand.Black), contentPadding = PaddingValues(bottom = 40.dp)) {
        item { TopBar(title = "", onBack = onBack) }
        item {
            YouTubePlayer(sermon.youtubeId, Modifier.padding(horizontal = 12.dp).fillMaxWidth().aspectRatio(16 / 9f).clip(RoundedCornerShape(16.dp)))
        }
        item {
            Column(Modifier.padding(start = 20.dp, end = 20.dp, top = 18.dp)) {
                if (sermon.category.isNotBlank()) Text(sermon.category.uppercase(), style = Type.Label, color = Brand.Gold)
                Spacer(Modifier.height(6.dp))
                Text(sermon.title, style = Type.Display.copy(fontSize = 22.sp), color = Brand.White)
                Spacer(Modifier.height(6.dp))
                Text(listOf(sermon.speaker, sermon.date, "YouTube").filter { it.isNotBlank() }.joinToString(" · "), style = Type.Meta, color = Brand.Text2)
            }
        }
        item {
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(Modifier.clip(RoundedCornerShape(50)).glass().clickable { library.toggleSaved(sermon.id) }.padding(horizontal = 14.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(if (saved) Icons.Rounded.Favorite else Icons.Rounded.FavoriteBorder, null, tint = Brand.GoldLight, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp)); Text(if (saved) "Saved" else "Save", color = Brand.White, fontSize = 13.sp)
                }
                AddToPlaylistChip(sermon)
                Row(Modifier.clip(RoundedCornerShape(50)).glass().clickable {
                    val send = android.content.Intent(android.content.Intent.ACTION_SEND).setType("text/plain")
                        .putExtra(android.content.Intent.EXTRA_TEXT, "${sermon.title} — ${sermon.speaker}\nhttps://youtu.be/${sermon.youtubeId}\n\nShekinah Sons Global")
                    context.startActivity(android.content.Intent.createChooser(send, "Share sermon"))
                }.padding(horizontal = 14.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.Share, null, tint = Brand.GoldLight, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp)); Text("Share", color = Brand.White, fontSize = 13.sp)
                }
            }
        }
        item { SermonNotesSection(sermon, openReference) }
        if (upNext.isNotEmpty()) {
            item { Text("Up next", style = Type.Title, color = Brand.White, modifier = Modifier.padding(start = 20.dp, top = 20.dp, bottom = 10.dp)) }
            items(upNext, key = { it.id }) { s -> SermonRow(s) { onOpen(s) } }
        }
    }
}
