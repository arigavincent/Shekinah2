package com.shekinahsons.globalapp.ui.screens

import com.shekinahsons.globalapp.data.asSermon
import androidx.compose.material.icons.rounded.Close
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.OpenInNew
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Language
import androidx.compose.material.icons.rounded.LiveTv
import androidx.compose.material.icons.rounded.Radio
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.data.Api
import com.shekinahsons.globalapp.data.Api.str
import com.shekinahsons.globalapp.data.HomeContent
import com.shekinahsons.globalapp.data.Library
import com.shekinahsons.globalapp.data.Session
import com.shekinahsons.globalapp.data.Sermon
import com.shekinahsons.globalapp.ui.components.ErrorNote
import com.shekinahsons.globalapp.ui.components.FadeImage
import com.shekinahsons.globalapp.ui.components.Field
import com.shekinahsons.globalapp.ui.components.GoldButton
import com.shekinahsons.globalapp.ui.components.ToggleRow
import com.shekinahsons.globalapp.ui.components.glass
import com.shekinahsons.globalapp.ui.components.lifted
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Type
import kotlinx.serialization.Serializable

private val ministries = listOf(
    "Worship" to "Praise, worship, vocals and instruments.",
    "Media" to "Cameras, sound, livestream, photography and visuals.",
    "Ushering" to "Welcome people, guide seating and keep order.",
    "Children" to "Care for and teach the children safely.",
    "Youth" to "Walk with young people in faith and fellowship.",
    "Prayer" to "Stand in the gap for the church and its needs.",
    "Outreach" to "Take the Gospel and practical help to the community.",
    "Hospitality" to "Make guests feel at home with warmth and care.",
)

// Serve: pick a ministry and send a ready-made request to the church's
// serve contact on WhatsApp.
@Composable
fun ServePage(session: Session) {
    val context = LocalContext.current
    var number by remember { mutableStateOf("") }
    var pick by remember { mutableStateOf<String?>(null) }
    var name by remember { mutableStateOf(session.member?.name.orEmpty()) }
    var phone by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) { runCatching { number = (Api.get("/settings/serve")["serve"] as? kotlinx.serialization.json.JsonObject)?.str("whatsappNumber").orEmpty() } }
    LazyColumn(Modifier.fillMaxSize().imePadding(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Text("Where would you love to serve?", style = Type.Title, color = Brand.White); Text("Every gift has a place in the house.", style = Type.Meta, color = Brand.Text2) }
        items(ministries) { (m, d) ->
            val on = pick == m
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp))
                    .background(if (on) Brush.linearGradient(listOf(Color(0xFF3A2D0C), Color(0xFF1A160D))) else Brush.linearGradient(listOf(Color(0xFF151517), Color(0xFF121214))))
                    .border(1.dp, if (on) Color(0x88D4AF37) else Color(0x14FFFFFF), RoundedCornerShape(18.dp)).clickable { pick = m }.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(m, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, color = Brand.White)
                    Text(d, style = Type.Meta, color = Brand.Text2)
                }
                if (on) Icon(Icons.Rounded.CheckCircle, null, tint = Brand.Gold)
            }
        }
        if (pick != null) item {
            Column(Modifier.padding(top = 8.dp)) {
                Field("YOUR NAME", name, { name = it })
                Spacer(Modifier.height(12.dp))
                Field("PHONE", phone, { phone = it }, keyboard = KeyboardType.Phone)
                ErrorNote(error)
                Spacer(Modifier.height(14.dp))
                GoldButton("Send on WhatsApp", enabled = name.isNotBlank() && phone.length >= 9) {
                    val to = number.filter(Char::isDigit).let { if (it.startsWith("0")) "254" + it.drop(1) else it }
                    if (to.isBlank()) { error = "The church hasn't set its serve contact yet. Please try again later."; return@GoldButton }
                    val text = "🟨 *SERVE REQUEST*\n*Shekinah Sons Global*\n\nName: $name\nPhone: $phone\n" +
                        (session.member?.email?.let { "Email: $it\n" } ?: "") + "Ministry: $pick"
                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$to?text=${Uri.encode(text)}")))
                }
            }
        }
    }
}

private fun open(context: Context, link: String) {
    if (link.isNotBlank()) runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(link))) }
}

@Composable
fun PlatformsPage(content: HomeContent) {
    val context = LocalContext.current
    val icons = mapOf<String, ImageVector>("Radio" to Icons.Rounded.Radio, "TV" to Icons.Rounded.LiveTv, "Web" to Icons.Rounded.Language)
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text("Find Shekinah Sons Global on radio, TV and the web.", style = Type.Body, color = Brand.Text2) }
        content.platforms.forEach { (kind, list) ->
            items(list, key = { it.id }) { p ->
                val configured=com.shekinahsons.globalapp.data.Ministry.details.let{when(kind){"Radio"->it.radioUrl;"TV"->it.tvUrl;"Web"->it.website;else->""}}
                val link=configured.ifBlank{p.link.takeUnless{it.contains("example.com",true)}.orEmpty()}
                Row(
                    Modifier.fillMaxWidth().lifted(RoundedCornerShape(20.dp), 10.dp).clip(RoundedCornerShape(20.dp))
                        .background(Brush.linearGradient(listOf(Color(0xFF1C1810), Color(0xFF111318)))).border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(20.dp))
                        .clickable(enabled = link.isNotBlank()) { open(context, link) }.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(Modifier.size(52.dp).clip(CircleShape).background(Brand.GoldGradient), contentAlignment = Alignment.Center) {
                        Icon(icons[kind] ?: Icons.Rounded.Language, null, tint = Brand.Black, modifier = Modifier.size(26.dp))
                    }
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f)) {
                        Text(kind.uppercase(), style = Type.Label.copy(fontSize = 10.sp), color = Brand.Gold)
                        Text(p.name, style = Type.CardTitle, color = Brand.White)
                        Text(if(link.isBlank()) "Details coming soon" else p.description, style = Type.Meta, color = Brand.Text2)
                    }
                    if (link.isNotBlank()) Icon(Icons.AutoMirrored.Rounded.OpenInNew, "Open", tint = Brand.Text2)
                }
            }
        }
    }
}

// What the member wants to hear about. Saved on the phone and sent to the
// server so pushes respect it; the phone also filters what it shows.
@Serializable private data class Announcement(val id:String="",val title:String="",val body:String="",val createdAt:String="",val category:String="general",val data:Map<String,kotlinx.serialization.json.JsonElement> = emptyMap())
@Composable
fun NotificationsPage(content: HomeContent) {
    val context = LocalContext.current
    var announcements by remember{mutableStateOf(emptyList<Announcement>())}
    var feedError by remember{mutableStateOf<String?>(null)}
    LaunchedEffect(Unit){runCatching{Api.decode<List<Announcement>>(Api.get("/notifications/feed")["messages"])}.onSuccess{announcements=it}.onFailure{feedError=it.message}}
    val prefs = remember { context.getSharedPreferences("notify", Context.MODE_PRIVATE) }
    fun toggle(key: String, def: Boolean = true): Pair<Boolean, (Boolean) -> Unit> = prefs.getBoolean(key, def) to { v -> prefs.edit().putBoolean(key, v).apply() }
    var live by remember { mutableStateOf(prefs.getBoolean("live", true)) }
    var sermons by remember { mutableStateOf(prefs.getBoolean("sermons", true)) }
    var devotion by remember { mutableStateOf(prefs.getBoolean("devotion", true)) }
    var events by remember { mutableStateOf(prefs.getBoolean("events", true)) }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Column(Modifier.fillMaxWidth().glass(RoundedCornerShape(20.dp), 0.7f).padding(horizontal = 16.dp, vertical = 6.dp)) {
                ToggleRow("Live services", "When we go live", live) { live = it; prefs.edit().putBoolean("live", it).apply(); com.shekinahsons.globalapp.notify.Push.preferencesChanged(context) }
                ToggleRow("New sermons", "Video and audio messages", sermons) { sermons = it; prefs.edit().putBoolean("sermons", it).apply(); com.shekinahsons.globalapp.notify.Push.preferencesChanged(context) }
                ToggleRow("Daily devotion", "Each morning's devotional", devotion) { devotion = it; prefs.edit().putBoolean("devotion", it).apply(); com.shekinahsons.globalapp.notify.Push.preferencesChanged(context) }
                ToggleRow("Events", "Conferences and gatherings", events) { events = it; prefs.edit().putBoolean("events", it).apply(); com.shekinahsons.globalapp.notify.Push.preferencesChanged(context) }
            }
        }
        item { Text("Recent announcements", style = Type.Title, color = Brand.White, modifier = Modifier.padding(top = 10.dp)) }
        item { com.shekinahsons.globalapp.ui.components.ErrorNote(feedError) }
        if (announcements.isEmpty()) item { Text("Nothing new right now.", style = Type.Body, color = Brand.Muted) }
        items(announcements, key = { it.id }) { u ->
            Row(Modifier.fillMaxWidth().glass(RoundedCornerShape(16.dp), 0.6f).clickable { com.shekinahsons.globalapp.notify.OpenLink.pending=com.shekinahsons.globalapp.notify.OpenLink.Target((u.data["open"] as? kotlinx.serialization.json.JsonPrimitive)?.content ?: u.category,(u.data["id"] as? kotlinx.serialization.json.JsonPrimitive)?.content.orEmpty()) }.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {

                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(u.title, style = Type.CardTitle, color = Brand.White)
                    Text(u.body, style = Type.Meta, color = Brand.Text2)
                    Text(u.createdAt.take(10),style=Type.Meta,color=Brand.Muted)
                }
            }
        }
    }
}

@Serializable
data class Resource(val id: String = "", val title: String = "", val description: String = "", val author: String = "", val category: String = "", val coverUrl: String = "", val fileUrl: String = "", val fileType: String = "")

// Library: books and study resources from the church, plus your saved sermons.
@Composable
fun LibraryPage(content: HomeContent, library: Library, openVideo: (Sermon, List<Sermon>) -> Unit, openAudio: (Sermon, List<Sermon>) -> Unit) {
    val context = LocalContext.current
    val resources = remember { mutableStateListOf<Resource>() }
    LaunchedEffect(Unit) { runCatching { resources.clear(); resources.addAll(Api.decode<List<Resource>>(Api.get("/library")["items"])) } }
    val saved = (content.sermons+library.catalogue()).distinctBy{it.id}.filter { library.isSaved(it.id) }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(vertical = 12.dp)) {
        item { Text("Books & resources", style = Type.Title, color = Brand.White, modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) }
        if (resources.isEmpty()) item { Text("Books and study guides from the church will appear here.", style = Type.Body, color = Brand.Muted, modifier = Modifier.padding(horizontal = 16.dp)) }
        items(resources, key = { it.id }) { r ->
            Row(Modifier.fillMaxWidth().clickable { open(context, r.fileUrl) }.padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                FadeImage(r.coverUrl, Modifier.width(64.dp).height(88.dp).lifted(RoundedCornerShape(8.dp), 8.dp).clip(RoundedCornerShape(8.dp)), label = "BOOK")
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    Text(r.title, style = Type.CardTitle, color = Brand.White)
                    Text(listOf(r.author, r.category).filter { it.isNotBlank() }.joinToString(" · "), style = Type.Meta, color = Brand.GoldLight)
                    Text(r.description, style = Type.Meta, color = Brand.Text2, maxLines = 2)
                }
            }
        }
        item { Text("Saved sermons", style = Type.Title, color = Brand.White, modifier = Modifier.padding(start = 16.dp, end = 16.dp, top = 22.dp, bottom = 8.dp)) }
        if (saved.isEmpty()) item { Text("Tap the heart on a sermon to keep it here.", style = Type.Body, color = Brand.Muted, modifier = Modifier.padding(horizontal = 16.dp)) }
        items(saved, key = { "saved-" + it.id }) { s ->
            val audio = s.type == "audio"
            SermonRow(s, audio = audio) { if (audio) openAudio(s, saved.filter { it.type == "audio" }) else openVideo(s, saved.filter { it.type != "audio" }) }
        }
    }
}

// Downloads: encrypted copies kept inside the app, playable offline only here.
@Composable
fun DownloadsPage(content: HomeContent, library: Library, openVideo: (Sermon, List<Sermon>) -> Unit, openAudio: (Sermon, List<Sermon>) -> Unit) {
    val all = (content.sermons+library.catalogue()).distinctBy{it.id}
    val done = remember(library.version, library.transfers.toMap(), all) { all.filter { library.isDownloaded(it) } }
    val active = all.filter { library.transfer(it)?.state !in listOf(null,"Complete","Cancelled") }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(vertical = 12.dp)) {
        item {
            Row(Modifier.padding(horizontal = 16.dp, vertical = 6.dp).fillMaxWidth().glass(RoundedCornerShape(16.dp), 0.7f).padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Lock, null, tint = Brand.Gold, modifier = Modifier.size(22.dp))
                Spacer(Modifier.width(12.dp))
                Text("Downloads are encrypted and stay inside this app. They play without data, only here.", style = Type.Meta.copy(fontSize = 13.sp), color = Brand.Text2)
            }
        }
        items(active, key = { "dl-" + it.id }) { s ->
            val p = library.downloading[s.id] ?: 0f
            Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                Text(s.title, style = Type.CardTitle, color = Brand.White)
                Box(Modifier.padding(top = 8.dp).fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)).background(Color(0x22FFFFFF))) {
                    Box(Modifier.fillMaxWidth(p.coerceIn(0.02f, 1f)).height(4.dp).background(Brand.GoldGradient))
                }
                Text("${library.transfer(s)?.state} ${(p * 100).toInt()}%", style = Type.Meta, color = Brand.Text2, modifier = Modifier.padding(top = 4.dp))
                com.shekinahsons.globalapp.ui.components.ErrorNote(library.transfer(s)?.error?.takeIf { it.isNotBlank() })
                Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                    Text(if(s.id in library.downloading) "Pause" else "Retry", color=Brand.Gold, modifier=Modifier.clickable { if(s.id in library.downloading) library.pause(s) else library.download(s) }.padding(vertical=12.dp))
                    Text("Cancel",color=Brand.Text2,modifier=Modifier.clickable { library.cancel(s) }.padding(vertical=12.dp))
                }
            }
        }
        if (done.isEmpty() && active.isEmpty()) item {
            Text("Nothing downloaded yet. Use the download button on any sermon.", style = Type.Body, color = Brand.Muted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(36.dp))
        }
        items(done, key = { it.id }) { s ->
            val audio = s.type == "audio"
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f)) {
                    SermonRow(s, audio = audio) { if (audio) openAudio(s, done.filter { it.type == "audio" }) else openVideo(s, done.filter { it.type != "audio" }) }
                }
                Icon(Icons.Rounded.Delete, "Remove download", tint = Brand.Text2, modifier = Modifier.padding(end = 12.dp).size(40.dp).clip(CircleShape).clickable { library.delete(s) }.padding(9.dp))
            }
        }
    }
}

// Watch history: every sermon opened, most recent first.
@Composable
fun HistoryPage(content: HomeContent, library: Library, openVideo: (Sermon, List<Sermon>) -> Unit, openAudio: (Sermon, List<Sermon>) -> Unit) {
    val everything = remember(content) { (content.sermons+library.catalogue()).distinctBy{it.id} + content.clips.map { it.asSermon() } }
    val items = remember(library.progressVersion, everything) { library.history(everything) }
    var confirm by remember { mutableStateOf(false) }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(vertical = 12.dp)) {
        if (items.isEmpty()) item {
            Text("Sermons you open will show up here, so you can pick up where you left off.", style = Type.Body, color = Brand.Muted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(36.dp))
        } else item {
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("${items.size} opened", style = Type.Meta, color = Brand.Text2, modifier = Modifier.weight(1f))
                Text("Clear history", color = Brand.GoldLight, fontWeight = FontWeight.SemiBold, fontSize = 13.5.sp,
                    modifier = Modifier.clip(RoundedCornerShape(50)).clickable { confirm = true }.padding(horizontal = 12.dp, vertical = 8.dp))
            }
        }
        items(items, key = { it.first.id }) { (s, p) ->
            val audio = s.type == "audio"
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    SermonRow(s, audio = audio) { if (audio) openAudio(s, items.map { it.first }.filter { it.type == "audio" }) else openVideo(s, items.map { it.first }.filter { it.type != "audio" }) }
                    Row(Modifier.padding(start = 16.dp, end = 8.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.weight(1f).height(3.dp).clip(RoundedCornerShape(2.dp)).background(Color(0x22FFFFFF))) {
                            Box(Modifier.fillMaxWidth(p.fraction).height(3.dp).background(Brand.GoldGradient))
                        }
                        Text("  ${progressLabel(p)} \u00B7 ${ago(p.at)}", style = Type.Meta.copy(fontSize = 11.5.sp), color = Brand.Text2)
                    }
                }
                Icon(Icons.Rounded.Close, "Remove from history", tint = Brand.Text2, modifier = Modifier.padding(end = 10.dp).size(38.dp).clip(CircleShape).clickable { library.forget(s.id) }.padding(9.dp))
            }
        }
    }
    if (confirm) androidx.compose.material3.AlertDialog(
        onDismissRequest = { confirm = false }, containerColor = Color(0xFF1C1C20),
        title = { Text("Clear watch history?", color = Brand.White) },
        text = { Text("Where you stopped in each sermon is forgotten too.", color = Brand.Text2) },
        confirmButton = { androidx.compose.material3.TextButton({ library.clearHistory(); confirm = false }) { Text("Clear", color = Brand.Red) } },
        dismissButton = { androidx.compose.material3.TextButton({ confirm = false }) { Text("Cancel", color = Brand.Text2) } },
    )
}

private fun ago(at: Long): String {
    val mins = (System.currentTimeMillis() - at) / 60_000
    return when {
        mins < 1 -> "just now"; mins < 60 -> "$mins min ago"; mins < 1440 -> "${mins / 60} h ago"
        mins < 2880 -> "yesterday"; else -> "${mins / 1440} days ago"
    }
}
