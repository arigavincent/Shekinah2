package com.shekinahsons.globalapp.admin

import androidx.compose.foundation.clickable
import androidx.compose.foundation.background
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.data.Api
import com.shekinahsons.globalapp.ui.components.*
import com.shekinahsons.globalapp.ui.theme.*
import kotlinx.coroutines.launch
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale

private val serviceDays = listOf("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday")

// The services shown on Home and Live with a live countdown and Remind me.
// Stored as text such as "Sunday, 7:00 AM; Sunday, 10:00 AM", which the app
// reads to count down to whichever comes next (Nairobi time).
private data class ServiceTime(val day: String, val time: String) {
    val label get() = "$day, " + LocalTime.parse(time).format(DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH))
}

private fun parseServices(text: String): List<ServiceTime> =
    Regex("""(sun|mon|tue|wed|thu|fri|sat)[a-z]*[ ,]+(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m""", RegexOption.IGNORE_CASE).findAll(text).map { m ->
        var h = m.groupValues[2].toInt() % 12
        if (m.groupValues[4].equals("p", true)) h += 12
        ServiceTime(serviceDays.first { it.startsWith(m.groupValues[1], ignoreCase = true) }, "%02d:%02d".format(h, m.groupValues[3].toIntOrNull() ?: 0))
    }.toList()

@Composable
fun AdminNextService() {
    val scope = rememberCoroutineScope()
    val services = remember { mutableStateListOf(ServiceTime("Sunday", "09:00")) }
    var editing by remember { mutableIntStateOf(0) }
    var current by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var saved by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        runCatching { Api.get("/admin/live-config")["liveConfig"]?.jsonObject?.get("nextService")?.jsonPrimitive?.content.orEmpty() }
            .onSuccess { text ->
                current = text
                val parsed = parseServices(text)
                if (parsed.isNotEmpty()) { services.clear(); services.addAll(parsed) }
            }.onFailure { error = it.message }
    }
    val text = services.sortedWith(compareBy({ serviceDays.indexOf(it.day) }, { it.time })).joinToString("; ") { it.label }
    Column(Modifier.fillMaxWidth().glass(RoundedCornerShape(20.dp), 0.85f).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Service times", style = Type.Title, color = Brand.White)
        Text("Home and Live count down to whichever service comes next, second by second, in Nairobi time.", style = Type.Meta, color = Brand.Text2)
        services.forEachIndexed { i, s ->
            Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                Text(s.label, style = Type.Body, color = if (i == editing) Brand.GoldLight else Brand.White, modifier = Modifier.weight(1f)
                    .clickable { editing = i })
                if (services.size > 1) Text("Remove", color = Brand.Red, fontSize = 13.sp, modifier = Modifier.clickable {
                    services.removeAt(i); editing = 0; saved = false
                }.padding(8.dp))
            }
        }
        services.getOrNull(editing)?.let { s ->
            Text("DAY", style = Type.Label, color = Brand.Gold)
            ToolChoices(serviceDays.map { it to it }, s.day) { services[editing] = s.copy(day = it); saved = false }
            ClockField("TIME · NAIROBI", s.time, { services[editing] = s.copy(time = it); saved = false })
        }
        if (services.size < 6) GhostButton("+ Add another service") { services.add(ServiceTime("Sunday", "11:00")); editing = services.lastIndex; saved = false }
        Text("Members will see: $text", style = Type.Body, color = Brand.GoldLight)
        if (current.isNotBlank() && current != text) Text("Currently: $current", style = Type.Meta, color = Brand.Text2)
        ErrorNote(error)
        if (saved) Text("Saved. Members see it the next time the app refreshes.", color = Color(0xFF4ADE80), fontSize = 13.sp)
        GoldButton("Save service times", busy = busy) {
            scope.launch {
                busy = true; error = null
                runCatching { Api.patch("/admin/live-config", mapOf("nextService" to text)) }
                    .onSuccess { saved = true; current = text }.onFailure { error = it.message }
                busy = false
            }
        }
    }
}

// Which topics the daily verses come from (Home's greeting verse and Verse of
// the Day). None chosen = all topics.
@Composable
fun AdminVerseTopics() {
    val scope = rememberCoroutineScope()
    val chosen = remember { mutableStateListOf<String>() }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var saved by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        runCatching { Api.decode<List<String>>(Api.get("/settings/verse-topics")["topics"]) }.onSuccess { chosen.clear(); chosen.addAll(it) }.onFailure { error = it.message }
    }
    Column(Modifier.fillMaxWidth().glass(RoundedCornerShape(20.dp), 0.85f).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Daily verse topics", style = Type.Title, color = Brand.White)
        Text("Home shows a new verse every morning at 7. Pick topics to focus them, for example Faith and Healing during a healing series. Leave all off for every topic.", style = Type.Meta, color = Brand.Text2)
        androidx.compose.foundation.layout.FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            com.shekinahsons.globalapp.bible.DailyWord.topics.forEach { t ->
                val on = t.id in chosen
                Text(t.label, color = if (on) Brand.Black else Brand.White, fontSize = 13.5.sp,
                    modifier = Modifier.clip(RoundedCornerShape(50))
                        .background(if (on) Brand.GoldGradient else androidx.compose.ui.graphics.SolidColor(Color(0x1FFFFFFF)))
                        .clickable { if (on) chosen.remove(t.id) else chosen.add(t.id); saved = false }
                        .padding(horizontal = 14.dp, vertical = 8.dp))
            }
        }
        Text(if (chosen.isEmpty()) "Using: all topics" else "Using: " + com.shekinahsons.globalapp.bible.DailyWord.topics.filter { it.id in chosen }.joinToString(", ") { it.label }, style = Type.Meta, color = Brand.GoldLight)
        ErrorNote(error)
        if (saved) Text("Saved. Members see it from the next 7 AM verse.", color = Color(0xFF4ADE80), fontSize = 13.sp)
        GoldButton("Save topics", busy = busy) {
            scope.launch {
                busy = true; error = null
                runCatching { Api.put("/admin/settings/verse-topics", mapOf("topics" to chosen.toList())) }.onSuccess { saved = true }.onFailure { error = it.message }
                busy = false
            }
        }
    }
}
