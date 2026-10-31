package com.shekinahsons.globalapp.readingplans

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.layout.fillMaxHeight
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
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.MenuBook
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.LocalFireDepartment
import androidx.compose.material.icons.rounded.NotificationsActive
import androidx.compose.material.icons.rounded.TextDecrease
import androidx.compose.material.icons.rounded.TextIncrease
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.BaselineShift
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.app.NotificationCompat
import com.shekinahsons.globalapp.MainActivity
import com.shekinahsons.globalapp.R
import com.shekinahsons.globalapp.bible.BibleDb
import com.shekinahsons.globalapp.data.Api
import com.shekinahsons.globalapp.data.Session
import com.shekinahsons.globalapp.ui.components.ErrorNote
import com.shekinahsons.globalapp.ui.components.Field
import com.shekinahsons.globalapp.ui.components.GhostButton
import com.shekinahsons.globalapp.ui.components.GoldButton
import com.shekinahsons.globalapp.ui.components.SignInCard
import com.shekinahsons.globalapp.ui.components.TopBar
import com.shekinahsons.globalapp.ui.components.glass
import com.shekinahsons.globalapp.ui.components.lifted
import com.shekinahsons.globalapp.ui.components.pressable
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Cinzel
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Scripture
import com.shekinahsons.globalapp.ui.theme.Type
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import java.util.Calendar
import kotlin.math.absoluteValue

@Serializable
data class PlanDay(val id: String = "", val dayNumber: Int = 0, val title: String = "", val reference: String = "", val description: String = "", val prayerPrompt: String = "", val completed: Boolean = false, val note: String = "")

@Serializable
data class Plan(
    val id: String = "", val title: String = "", val description: String = "", val imageUrl: String = "", val durationDays: Int = 0,
    val completedDays: Int = 0, val streakDays: Int = 0, val reminderOn: Boolean = false, val reminderTime: String = "",
    val days: List<PlanDay> = emptyList(), val startedOn: String = "", val todayDay: Int = 0,
) { val started get() = startedOn.isNotBlank() }

private val palettes = listOf(
    listOf(Color(0xFF3A2C0A), Color(0xFF0E0C08)), listOf(Color(0xFF0E2A6B), Color(0xFF070B18)), listOf(Color(0xFF6E0F24), Color(0xFF1A0508)),
    listOf(Color(0xFF0F4D3C), Color(0xFF041410)), listOf(Color(0xFF4B1D6E), Color(0xFF120717)), listOf(Color(0xFF6B3A0A), Color(0xFF170C04)),
)
private fun palette(id: String) = palettes[id.hashCode().absoluteValue % palettes.size]

// "Genesis 1-3; Exodus 1" -> (book, chapter) pairs.
private fun chaptersOf(bible: BibleDb, reference: String): List<Triple<Int, String, Int>> =
    reference.split(";").mapNotNull { part ->
        val m = Regex("""^\s*(.+?)\s+(\d+)(?:-(\d+))?\s*$""").find(part) ?: return@mapNotNull null
        val book = bible.findBook(m.groupValues[1]) ?: return@mapNotNull null
        val a = m.groupValues[2].toInt(); val b = m.groupValues[3].toIntOrNull() ?: a
        (a..b).map { Triple(book.id, book.english, it) }
    }.flatten()

// Reading plans: start one, read each day's chapters right here, tick it off.
@Composable
fun PlansScreen(session: Session, openProfile: () -> Unit, openReference: (String) -> Unit, onBack: () -> Unit) {
    val plans = remember { mutableStateListOf<Plan>() }
    var open by remember { mutableStateOf(com.shekinahsons.globalapp.notify.OpenLink.planId?.takeIf { it.isNotBlank() }.also { com.shekinahsons.globalapp.notify.OpenLink.planId=null }) }
    var reload by remember { mutableIntStateOf(0) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(reload, session.member) {
        val path = if (session.member != null) "/reading-plans/mine" else "/reading-plans"
        runCatching { Api.decode<List<Plan>>(Api.get(path)["plans"]) }.onSuccess { plans.clear(); plans.addAll(it) }.onFailure { error = it.message }
        loading = false
    }
    LaunchedEffect(com.shekinahsons.globalapp.notify.OpenLink.planId) {com.shekinahsons.globalapp.notify.OpenLink.planId?.takeIf{it.isNotBlank()}?.let{open=it;com.shekinahsons.globalapp.notify.OpenLink.planId=null}}
    BackHandler { if (open != null) { open = null; reload++ } else onBack() }
    AnimatedContent(open, transitionSpec = { fadeIn() togetherWith fadeOut() }, label = "plans", modifier = Modifier.fillMaxSize().background(Brand.Black)) { id ->
        if (id != null) PlanPage(id, session, openProfile, openReference) { open = null; reload++ }
        else {
            val mine = plans.filter { it.started }.sortedByDescending { it.todayDay }
            val others = plans.filter { !it.started }
            LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 40.dp)) {
                item { TopBar(title = "Reading Plans", onBack = onBack) }
                if (loading) item { Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Brand.Gold) } }
                error?.let { item { Box(Modifier.padding(16.dp)) { ErrorNote(it) } } }
                mine.firstOrNull()?.let { p -> item { TodayCard(p) { open = p.id } } }
                if (mine.isNotEmpty()) {
                    item { SectionTitle("Your plans") }
                    items(mine, key = { "m-" + it.id }) { p -> MyPlanRow(p) { open = p.id } }
                }
                if (others.isNotEmpty()) {
                    item { SectionTitle(if (mine.isEmpty()) "Choose a plan" else "Discover more") }
                    item {
                        LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            items(others, key = { it.id }) { p -> PlanCover(p, Modifier.width(170.dp)) { open = p.id } }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(text, style = Type.Title, color = Brand.White, modifier = Modifier.padding(start = 16.dp, top = 24.dp, bottom = 10.dp))
}

@Composable
private fun PlanCover(p: Plan, modifier: Modifier, onClick: () -> Unit) {
    val colors = palette(p.id)
    Column(modifier.pressable(onClick)) {
        Box(Modifier.fillMaxWidth().aspectRatio(0.78f).lifted(RoundedCornerShape(20.dp), 12.dp).clip(RoundedCornerShape(20.dp)).background(Brush.verticalGradient(colors))) {
            androidx.compose.foundation.Image(painterResource(R.drawable.dove_mark), null, Modifier.align(Alignment.Center).size(110.dp).graphicsLayer { alpha = 0.09f })
            Column(Modifier.fillMaxSize().padding(14.dp), verticalArrangement = Arrangement.SpaceBetween) {
                Text("${p.durationDays} DAYS", style = Type.Label, color = Brand.Gold)
                Column {
                    Box(Modifier.width(30.dp).height(2.dp).background(Brand.GoldGradient))
                    Spacer(Modifier.height(8.dp))
                    Text(p.title, color = Color.White, fontFamily = Cinzel, fontSize = 17.sp, lineHeight = 21.sp)
                }
            }
        }
        Spacer(Modifier.height(8.dp))
        Text(p.description, style = Type.Meta.copy(fontSize = 12.sp, lineHeight = 16.sp), color = Brand.Text2, maxLines = 3)
    }
}

// Today's reading for the plan you're on, with a progress ring.
@Composable
private fun TodayCard(p: Plan, onClick: () -> Unit) {
    val progress = if (p.durationDays > 0) p.completedDays.toFloat() / p.durationDays else 0f
    Box(Modifier.padding(horizontal = 16.dp).fillMaxWidth().lifted(RoundedCornerShape(26.dp), 18.dp, Brand.Gold).clip(RoundedCornerShape(26.dp))
        .background(Brush.linearGradient(listOf(Color(0xFF3A2C0A), Color(0xFF14110A), palette(p.id).first()))).border(1.dp, Color(0x55D4AF37), RoundedCornerShape(26.dp)).pressable(onClick).padding(20.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("TODAY'S READING", style = Type.Label, color = Brand.Gold)
                Spacer(Modifier.height(6.dp))
                Text(p.title, style = Type.Meta.copy(fontSize = 13.sp), color = Brand.GoldLight)
                Text("Day ${p.todayDay}", style = Type.Display, color = Color.White)
                Spacer(Modifier.height(10.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.AutoMirrored.Rounded.MenuBook, null, tint = Color.White, modifier = Modifier.size(16.dp))
                    Text(" Read now", color = Color.White, fontWeight = FontWeight.Bold)
                    if (p.streakDays > 0) {
                        Spacer(Modifier.width(14.dp))
                        Icon(Icons.Rounded.LocalFireDepartment, null, tint = Color(0xFFFF8A3D), modifier = Modifier.size(16.dp))
                        Text(" ${p.streakDays}-day streak", color = Color(0xFFFFB27A), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
            Ring(progress, "${(progress * 100).toInt()}%", Modifier.size(84.dp))
        }
    }
}

@Composable
private fun Ring(progress: Float, label: String, modifier: Modifier) {
    Box(modifier, contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val w = 8.dp.toPx()
            drawArc(Color(0x26FFFFFF), -90f, 360f, false, Offset(w / 2, w / 2), Size(size.width - w, size.height - w), style = Stroke(w))
            drawArc(Brush.sweepGradient(listOf(Brand.GoldLight, Brand.Gold, Brand.GoldLight)), -90f, 360f * progress.coerceIn(0f, 1f), false, Offset(w / 2, w / 2), Size(size.width - w, size.height - w), style = Stroke(w, cap = StrokeCap.Round))
        }
        Text(label, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 15.sp)
    }
}

@Composable
private fun MyPlanRow(p: Plan, onClick: () -> Unit) {
    val progress = if (p.durationDays > 0) p.completedDays.toFloat() / p.durationDays else 0f
    Row(Modifier.padding(horizontal = 16.dp, vertical = 6.dp).fillMaxWidth().glass(RoundedCornerShape(20.dp), 0.85f).pressable(onClick).padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(52.dp).clip(RoundedCornerShape(14.dp)).background(Brush.linearGradient(palette(p.id))), contentAlignment = Alignment.Center) {
            Text("${p.todayDay}", color = Brand.GoldLight, fontFamily = Inter, fontWeight = FontWeight.Black, fontSize = 18.sp)
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(p.title, style = Type.CardTitle, color = Color.White)
            Text("Day ${p.todayDay} of ${p.durationDays} · ${p.completedDays} done", style = Type.Meta, color = Brand.Text2)
            Spacer(Modifier.height(6.dp))
            Box(Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)).background(Color(0x22FFFFFF))) {
                Box(Modifier.fillMaxWidth(progress).fillMaxHeight().background(Brand.GoldGradient))
            }
        }
    }
}

@Composable
private fun PlanPage(id: String, session: Session, openProfile: () -> Unit, openReference: (String) -> Unit, onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var plan by remember { mutableStateOf<Plan?>(null) }
    var day by remember { mutableIntStateOf(0) }
    var reload by remember { mutableIntStateOf(0) }
    var error by remember { mutableStateOf<String?>(null) }
    var size by remember { mutableFloatStateOf(1f) }
    LaunchedEffect(reload, session.member) {
        val path = if (session.member != null) "/reading-plans/$id/mine" else "/reading-plans/$id"
        runCatching { Api.decode<Plan>(Api.get(path)["plan"]) }.onSuccess { p ->
            plan = p
            if (day == 0) day = if (p.started) p.todayDay else 1
        }.onFailure { error = it.message }
    }
    val p = plan ?: run { Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { if (error != null) ErrorNote(error) else CircularProgressIndicator(color = Brand.Gold) }; return }
    val current = p.days.firstOrNull { it.dayNumber == day } ?: p.days.firstOrNull()
    val strip = rememberLazyListState(initialFirstVisibleItemIndex = (day - 3).coerceAtLeast(0))
    fun act(block: suspend () -> Unit) = scope.launch { runCatching { block() }.onSuccess { reload++ }.onFailure { error = it.message } }

    LazyColumn(Modifier.fillMaxSize().imePadding(), contentPadding = PaddingValues(bottom = 50.dp)) {
        item { TopBar(title = "", onBack = onBack) }
        item {
            Column(Modifier.padding(horizontal = 20.dp)) {
                Text("${p.durationDays}-DAY PLAN", style = Type.Label, color = Brand.Gold)
                Text(p.title, style = Type.Display, color = Color.White)
                Spacer(Modifier.height(6.dp))
                Text(p.description, style = Type.Body, color = Brand.Text2)
                Spacer(Modifier.height(16.dp))
                when {
                    session.member == null -> SignInCard("Sign in to start this plan, keep your place and your streak.", openProfile)
                    !p.started -> GoldButton("Start this plan today") { act { Api.post("/reading-plans/$id/start"); day = 1 } }
                    else -> Row(Modifier.fillMaxWidth().glass(RoundedCornerShape(20.dp), 0.85f).padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Ring(p.completedDays.toFloat() / p.durationDays.coerceAtLeast(1), "${p.completedDays}/${p.durationDays}", Modifier.size(70.dp))
                        Spacer(Modifier.width(14.dp))
                        Column(Modifier.weight(1f)) {
                            Text("Day ${p.todayDay} today", style = Type.CardTitle, color = Color.White)
                            if (p.streakDays > 0) Text("🔥 ${p.streakDays}-day streak", color = Color(0xFFFFB27A), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            Text("Started ${p.startedOn}", style = Type.Meta, color = Brand.Text2)
                        }
                    }
                }
            }
        }
        // Every day of the plan; today ringed, done days filled.
        item {
            LazyRow(state = strip, contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(p.days, key = { it.id }) { d ->
                    val selected = d.dayNumber == day
                    val today = p.started && d.dayNumber == p.todayDay
                    Column(
                        Modifier.width(52.dp).clip(RoundedCornerShape(16.dp))
                            .background(when { selected -> Brand.GoldGradient; d.completed -> Brush.linearGradient(listOf(Color(0xFF1E5C3A), Color(0xFF123522))); else -> Brush.linearGradient(listOf(Color(0xFF1C1C20), Color(0xFF151517))) })
                            .border(if (today && !selected) 1.5.dp else 0.dp, Brand.Gold, RoundedCornerShape(16.dp))
                            .clickable { day = d.dayNumber }.padding(vertical = 10.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text("DAY", fontSize = 9.sp, fontWeight = FontWeight.Bold, color = if (selected) Brand.Black else Brand.Muted)
                        Text("${d.dayNumber}", fontSize = 18.sp, fontWeight = FontWeight.Black, color = if (selected) Brand.Black else Color.White)
                        if (d.completed) Icon(Icons.Rounded.Check, null, tint = if (selected) Brand.Black else Color(0xFF4ADE80), modifier = Modifier.size(14.dp))
                        else Spacer(Modifier.height(14.dp))
                    }
                }
            }
        }
        current?.let { d ->
            item {
                Row(Modifier.padding(horizontal = 20.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("DAY ${d.dayNumber}", style = Type.Label, color = Brand.Gold)
                        Text(d.reference, style = Type.Title, color = Color.White)
                    }
                    Icon(Icons.Rounded.TextDecrease, "Smaller text", tint = Color.White, modifier = Modifier.size(40.dp).clip(CircleShape).clickable { size = (size - 0.1f).coerceAtLeast(0.8f) }.padding(9.dp))
                    Icon(Icons.Rounded.TextIncrease, "Larger text", tint = Color.White, modifier = Modifier.size(40.dp).clip(CircleShape).clickable { size = (size + 0.1f).coerceAtMost(1.6f) }.padding(9.dp))
                }
            }
            item { Passage(d.reference, size) { openReference(it) } }
            if (d.prayerPrompt.isNotBlank()) item {
                Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp).fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Color(0x1AD4AF37)).border(1.dp, Color(0x33D4AF37), RoundedCornerShape(20.dp)).padding(16.dp)) {
                    Text("PRAY", style = Type.Label, color = Brand.Gold)
                    Text("“${d.prayerPrompt}”", fontFamily = Scripture, fontSize = 17.sp, lineHeight = 25.sp, color = Brand.GoldLight, modifier = Modifier.padding(top = 4.dp))
                }
            }
            if (p.started) item {
                var note by remember(d.id) { mutableStateOf(d.note) }
                var savedNote by remember(d.id) { mutableStateOf(false) }
                Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                    Field("MY NOTES FOR DAY ${d.dayNumber}", note, { note = it.take(4000); savedNote = false }, hint = "What stood out to you?", minHeight = 100.dp, singleLine = false)
                    if (note != d.note && !savedNote) Text("Save note", color = Brand.GoldLight, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 8.dp).clickable {
                        scope.launch { runCatching { Api.put("/reading-plans/$id/days/${d.dayNumber}/note", mapOf("note" to note)) }.onSuccess { savedNote = true }.onFailure { error = it.message } }
                    }.padding(4.dp))
                    if (savedNote) Text("Saved", color = Color(0xFF4ADE80), fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp))
                    Spacer(Modifier.height(14.dp))
                    if (!d.completed) GoldButton("Mark Day ${d.dayNumber} as read") {
                        act {
                            Api.post("/reading-plans/$id/days/${d.dayNumber}/complete")
                            if (d.dayNumber < p.durationDays) day = d.dayNumber + 1
                        }
                    } else Row(Modifier.fillMaxWidth().glass(com.shekinahsons.globalapp.ui.components.GlassShape, 0.85f).padding(horizontal = 18.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Rounded.Check, null, tint = Color(0xFF4ADE80))
                        Text("  Day ${d.dayNumber} read", color = Color.White, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                        Text("Undo", color = Brand.Text2, modifier = Modifier.clickable { act { Api.delete("/reading-plans/$id/days/${d.dayNumber}/complete") } }.padding(4.dp))
                    }
                }
            }
        }
        if (p.started) item {
            Column(Modifier.padding(16.dp)) {
                ReminderRow(p) { on, time ->
                    act {
                        Api.patch("/reading-plans/$id/reminder", mapOf("enabled" to on, "reminderTime" to time))
                        PlanReminder.set(context, on, time, p.title, id)
                    }
                }
                Spacer(Modifier.height(16.dp))
                var confirm by remember { mutableStateOf(false) }
                if (!confirm) GhostButton("Restart or leave this plan") { confirm = true }
                else Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Box(Modifier.weight(1f)) { GhostButton("Restart from Day 1") { act { Api.post("/reading-plans/$id/start", mapOf("restart" to true)); day = 1 }; confirm = false } }
                    Box(Modifier.weight(1f)) { GhostButton("Leave plan") { act { Api.delete("/reading-plans/$id/start"); PlanReminder.set(context, false, "", p.title, id) }; onBack() } }
                }
                ErrorNote(error)
            }
        }
    }
}

@Composable
private fun ReminderRow(p: Plan, change: (Boolean, String) -> Unit) {
    val times = listOf("05:30", "06:00", "07:00", "12:00", "18:00", "20:00", "21:00")
    var on by remember(p.reminderOn) { mutableStateOf(p.reminderOn) }
    var time by remember(p.reminderTime) { mutableStateOf(p.reminderTime.ifBlank { "06:00" }) }
    Column(Modifier.fillMaxWidth().glass(RoundedCornerShape(20.dp), 0.85f).padding(14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Rounded.NotificationsActive, null, tint = Brand.Gold)
            Column(Modifier.weight(1f).padding(start = 12.dp)) {
                Text("Daily reminder", style = Type.CardTitle, color = Color.White)
                Text(if (on) "Every day at $time" else "Off", style = Type.Meta, color = Brand.Text2)
            }
            Switch(on, { on = it; change(it, time) }, colors = SwitchDefaults.colors(checkedThumbColor = Brand.Black, checkedTrackColor = Brand.Gold, uncheckedTrackColor = Color(0x22FFFFFF)))
        }
        if (on) LazyRow(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            items(times) { t ->
                val sel = t == time
                Text(t, color = if (sel) Brand.Black else Color.White, fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                    modifier = (if (sel) Modifier.clip(RoundedCornerShape(50)).background(Brand.GoldGradient) else Modifier.glass()).clickable { time = t; change(true, t) }.padding(horizontal = 12.dp, vertical = 7.dp))
            }
        }
    }
}

// The day's chapters, from the Bible on the phone.
@Composable
private fun Passage(reference: String, scale: Float, openInBible: (String) -> Unit) {
    val context = LocalContext.current
    val chapters by produceState<List<Pair<String, List<com.shekinahsons.globalapp.bible.Verse>>>?>(null, reference) {
        value = withContext(Dispatchers.IO) {
            val bible = BibleDb.get(context)
            chaptersOf(bible, reference).map { (bookId, name, ch) -> "$name $ch" to bible.chapter(BibleDb.ENGLISH, bookId, ch) }
        }
    }
    val list = chapters
    if (list == null) { Box(Modifier.fillMaxWidth().padding(30.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Brand.Gold) }; return }
    Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
        list.forEach { (title, verses) ->
            Column(Modifier.fillMaxWidth().padding(vertical = 6.dp).clip(RoundedCornerShape(20.dp)).background(Color(0xFF111114)).border(1.dp, Color(0x14FFFFFF), RoundedCornerShape(20.dp)).padding(18.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(title, color = Brand.Gold, fontFamily = Cinzel, fontSize = (18 * scale).sp, modifier = Modifier.weight(1f))
                    Text("Open in Bible", color = Brand.BlueText, fontSize = 12.5.sp, modifier = Modifier.clickable { openInBible(title) }.padding(4.dp))
                }
                Spacer(Modifier.height(10.dp))
                Text(
                    buildAnnotatedString {
                        verses.forEach { v ->
                            withStyle(SpanStyle(color = Brand.Gold, fontSize = (11 * scale).sp, fontWeight = FontWeight.Bold, baselineShift = BaselineShift(0.3f))) { append("${v.number} ") }
                            append(v.text.trim()); append("  ")
                        }
                    },
                    fontFamily = androidx.compose.ui.text.font.FontFamily.Serif, fontSize = (17 * scale).sp, lineHeight = (28 * scale).sp, color = Color(0xFFEDEDF0),
                )
            }
        }
        if (list.isEmpty()) Text("Read $reference in the Bible tab.", style = Type.Body, color = Brand.Text2, modifier = Modifier.clickable { openInBible(reference) })
    }
}

// A daily notification at the chosen time.
object PlanReminder {
    fun set(context: Context, on: Boolean, time: String, title: String, id: String) {
        val account=com.shekinahsons.globalapp.data.Accounts.current
        val key="$account|$id"
        val prefs=context.getSharedPreferences("plan-reminders",0)
        if(on) prefs.edit().putString(key, org.json.JSONObject().put("time",time).put("title",title).toString()).apply()
        else prefs.edit().remove(key).apply()
        schedule(context,key,if(on) time else null,title)
    }
    private fun schedule(context: Context,key: String,time: String?,title: String) {
        val alarms=context.getSystemService(AlarmManager::class.java)
        val intent=Intent(context,PlanReminderReceiver::class.java).setData(android.net.Uri.parse("shekinah://plan-reminder/${android.net.Uri.encode(key)}")).putExtra("title",title).putExtra("key",key)
        val pending=PendingIntent.getBroadcast(context,0,intent,PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        alarms.cancel(pending)
        if(time==null || key.substringBefore('|')!=com.shekinahsons.globalapp.data.Accounts.current) return
        val parsed=runCatching { java.time.LocalTime.parse(time) }.getOrDefault(java.time.LocalTime.of(6,0))
        val cal=Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY,parsed.hour);set(Calendar.MINUTE,parsed.minute);set(Calendar.SECOND,0);set(Calendar.MILLISECOND,0)
            if(timeInMillis<=System.currentTimeMillis()) add(Calendar.DAY_OF_YEAR,1)
        }
        alarms.setInexactRepeating(AlarmManager.RTC_WAKEUP,cal.timeInMillis,AlarmManager.INTERVAL_DAY,pending)
    }
    fun restore(context: Context) {
        context.getSharedPreferences("plan-reminders",0).all.forEach { (key,value) ->
            runCatching { val json=org.json.JSONObject(value as String); schedule(context,key,json.getString("time"),json.getString("title")) }
        }
    }
}
class PlanReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context,intent: Intent) {
        if(intent.action==Intent.ACTION_BOOT_COMPLETED || intent.action==Intent.ACTION_TIME_CHANGED || intent.action==Intent.ACTION_TIMEZONE_CHANGED) { PlanReminder.restore(context); return }
        val key=intent.getStringExtra("key") ?: return
        if(key.substringBefore('|')!=com.shekinahsons.globalapp.data.Accounts.current) return
        com.shekinahsons.globalapp.notify.Notify.show(context,key.hashCode(),"Today's reading is ready","Continue ${intent.getStringExtra("title") ?: "your reading plan"}.","devotion","plans",key.substringAfter('|'))
    }
}
