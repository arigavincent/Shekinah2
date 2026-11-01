package com.shekinahsons.globalapp.admin

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

// The "Next service" shown on Home and Live (countdown and Remind me). Stored as
// text like "Sunday, 9:00 AM", which the app reads to count down.
@Composable
fun AdminNextService() {
    val scope = rememberCoroutineScope()
    var day by remember { mutableStateOf("Sunday") }
    var time by remember { mutableStateOf("09:00") }
    var current by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var saved by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        runCatching { Api.get("/admin/live-config")["liveConfig"]?.jsonObject?.get("nextService")?.jsonPrimitive?.content.orEmpty() }
            .onSuccess { text ->
                current = text
                serviceDays.firstOrNull { text.startsWith(it.take(3), ignoreCase = true) }?.let { day = it }
                Regex("""(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m""", RegexOption.IGNORE_CASE).find(text)?.let { m ->
                    var h = m.groupValues[1].toInt() % 12
                    if (m.groupValues[3].equals("p", true)) h += 12
                    time = "%02d:%02d".format(h, m.groupValues[2].toIntOrNull() ?: 0)
                }
            }.onFailure { error = it.message }
    }
    val label = "$day, " + LocalTime.parse(time).format(DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH))
    Column(Modifier.fillMaxWidth().glass(RoundedCornerShape(20.dp), 0.85f).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Next service", style = Type.Title, color = Brand.White)
        Text("Shown on Home and Live with a countdown and the Remind me button.", style = Type.Meta, color = Brand.Text2)
        Text("DAY", style = Type.Label, color = Brand.Gold)
        ToolChoices(serviceDays.map { it to it }, day) { day = it; saved = false }
        ClockField("TIME · NAIROBI", time, { time = it; saved = false })
        Text("Members will see: $label", style = Type.Body, color = Brand.GoldLight)
        if (current.isNotBlank() && current != label) Text("Currently: $current", style = Type.Meta, color = Brand.Text2)
        ErrorNote(error)
        if (saved) Text("Saved. Members see it the next time the app refreshes.", color = Color(0xFF4ADE80), fontSize = 13.sp)
        GoldButton("Save next service", busy = busy) {
            scope.launch {
                busy = true; error = null
                runCatching { Api.patch("/admin/live-config", mapOf("nextService" to label)) }
                    .onSuccess { saved = true; current = label }.onFailure { error = it.message }
                busy = false
            }
        }
    }
}
