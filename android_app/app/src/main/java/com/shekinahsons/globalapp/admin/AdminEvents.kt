package com.shekinahsons.globalapp.admin

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Image
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import coil3.compose.AsyncImage
import com.shekinahsons.globalapp.BuildConfig
import com.shekinahsons.globalapp.data.Api
import com.shekinahsons.globalapp.events.FormField
import com.shekinahsons.globalapp.events.RegSetup
import com.shekinahsons.globalapp.ui.components.ErrorNote
import com.shekinahsons.globalapp.ui.components.FadeImage
import com.shekinahsons.globalapp.ui.components.Field
import com.shekinahsons.globalapp.ui.components.GoldButton
import com.shekinahsons.globalapp.ui.components.glass
import com.shekinahsons.globalapp.ui.components.pressable
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Type
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File

@Serializable
data class AdminEvent(val id: String = "", val title: String = "", val eventDate: String = "", val eventTime: String = "", val location: String = "", val imageUrl: String = "", val description: String = "")

@Serializable
data class Registrant(val name: String = "", val email: String = "", val answers: Map<String, String> = emptyMap(), val ticket: String = "", val payment: String = "none", val registered: String = "")

private val fieldTypes = listOf("text" to "Short answer", "longtext" to "Paragraph", "phone" to "Phone", "email" to "Email", "number" to "Number", "choice" to "Choice")

// Events in the admin console: create events, choose how people register,
// and see who has.
@Composable
fun AdminEventsPane() {
    var editing by remember { mutableStateOf<AdminEvent?>(null) }
    var creating by remember { mutableStateOf(false) }
    val events = remember { mutableStateListOf<AdminEvent>() }
    var reload by remember { mutableIntStateOf(0) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(reload) {
        runCatching { Api.decode<List<AdminEvent>>(Api.get("/admin/events")["events"]) }.onSuccess { events.clear(); events.addAll(it.sortedByDescending { e -> e.eventDate }) }.onFailure { error = it.message }
    }
    val e = editing
    when {
        creating -> NewEvent(onBack = { creating = false }) { creating = false; reload++ }
        e != null -> EventManager(e) { editing = null; reload++ }
        else -> Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            GoldButton("New event") { creating = true }
            ErrorNote(error)
            events.forEach { ev ->
                Row(Modifier.fillMaxWidth().glass(RoundedCornerShape(18.dp), 0.85f).pressable { editing = ev }.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                    FadeImage(ev.imageUrl, Modifier.size(64.dp).clip(RoundedCornerShape(12.dp)), label = "EVENT")
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(ev.title, style = Type.CardTitle, color = Brand.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(listOf(ev.eventDate, ev.eventTime).filter { it.isNotBlank() }.joinToString(" · "), style = Type.Meta, color = Brand.Text2)
                    }
                    Text("Manage", color = Brand.GoldLight, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                }
            }
        }
    }
}

@Composable
private fun BackLine(title: String, onBack: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 6.dp)) {
        Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back", tint = Brand.White, modifier = Modifier.size(40.dp).clip(CircleShape).clickable(onClick = onBack).padding(8.dp))
        Spacer(Modifier.width(6.dp))
        Text(title, style = Type.Title, color = Brand.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun NewEvent(onBack: () -> Unit, done: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var title by remember { mutableStateOf("") }
    var date by remember { mutableStateOf(java.time.LocalDate.now().plusDays(7).toString()) }
    var time by remember { mutableStateOf("6:00 PM") }
    var location by remember { mutableStateOf("Main Sanctuary") }
    var description by remember { mutableStateOf("") }
    var image by remember { mutableStateOf<Uri?>(null) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val pick = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { if (it != null) image = it }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        BackLine("New event", onBack)
        Box(Modifier.fillMaxWidth().aspectRatio(16 / 9f).clip(RoundedCornerShape(18.dp)).glass(RoundedCornerShape(18.dp))
            .clickable { pick.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }, contentAlignment = Alignment.Center) {
            if (image != null) AsyncImage(image, "Poster", contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
            else Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Rounded.Image, null, tint = Brand.Gold, modifier = Modifier.size(32.dp))
                Text("Add a poster", color = Brand.Text2)
            }
        }
        Field("TITLE", title, { title = it.take(120) })
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Field("DATE (YYYY-MM-DD)", date, { date = it.take(10) }, Modifier.weight(1f))
            Field("TIME", time, { time = it.take(20) }, Modifier.weight(1f))
        }
        Field("PLACE", location, { location = it.take(120) })
        Field("DESCRIPTION", description, { description = it.take(3000) }, minHeight = 110.dp, singleLine = false)
        ErrorNote(error)
        GoldButton("Create event", busy = busy, enabled = title.isNotBlank() && Regex("""\d{4}-\d{2}-\d{2}""").matches(date)) {
            scope.launch {
                busy = true; error = null
                runCatching {
                    val url = image?.let { uploadImage(context, it) }.orEmpty()
                    Api.post("/admin/events", mapOf("title" to title.trim(), "eventDate" to date, "eventTime" to time.trim(), "location" to location.trim(), "imageUrl" to url, "description" to description.trim()))
                }.onSuccess { done() }.onFailure { error = it.message }
                busy = false
            }
        }
    }
}

private suspend fun uploadImage(context: android.content.Context, uri: Uri): String = withContext(Dispatchers.IO) {
    val bytes = context.contentResolver.openInputStream(uri)!!.use { it.readBytes() }
    val type = context.contentResolver.getType(uri) ?: "image/jpeg"
    val body = MultipartBody.Builder().setType(MultipartBody.FORM).addFormDataPart("kind", "image")
        .addFormDataPart("file", "poster." + type.substringAfter('/'), bytes.toRequestBody(type.toMediaType())).build()
    val req = Request.Builder().url("${BuildConfig.API_BASE}/api/v1/admin/media").post(body).apply { Api.token?.let { header("Authorization", "Bearer $it") } }.build()
    Api.http.newCall(req).execute().use { res ->
        val json = Api.json.parseToJsonElement(res.body?.string().orEmpty()) as kotlinx.serialization.json.JsonObject
        if (!res.isSuccessful) throw Exception((json["message"] as? kotlinx.serialization.json.JsonPrimitive)?.content ?: "Upload failed")
        ((json["media"] as kotlinx.serialization.json.JsonObject)["url"] as kotlinx.serialization.json.JsonPrimitive).content
    }
}

@Composable
private fun EventManager(e: AdminEvent, onBack: () -> Unit) {
    var tab by remember { mutableStateOf("setup") }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        BackLine(e.title, onBack)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("setup" to "Registration setup", "people" to "Registrations").forEach { (k, label) ->
                val on = tab == k
                Text(label, color = if (on) Brand.Black else Brand.White, fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                    modifier = (if (on) Modifier.clip(RoundedCornerShape(50)).background(Brand.GoldGradient) else Modifier.glass()).clickable { tab = k }.padding(horizontal = 14.dp, vertical = 8.dp))
            }
        }
        if (tab == "setup") SetupEditor(e) else Registrants(e)
    }
}

@Composable
private fun SetupEditor(e: AdminEvent) {
    val scope = rememberCoroutineScope()
    var mode by remember { mutableStateOf("none") }
    var formUrl by remember { mutableStateOf("") }
    var paid by remember { mutableStateOf(false) }
    var price by remember { mutableStateOf("") }
    var capacity by remember { mutableStateOf("") }
    val fields = remember { mutableStateListOf<FormField>() }
    var loaded by remember { mutableStateOf(false) }
    var saved by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(e.id) {
        runCatching { Api.decode<RegSetup>(Api.get("/events/${e.id}/registration")["setup"]) }.onSuccess { s ->
            mode = s.mode; formUrl = s.formUrl; paid = s.price > 0; price = if (s.price > 0) "${s.price}" else ""
            capacity = if (s.capacity > 0) "${s.capacity}" else ""; fields.clear(); fields.addAll(s.fields)
        }
        loaded = true
    }
    if (!loaded) { CircularProgressIndicator(color = Brand.Gold); return }
    Column(Modifier.fillMaxWidth().glass(RoundedCornerShape(20.dp), 0.85f).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("HOW DO PEOPLE REGISTER?", style = Type.Label, color = Brand.Gold)
        listOf(
            Triple("none", "No registration", "Anyone can just come"),
            Triple("form", "Form in the app", "Your own questions; answers are kept here"),
            Triple("link", "Outside form link", "e.g. a Google Form; opens in the browser"),
        ).forEach { (k, title, detail) ->
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(if (mode == k) Color(0x26D4AF37) else Color.Transparent)
                    .border(1.dp, if (mode == k) Brand.Gold else Color(0x22FFFFFF), RoundedCornerShape(14.dp)).clickable { mode = k; saved = false }.padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(18.dp).clip(CircleShape).border(2.dp, Brand.Gold, CircleShape).padding(4.dp)) { if (mode == k) Box(Modifier.fillMaxSize().clip(CircleShape).background(Brand.Gold)) }
                Spacer(Modifier.width(12.dp))
                Column {
                    Text(title, color = Brand.White, fontWeight = FontWeight.SemiBold)
                    Text(detail, style = Type.Meta, color = Brand.Text2)
                }
            }
        }
        if (mode == "link") Field("FORM LINK", formUrl, { formUrl = it.trim(); saved = false }, hint = "https://forms.gle/...", keyboard = KeyboardType.Uri)
        if (mode != "link") {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Paid event", color = Brand.White, fontWeight = FontWeight.SemiBold)
                    Text("Paid with M-Pesa, Airtel or bank; the ticket shows once finance confirms", style = Type.Meta, color = Brand.Text2)
                }
                Switch(paid, { paid = it; saved = false }, colors = SwitchDefaults.colors(checkedThumbColor = Brand.Black, checkedTrackColor = Brand.Gold, uncheckedTrackColor = Color(0x22FFFFFF)))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (paid) Field("PRICE (KSH)", price, { price = it.filter(Char::isDigit).take(7); saved = false }, Modifier.weight(1f), keyboard = KeyboardType.Number)
                Field("PLACES (BLANK = NO LIMIT)", capacity, { capacity = it.filter(Char::isDigit).take(6); saved = false }, Modifier.weight(1f), keyboard = KeyboardType.Number)
            }
        }
        if (mode == "form") {
            Text("QUESTIONS", style = Type.Label, color = Brand.Gold, modifier = Modifier.padding(top = 4.dp))
            if (fields.isEmpty()) Text("No questions: members just tap Register. Add questions to collect details.", style = Type.Meta, color = Brand.Text2)
            fields.forEachIndexed { index, f -> QuestionEditor(f, { fields[index] = it; saved = false }) { fields.removeAt(index); saved = false } }
            Row(Modifier.clip(RoundedCornerShape(50)).border(1.dp, Brand.Gold, RoundedCornerShape(50)).clickable { fields.add(FormField(label = "", type = "text")); saved = false }.padding(horizontal = 14.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Rounded.Add, null, tint = Brand.Gold, modifier = Modifier.size(18.dp))
                Text(" Add question", color = Brand.Gold, fontWeight = FontWeight.SemiBold)
            }
        }
        ErrorNote(error)
        if (saved) Text("Saved. Members see this on the event page now.", color = Color(0xFF4ADE80), fontSize = 13.sp)
        GoldButton("Save") {
            scope.launch {
                error = null
                runCatching {
                    Api.put("/admin/events/${e.id}/registration", mapOf(
                        "mode" to mode, "formUrl" to formUrl, "price" to (if (paid && mode != "link") price.toIntOrNull() ?: 0 else 0),
                        "capacity" to (capacity.toIntOrNull() ?: 0),
                        "fields" to fields.map { mapOf("id" to it.id, "label" to it.label, "type" to it.type, "required" to it.required, "options" to it.options) },
                    ))
                }.onSuccess { saved = true; it["setup"]?.let { s -> Api.decode<RegSetup>(s).fields.let { f -> fields.clear(); fields.addAll(f) } } }.onFailure { error = it.message }
            }
        }
    }
}

@Composable
private fun QuestionEditor(f: FormField, change: (FormField) -> Unit, remove: () -> Unit) {
    var options by remember(f.id) { mutableStateOf(f.options.joinToString(", ")) }
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color(0x14FFFFFF)).padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.Bottom) {
            Field("QUESTION", f.label, { change(f.copy(label = it.take(120))) }, Modifier.weight(1f), hint = "e.g. Phone number")
            Icon(Icons.Rounded.Delete, "Remove question", tint = Brand.Text2, modifier = Modifier.padding(start = 6.dp, bottom = 6.dp).size(40.dp).clip(CircleShape).clickable(onClick = remove).padding(9.dp))
        }
        LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            items(fieldTypes) { (k, label) ->
                val on = f.type == k
                Text(label, color = if (on) Brand.Black else Brand.White, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold,
                    modifier = (if (on) Modifier.clip(RoundedCornerShape(50)).background(Brand.GoldGradient) else Modifier.glass()).clickable { change(f.copy(type = k)) }.padding(horizontal = 12.dp, vertical = 6.dp))
            }
        }
        if (f.type == "choice") Field("OPTIONS (COMMA SEPARATED)", options, { options = it; change(f.copy(options = it.split(",").map(String::trim).filter(String::isNotEmpty))) }, hint = "S, M, L, XL")
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Required", color = Brand.White, modifier = Modifier.weight(1f))
            Switch(f.required, { change(f.copy(required = it)) }, colors = SwitchDefaults.colors(checkedThumbColor = Brand.Black, checkedTrackColor = Brand.Gold, uncheckedTrackColor = Color(0x22FFFFFF)))
        }
    }
}

@Composable
private fun Registrants(e: AdminEvent) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val list = remember { mutableStateListOf<Registrant>() }
    val fields = remember { mutableStateListOf<FormField>() }
    var price by remember { mutableIntStateOf(0) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(e.id) {
        runCatching { Api.get("/admin/events/${e.id}/registrations") }.onSuccess { res ->
            list.clear(); list.addAll(Api.decode<List<Registrant>>(res["registrations"]))
            val s = Api.decode<RegSetup>(res["setup"]); fields.clear(); fields.addAll(s.fields); price = s.price
        }.onFailure { error = it.message }
    }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "${list.size} registered" + if (price > 0) " · ${list.count { it.payment == "paid" }} paid" else "",
                style = Type.CardTitle, color = Brand.White, modifier = Modifier.weight(1f),
            )
            if (list.isNotEmpty()) Row(Modifier.glass().clickable {
                // The spreadsheet, shared to email, WhatsApp, Drive…
                scope.launch {
                    runCatching {
                        withContext(Dispatchers.IO) {
                            val req = Request.Builder().url("${BuildConfig.API_BASE}/api/v1/admin/events/${e.id}/registrations.csv").apply { Api.token?.let { header("Authorization", "Bearer $it") } }.build()
                            val file = File(File(context.cacheDir, "share").apply { mkdirs() }, "registrations-${e.id}.csv")
                            Api.http.newCall(req).execute().use { r -> file.writeBytes(r.body!!.bytes()) }
                            file
                        }
                    }.onSuccess { file ->
                        val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
                        context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/csv").putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION), "Share registrations"))
                    }.onFailure { error = it.message }
                }
            }.padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Rounded.Share, null, tint = Brand.GoldLight, modifier = Modifier.size(16.dp))
                Text(" Spreadsheet", color = Brand.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }
        }
        ErrorNote(error)
        if (list.isEmpty()) Text("No one has registered yet.", style = Type.Meta, color = Brand.Text2)
        list.forEach { r ->
            Column(Modifier.fillMaxWidth().glass(RoundedCornerShape(18.dp), 0.85f).padding(14.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(r.name, style = Type.CardTitle, color = Brand.White)
                        Text(r.email, style = Type.Meta, color = Brand.Text2)
                    }
                    if (price > 0) {
                        val (label, color) = when (r.payment) { "paid" -> "Paid" to Color(0xFF4ADE80); "pending" -> "Checking" to Brand.GoldLight; else -> "Not paid" to Brand.Red }
                        Text(label, color = color, fontWeight = FontWeight.Bold, fontSize = 12.5.sp)
                    }
                }
                fields.forEach { f -> r.answers[f.id]?.takeIf { it.isNotBlank() }?.let { Text("${f.label}: $it", style = Type.Meta.copy(fontSize = 13.sp), color = Color(0xFFDADADF), modifier = Modifier.padding(top = 4.dp)) } }
                if (r.ticket.isNotBlank() && (price == 0 || r.payment == "paid")) Text("Ticket ${r.ticket}", style = Type.Label, color = Brand.Gold, modifier = Modifier.padding(top = 6.dp))
            }
        }
    }
}
