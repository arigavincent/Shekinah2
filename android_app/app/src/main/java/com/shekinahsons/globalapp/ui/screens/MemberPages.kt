package com.shekinahsons.globalapp.ui.screens

import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
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
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.RadioButtonUnchecked
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.VolunteerActivism
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
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
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.zxing.BarcodeFormat
import com.google.zxing.qrcode.QRCodeWriter
import com.shekinahsons.globalapp.BuildConfig
import com.shekinahsons.globalapp.data.Api
import com.shekinahsons.globalapp.data.Api.str
import com.shekinahsons.globalapp.data.Session
import com.shekinahsons.globalapp.ui.components.Avatar
import com.shekinahsons.globalapp.ui.components.ErrorNote
import com.shekinahsons.globalapp.ui.components.FadeImage
import com.shekinahsons.globalapp.ui.components.Field
import com.shekinahsons.globalapp.ui.components.GhostButton
import com.shekinahsons.globalapp.ui.components.GoldButton
import com.shekinahsons.globalapp.ui.components.SignInCard
import com.shekinahsons.globalapp.ui.components.glass
import com.shekinahsons.globalapp.ui.components.lifted
import com.shekinahsons.globalapp.ui.components.pressable
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Scripture
import com.shekinahsons.globalapp.ui.theme.Type
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter

private fun prettyDate(value: String): String =
    runCatching { OffsetDateTime.parse(value).format(DateTimeFormatter.ofPattern("d MMM yyyy")) }.getOrDefault(value)

@Composable
private fun Chips(options: List<String>, selected: String, onSelect: (String) -> Unit) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(options) { o ->
            val on = o == selected
            Text(
                o, color = if (on) Brand.Black else Brand.White, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 13.5.sp,
                modifier = (if (on) Modifier.clip(RoundedCornerShape(50)).background(Brand.GoldGradient) else Modifier.glass())
                    .clickable { onSelect(o) }.padding(horizontal = 15.dp, vertical = 8.dp),
            )
        }
    }
}

@Composable
private fun Segments(options: List<String>, selected: String, onSelect: (String) -> Unit) {
    Row(Modifier.fillMaxWidth().glass(RoundedCornerShape(50), 0.8f).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        options.forEach { o ->
            val on = o == selected
            Box(
                Modifier.weight(1f).height(40.dp).clip(RoundedCornerShape(50))
                    .background(if (on) Brand.GoldGradient else Brush.linearGradient(listOf(Color.Transparent, Color.Transparent))).clickable { onSelect(o) },
                contentAlignment = Alignment.Center,
            ) { Text(o, color = if (on) Brand.Black else Brand.Text2, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 14.sp) }
        }
    }
}

@Composable
private fun Card(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Column(
        modifier.fillMaxWidth().lifted(RoundedCornerShape(20.dp), 10.dp).clip(RoundedCornerShape(20.dp))
            .background(Brush.linearGradient(listOf(Color(0xFF1A1813), Color(0xFF121215))))
            .border(1.dp, Brush.verticalGradient(listOf(Color(0x26FFFFFF), Color(0x08FFFFFF))), RoundedCornerShape(20.dp)).padding(16.dp),
    ) { content() }
}

@Composable
private fun Empty(text: String) {
    Text(text, style = Type.Body, color = Brand.Muted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(36.dp))
}

// ---------------- Prayer requests ----------------

@Serializable
data class Prayer(val id: String = "", val name: String = "", val text: String = "", val date: String = "", val count: Int = 0, val category: String = "", val isPublic: Boolean = true, val status: String = "")

private val prayerTopics = listOf("Healing", "Family", "Finances", "Salvation", "Guidance", "Breakthrough", "Thanksgiving", "Other")

@Composable
fun PrayerPage(session: Session, onSignIn: () -> Unit) {
    val scope = rememberCoroutineScope()
    var tab by remember { mutableStateOf("Prayer Wall") }
    val wall = remember { mutableStateListOf<Prayer>() }
    val mine = remember { mutableStateListOf<Prayer>() }
    var reload by remember { mutableIntStateOf(0) }
    LaunchedEffect(reload, session.member) {
        runCatching { wall.clear(); wall.addAll(Api.decode<List<Prayer>>(Api.get("/prayer-requests")["prayers"])) }
        if (session.member != null) runCatching { mine.clear(); mine.addAll(Api.decode<List<Prayer>>(Api.get("/prayer-requests/mine")["prayers"])) }
    }
    LazyColumn(Modifier.fillMaxSize().imePadding(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Segments(listOf("Prayer Wall", "Ask for Prayer", "Mine"), tab) { tab = it } }
        when (tab) {
            "Ask for Prayer" -> item {
                if (session.member == null) SignInCard("Sign in so the prayer team knows who to pray for and can follow up with you.", onSignIn)
                else PrayerForm(session) { tab = "Mine"; reload++ }
            }
            "Mine" -> {
                if (session.member == null) item { SignInCard("Sign in to see the requests you have shared.", onSignIn) }
                else if (mine.isEmpty()) item { Empty("You haven't shared a prayer request yet.") }
                else items(mine, key = { it.id }) { PrayerCard(it, showStatus = true) {} }
            }
            else -> {
                if (wall.isEmpty()) item { Empty("No public prayer requests yet. Be the first to share one.") }
                items(wall, key = { it.id }) { p ->
                    PrayerCard(p, showStatus = false) {
                        if (session.member == null) onSignIn() else scope.launch { runCatching { Api.post("/prayer-requests/${p.id}/pray") }.onSuccess { reload++ } }
                    }
                }
            }
        }
    }
}

@Composable
private fun PrayerForm(session: Session, done: () -> Unit) {
    val scope = rememberCoroutineScope()
    var topic by remember { mutableStateOf(prayerTopics.first()) }
    var text by remember { mutableStateOf("") }
    var public by remember { mutableStateOf(true) }
    var anonymous by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    Card {
        Text("What should we pray about?", style = Type.Title, color = Brand.White)
        Spacer(Modifier.height(12.dp))
        Chips(prayerTopics, topic) { topic = it }
        Spacer(Modifier.height(14.dp))
        Field("YOUR REQUEST", text, { text = it }, hint = "Share as much as you are comfortable with", minHeight = 120.dp, singleLine = false)
        Spacer(Modifier.height(8.dp))
        com.shekinahsons.globalapp.ui.components.ToggleRow("Share on the prayer wall", "The family can see it and pray with you", public) { public = it }
        com.shekinahsons.globalapp.ui.components.ToggleRow("Post anonymously", "Your name isn't shown. The pastoral team can still see it so they can follow up.", anonymous) { anonymous = it }
        Text(if (anonymous) "Shared as Anonymous" else "Shared as ${session.member?.name}", style = Type.Meta, color = Brand.Muted)
        ErrorNote(error)
        Spacer(Modifier.height(14.dp))
        GoldButton("Send prayer request", busy = busy, enabled = text.trim().length >= 5) {
            scope.launch {
                busy = true; error = null
                runCatching { Api.post("/prayer-requests", mapOf("category" to topic, "text" to text.trim(), "isPublic" to public, "anonymous" to anonymous)) }
                    .onSuccess { done() }.onFailure { error = it.message }
                busy = false
            }
        }
    }
}

@Composable
private fun PrayerCard(p: Prayer, showStatus: Boolean, onPray: () -> Unit) {
    Card {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar(p.name.ifBlank { "Member" }, p.name, 38.dp)
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(p.name.ifBlank { "Member" }, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = Brand.White)
                Text(listOf(p.category, prettyDate(p.date)).filter { it.isNotBlank() }.joinToString(" · "), style = Type.Meta, color = Brand.Text2)
            }
            if (showStatus && p.status.isNotBlank()) Text(p.status.replaceFirstChar { it.uppercase() }, color = Brand.GoldLight, fontSize = 12.sp, modifier = Modifier.glass().padding(horizontal = 10.dp, vertical = 4.dp))
        }
        Spacer(Modifier.height(10.dp))
        Text(p.text, style = Type.Body, color = Brand.White)
        if (!showStatus) {
            Spacer(Modifier.height(12.dp))
            Row(Modifier.glass().clickable(onClick = onPray).padding(horizontal = 14.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Rounded.VolunteerActivism, null, tint = Brand.Gold, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(if (p.count > 0) "I prayed · ${p.count}" else "I prayed", color = Brand.White, fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 13.5.sp)
            }
        }
    }
}

// ---------------- Testimonies ----------------

@Serializable
data class Testimony(val id: String = "", val title: String = "", val body: String = "", val status: String = "", val featured: Boolean = false, val likeCount: Int = 0, val displayName: String = "", val createdAt: String = "")

@Composable
fun TestimoniesPage(session: Session, onSignIn: () -> Unit) {
    val scope = rememberCoroutineScope()
    var tab by remember { mutableStateOf("Testimonies") }
    val all = remember { mutableStateListOf<Testimony>() }
    val liked = remember { mutableStateListOf<String>() }
    var reload by remember { mutableIntStateOf(0) }
    var title by remember { mutableStateOf("") }
    var body by remember { mutableStateOf("") }
    var anonymous by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var sent by remember { mutableStateOf(false) }
    val mine = remember { mutableStateListOf<Testimony>() }
    LaunchedEffect(reload) { runCatching { all.clear(); all.addAll(Api.decode<List<Testimony>>(Api.get("/testimonies")["testimonies"])) } }
    LaunchedEffect(reload, session.member) {
        if (session.member != null) runCatching { Api.decode<List<Testimony>>(Api.get("/testimonies/mine")["testimonies"]) }.onSuccess { mine.clear(); mine.addAll(it) }
    }
    LazyColumn(Modifier.fillMaxSize().imePadding(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Segments(listOf("Testimonies", "Share yours"), tab) { tab = it } }
        if (tab == "Share yours") item {
            if (session.member == null) SignInCard("Sign in to share what God has done. You can choose to share it anonymously.", onSignIn)
            else if (sent) Card {
                Text("Thank you! 🙌", style = Type.Title, color = Brand.White)
                Text("Your testimony is now on the Testimonies wall for the family to read.", style = Type.Body, color = Brand.Text2)
                Spacer(Modifier.height(14.dp))
                GoldButton("Share another testimony") { sent = false; title = ""; body = ""; anonymous = false }
            }
            else Card {
                Text("What has God done?", style = Type.Title, color = Brand.White)
                Spacer(Modifier.height(12.dp))
                Field("TITLE", title, { title = it }, hint = "e.g. Healed after surgery")
                Spacer(Modifier.height(12.dp))
                Field("YOUR STORY", body, { body = it }, minHeight = 150.dp, singleLine = false)
                Spacer(Modifier.height(6.dp))
                com.shekinahsons.globalapp.ui.components.ToggleRow("Share anonymously", "Shown as Anonymous on the wall. The pastoral team still sees your name.", anonymous) { anonymous = it }
                ErrorNote(error)
                Spacer(Modifier.height(14.dp))
                GoldButton("Share testimony", busy = busy, enabled = title.isNotBlank() && body.trim().length >= 20) {
                    scope.launch {
                        busy = true; error = null
                        runCatching { Api.post("/testimonies", mapOf("title" to title.trim(), "body" to body.trim(), "anonymous" to anonymous)) }.onSuccess { sent = true; reload++ }.onFailure { error = it.message }
                        busy = false
                    }
                }
            }
        }
        if (tab == "Share yours" && mine.isNotEmpty()) {
            item { Text("Your testimonies (${mine.size})", style = Type.Title, color = Brand.White, modifier = Modifier.padding(top = 8.dp)) }
            items(mine, key = { "mine-" + it.id }) { t ->
                val (statusText, statusColor) = when (t.status) {
                    "approved" -> "APPROVED" to Color(0xFF4ADE80)
                    "declined" -> "PRIVATE" to Color(0x88FFFFFF)
                    else -> "UNDER REVIEW" to Brand.GoldLight
                }
                Card {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(t.title, style = Type.CardTitle, color = Brand.White, modifier = Modifier.weight(1f))
                        Box(Modifier.clip(RoundedCornerShape(50)).background(statusColor.copy(alpha = 0.18f)).padding(horizontal = 8.dp, vertical = 2.dp)) {
                            Text(statusText, color = statusColor, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                    Spacer(Modifier.height(4.dp))
                    Text(t.body, style = Type.Body.copy(fontSize = 14.sp), color = Brand.Text2, maxLines = 3, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                    Text("${prettyDate(t.createdAt)} \u00B7 ${t.likeCount} amen" + if (t.displayName.contains("(anonymous)")) " \u00B7 shared anonymously" else "",
                        style = Type.Meta, color = Brand.GoldLight, modifier = Modifier.padding(top = 6.dp))
                }
            }
        }
        if (tab != "Share yours") {
            if (all.isEmpty()) item { Empty("No testimonies yet. Share the first one!") }
            items(all, key = { it.id }) { t ->
                val shape = RoundedCornerShape(20.dp)
                Column(
                    Modifier.fillMaxWidth()
                        .lifted(shape, if (t.featured) 14.dp else 8.dp, if (t.featured) Brand.Gold.copy(alpha = 0.35f) else Color.Transparent)
                        .clip(shape)
                        .background(Brush.linearGradient(listOf(if (t.featured) Color(0xFF221A06) else Color(0xFF18171C), Color(0xFF101014))))
                        .border(1.dp, if (t.featured) Color(0x66D4AF37) else Color(0x18FFFFFF), shape)
                        .padding(18.dp)
                ) {
                    if (t.featured) {
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 6.dp)) {
                            Box(Modifier.size(6.dp).clip(CircleShape).background(Brand.Gold))
                            Spacer(Modifier.width(6.dp))
                            Text("FEATURED TESTIMONY", style = Type.Label.copy(fontSize = 10.sp), color = Brand.Gold)
                        }
                    }
                    Text(t.title, style = Type.Title, color = Brand.White)
                    Spacer(Modifier.height(8.dp))
                    Text(t.body, style = Type.Body.copy(fontSize = 14.5.sp, lineHeight = 22.sp), color = Color(0xFFE2E2E6))
                    Spacer(Modifier.height(14.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Avatar(t.displayName, t.displayName, 28.dp)
                        Spacer(Modifier.width(8.dp))
                        Text("${t.displayName} · ${prettyDate(t.createdAt)}", style = Type.Meta, color = Brand.Text2, modifier = Modifier.weight(1f))
                        val on = t.id in liked
                        Row(
                            Modifier.clip(RoundedCornerShape(50))
                                .background(if (on) Color(0x33FF5A4E) else Color(0x14FFFFFF))
                                .border(1.dp, if (on) Color(0x66FF5A4E) else Color(0x1AFFFFFF), RoundedCornerShape(50))
                                .clickable {
                                    if (session.member == null) onSignIn() else if (!on) scope.launch { runCatching { Api.post("/testimonies/${t.id}/like") }.onSuccess { liked += t.id; reload++ } }
                                }.padding(horizontal = 12.dp, vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(if (on) Icons.Rounded.Favorite else Icons.Outlined.FavoriteBorder, "Amen", tint = if (on) Brand.Red else Brand.GoldLight, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Amen · ${t.likeCount}", color = Brand.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }
    }
}

// ---------------- Reading plans ----------------

@Serializable
data class PlanDay(val id: String = "", val dayNumber: Int = 0, val title: String = "", val reference: String = "", val description: String = "", val prayerPrompt: String = "", val completed: Boolean = false)

@Serializable
data class Plan(val id: String = "", val title: String = "", val description: String = "", val imageUrl: String = "", val durationDays: Int = 0, val completedDays: Int = 0, val days: List<PlanDay> = emptyList())

@Composable
fun ReadingPlansPage(session: Session, onSignIn: () -> Unit, openReference: (String) -> Unit) {
    val scope = rememberCoroutineScope()
    val plans = remember { mutableStateListOf<Plan>() }
    var open by remember { mutableStateOf<Plan?>(null) }
    LaunchedEffect(session.member) {
        val path = if (session.member != null) "/reading-plans/mine" else "/reading-plans"
        runCatching { plans.clear(); plans.addAll(Api.decode<List<Plan>>(Api.get(path)["plans"])) }
    }
    val current = open
    if (current != null) {
        LaunchedEffect(current.id, session.member) {
            val path = if (session.member != null) "/reading-plans/${current.id}/mine" else "/reading-plans/${current.id}"
            runCatching { open = Api.decode<Plan>(Api.get(path)["plan"]) }
        }
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item {
                Box(Modifier.fillMaxWidth().aspectRatio(2f).lifted(RoundedCornerShape(22.dp), 14.dp).clip(RoundedCornerShape(22.dp))) {
                    FadeImage(current.imageUrl, Modifier.fillMaxSize(), label = "PLAN")
                    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0.3f to Color.Transparent, 1f to Color(0xEE000000))))
                    Column(Modifier.align(Alignment.BottomStart).padding(16.dp)) {
                        Text(current.title, style = Type.Title, color = Color.White)
                        Text("${current.days.count { it.completed }} of ${current.durationDays} days", style = Type.Meta, color = Brand.GoldLight)
                    }
                }
            }
            item { Text(current.description, style = Type.Body, color = Brand.Text2) }
            if (session.member == null) item { SignInCard("Sign in to tick off each day and keep your streak.", onSignIn) }
            items(current.days, key = { it.id }) { d ->
                Card {
                    Row(verticalAlignment = Alignment.Top) {
                        Icon(
                            if (d.completed) Icons.Rounded.CheckCircle else Icons.Rounded.RadioButtonUnchecked, if (d.completed) "Done" else "Mark done",
                            tint = if (d.completed) Brand.Gold else Brand.Muted,
                            modifier = Modifier.size(28.dp).clip(CircleShape).clickable(enabled = session.member != null && !d.completed) {
                                scope.launch {
                                    runCatching { Api.post("/reading-plans/${current.id}/days/${d.dayNumber}/complete") }
                                        .onSuccess { open = current.copy(days = current.days.map { if (it.id == d.id) it.copy(completed = true) else it }) }
                                }
                            },
                        )
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text("DAY ${d.dayNumber}", style = Type.Label.copy(fontSize = 10.sp), color = Brand.Gold)
                            Text(d.title, style = Type.CardTitle, color = Brand.White)
                            Text(d.reference, color = Brand.BlueText, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 14.sp,
                                modifier = Modifier.padding(vertical = 4.dp).clickable { openReference(d.reference) })
                            Text(d.description, style = Type.Body.copy(fontSize = 14.5.sp, lineHeight = 21.sp), color = Brand.Text2)
                            if (d.prayerPrompt.isNotBlank()) {
                                Spacer(Modifier.height(8.dp))
                                Text("“${d.prayerPrompt}”", fontFamily = Scripture, fontSize = 15.sp, lineHeight = 22.sp, color = Brand.GoldLight)
                            }
                        }
                    }
                }
            }
            item { GhostButton("All plans") { open = null } }
        }
        return
    }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        if (plans.isEmpty()) item { Empty("No reading plans yet.") }
        items(plans, key = { it.id }) { p ->
            Column(Modifier.fillMaxWidth().pressable { open = p }) {
                Box(Modifier.fillMaxWidth().aspectRatio(2.2f).lifted(RoundedCornerShape(20.dp), 12.dp).clip(RoundedCornerShape(20.dp))) {
                    FadeImage(p.imageUrl, Modifier.fillMaxSize(), label = "PLAN")
                    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0.35f to Color.Transparent, 1f to Color(0xEE000000))))
                    Column(Modifier.align(Alignment.BottomStart).padding(14.dp)) {
                        Text(p.title, style = Type.Title, color = Color.White)
                        Text("${p.durationDays} days" + if (p.completedDays > 0) " · ${p.completedDays} done" else "", style = Type.Meta, color = Brand.GoldLight)
                    }
                }
                if (p.durationDays > 0 && p.completedDays > 0) {
                    Box(Modifier.padding(top = 8.dp).fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)).background(Color(0x22FFFFFF))) {
                        Box(Modifier.fillMaxWidth(p.completedDays.toFloat() / p.durationDays).height(4.dp).background(Brand.GoldGradient))
                    }
                }
            }
        }
    }
}

// Giving lives in GivingScreen.kt.

// ---------------- QR check-in ----------------

@Composable
fun CheckInPage(session: Session, onSignIn: () -> Unit) {
    if (session.member == null) { Box(Modifier.padding(16.dp)) { SignInCard("Sign in to get your personal check-in code for services and events.", onSignIn) }; return }
    var code by remember { mutableStateOf("") }
    var expires by remember { mutableStateOf("") }
    var reload by remember { mutableIntStateOf(0) }
    var error by remember { mutableStateOf<String?>(null) }
    val history = remember { mutableStateListOf<kotlinx.serialization.json.JsonObject>() }
    LaunchedEffect(reload) {
        runCatching { Api.get("/checkin/code") }.onSuccess { code = it.str("code"); expires = it.str("expiresAt") }.onFailure { error = it.message }
        runCatching { history.clear(); history.addAll(Api.decode<List<kotlinx.serialization.json.JsonObject>>(Api.get("/checkin/history")["checkins"])) }
    }
    val qr = remember(code) { if (code.isBlank()) null else qrBitmap(code) }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Column(
                Modifier.fillMaxWidth().lifted(RoundedCornerShape(26.dp), 20.dp, Brand.Gold.copy(alpha = 0.4f)).clip(RoundedCornerShape(26.dp))
                    .background(Brush.linearGradient(listOf(Color(0xFF2E2409), Color(0xFF111216)))).border(1.dp, Color(0x55D4AF37), RoundedCornerShape(26.dp)).padding(22.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(session.member?.name.orEmpty(), style = Type.Title, color = Brand.White)
                Text("Show this at the entrance", style = Type.Meta, color = Brand.Text2)
                Spacer(Modifier.height(16.dp))
                Box(Modifier.size(230.dp).clip(RoundedCornerShape(18.dp)).background(Color.White).padding(14.dp), contentAlignment = Alignment.Center) {
                    if (qr != null) Image(qr.asImageBitmap(), "Check-in code", Modifier.fillMaxSize())
                    else CircularProgressIndicator(color = Brand.Gold)
                }
                Spacer(Modifier.height(12.dp))
                Text(code, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 22.sp, letterSpacing = 4.sp, color = Brand.GoldLight)
                val until = runCatching { OffsetDateTime.parse(expires).atZoneSameInstant(java.time.ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("HH:mm")) }.getOrNull()
                if (until != null) Text("Valid until $until", style = Type.Meta, color = Brand.Text2)
                Spacer(Modifier.height(12.dp))
                Row(Modifier.glass().clickable { reload++ }.padding(horizontal = 14.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.Refresh, null, tint = Brand.Gold, modifier = Modifier.size(16.dp)); Spacer(Modifier.width(6.dp)); Text("New code", color = Brand.White, fontSize = 13.sp)
                }
            }
        }
        item { ErrorNote(error) }
        if (history.isNotEmpty()) {
            item { Text("Your check-ins", style = Type.Title, color = Brand.White, modifier = Modifier.fillMaxWidth()) }
            items(history) { h ->
                Row(Modifier.fillMaxWidth().glass(RoundedCornerShape(16.dp), 0.6f).padding(14.dp)) {
                    Text(h.str("eventTitle").ifBlank { h.str("eventId").ifBlank { "Service" } }, color = Brand.White, modifier = Modifier.weight(1f))
                    Text(prettyDate(h.str("createdAt").ifBlank { h.str("checkedInAt") }), style = Type.Meta, color = Brand.Text2)
                }
            }
        }
    }
}

internal fun qrBitmap(text: String): Bitmap {
    val size = 512
    val matrix = QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, size, size, mapOf(com.google.zxing.EncodeHintType.MARGIN to 1))
    val pixels = IntArray(size * size) { i -> if (matrix[i % size, i / size]) 0xFF111111.toInt() else 0xFFFFFFFF.toInt() }
    return Bitmap.createBitmap(pixels, size, size, Bitmap.Config.ARGB_8888)
}
