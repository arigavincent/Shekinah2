package com.shekinahsons.globalapp.admin

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
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
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Image
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.shekinahsons.globalapp.data.Api
import com.shekinahsons.globalapp.ui.components.ErrorNote
import com.shekinahsons.globalapp.ui.components.FadeImage
import com.shekinahsons.globalapp.ui.components.Field
import com.shekinahsons.globalapp.ui.components.GhostButton
import com.shekinahsons.globalapp.ui.components.GoldButton
import com.shekinahsons.globalapp.ui.components.glass
import com.shekinahsons.globalapp.ui.components.pressable
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Type
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

@Composable
private fun Header(title: String, onBack: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 6.dp)) {
        Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back", tint = Brand.White, modifier = Modifier.size(40.dp).clip(CircleShape).clickable(onClick = onBack).padding(8.dp))
        Spacer(Modifier.width(6.dp))
        Text(title, style = Type.Title, color = Brand.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

// ---------------------------------------------------------------- Branches

@Serializable
data class AdminBranch(
    val id: String = "", val name: String = "", val address: String = "", val services: String = "", val phone: String = "",
    val latitude: Double = 0.0, val longitude: Double = 0.0, val imageUrl: String = "",
)

// Branches: add and edit the church's locations; they show in the app at once.
@Composable
fun AdminBranchesPane() {
    val branches = remember { mutableStateListOf<AdminBranch>() }
    var editing by remember { mutableStateOf<AdminBranch?>(null) }
    var reload by remember { mutableIntStateOf(0) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(reload) {
        runCatching { Api.decode<List<AdminBranch>>(Api.get("/admin/branches")["branches"]) }.onSuccess { branches.clear(); branches.addAll(it) }.onFailure { error = it.message }
    }
    val e = editing
    if (e != null) { BranchEditor(e, onBack = { editing = null }) { editing = null; reload++ }; return }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        GoldButton("Add a branch") { editing = AdminBranch() }
        ErrorNote(error)
        if (branches.isEmpty()) Text("No branches yet.", style = Type.Meta, color = Brand.Text2)
        branches.forEach { b ->
            Row(Modifier.fillMaxWidth().glass(RoundedCornerShape(18.dp), 0.85f).pressable { editing = b }.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                FadeImage(b.imageUrl, Modifier.size(64.dp).clip(RoundedCornerShape(12.dp)), label = "BRANCH")
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(b.name, style = Type.CardTitle, color = Brand.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(b.address, style = Type.Meta, color = Brand.Text2, maxLines = 1)
                    Text(b.phone, style = Type.Meta, color = Brand.GoldLight)
                }
                Text("Edit", color = Brand.GoldLight, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            }
        }
    }
}

@Composable
private fun BranchEditor(b: AdminBranch, onBack: () -> Unit, done: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf(b.name) }
    var address by remember { mutableStateOf(b.address) }
    var services by remember { mutableStateOf(b.services) }
    var phone by remember { mutableStateOf(b.phone) }
    var lat by remember { mutableStateOf(if (b.latitude != 0.0) "${b.latitude}" else "") }
    var lng by remember { mutableStateOf(if (b.longitude != 0.0) "${b.longitude}" else "") }
    var image by remember { mutableStateOf<Uri?>(null) }
    var busy by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val pick = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { if (it != null) image = it }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Header(if (b.id.isBlank()) "New branch" else b.name, onBack)
        Box(Modifier.fillMaxWidth().aspectRatio(16 / 9f).clip(RoundedCornerShape(18.dp)).glass(RoundedCornerShape(18.dp))
            .clickable { pick.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }, contentAlignment = Alignment.Center) {
            when {
                image != null -> AsyncImage(image, "Photo", contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                b.imageUrl.isNotBlank() -> FadeImage(b.imageUrl, Modifier.fillMaxSize())
                else -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Rounded.Image, null, tint = Brand.Gold, modifier = Modifier.size(32.dp))
                    Text("Add a photo of the church", color = Brand.Text2)
                }
            }
        }
        Field("BRANCH NAME", name, { name = it.take(120) }, hint = "e.g. Shekinah Sons Global - Kisumu")
        Field("ADDRESS / AREA", address, { address = it.take(200) }, hint = "e.g. Milimani, Kisumu")
        Field("SERVICE TIMES", services, { services = it.take(300) }, hint = "Sunday 9:00 AM · Wednesday 5:30 PM", minHeight = 80.dp, singleLine = false)
        Field("PHONE", phone, { phone = it.take(30) }, keyboard = KeyboardType.Phone)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Field("LATITUDE (OPTIONAL)", lat, { lat = it.take(14) }, Modifier.weight(1f), keyboard = KeyboardType.Decimal)
            Field("LONGITUDE", lng, { lng = it.take(14) }, Modifier.weight(1f), keyboard = KeyboardType.Decimal)
        }
        Text("Coordinates let members open directions in Maps. In Google Maps, long-press the church and copy the numbers shown.", style = Type.Meta, color = Brand.Text2)
        ErrorNote(error)
        GoldButton(if (b.id.isBlank()) "Add branch" else "Save changes", busy = busy, enabled = name.isNotBlank() && address.isNotBlank()) {
            scope.launch {
                busy = true; error = null
                runCatching {
                    val url = image?.let { uploadImage(context, it) } ?: b.imageUrl
                    val body = mapOf("name" to name.trim(), "address" to address.trim(), "services" to services.trim(), "phone" to phone.trim(),
                        "latitude" to (lat.toDoubleOrNull() ?: 0.0), "longitude" to (lng.toDoubleOrNull() ?: 0.0), "imageUrl" to url)
                    if (b.id.isBlank()) Api.post("/admin/branches", body) else Api.patch("/admin/branches/${b.id}", body)
                }.onSuccess { done() }.onFailure { error = it.message }
                busy = false
            }
        }
        if (b.id.isNotBlank()) {
            if (!confirmDelete) GhostButton("Remove this branch") { confirmDelete = true }
            else Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(Modifier.weight(1f)) { GhostButton("Keep it") { confirmDelete = false } }
                Row(Modifier.weight(1f).height(50.dp).clip(RoundedCornerShape(50)).background(Brand.Red).clickable {
                    scope.launch { runCatching { Api.delete("/admin/branches/${b.id}") }.onSuccess { done() }.onFailure { error = it.message } }
                }, horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.Delete, null, tint = Color.White, modifier = Modifier.size(18.dp))
                    Text(" Remove", color = Color.White, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

// ---------------------------------------------------------------- Serve

@Serializable
data class AdminTeam(
    val id: String = "", val name: String = "", val description: String = "", val icon: String = "groups", val leaderName: String = "",
    val leaderEmail: String = "", val leaderPhone: String = "", val sortOrder: Int = 0, val isActive: Boolean = true, val members: Int = 0,
)

@Serializable
data class ServeRequest(
    val id: String = "", val team: String = "", val teamId: String = "", val name: String = "", val email: String = "", val phone: String = "",
    val availability: String = "", val message: String = "", val status: String = "new", val emailed: Boolean = false, val createdAt: String = "",
)

private val teamIcons = listOf("music", "camera", "door", "child", "youth", "prayer", "outreach", "hospitality", "groups")

// Serve: requests to join teams, and each team's leader (who gets them by email).
@Composable
fun AdminServePane() {
    val scope = rememberCoroutineScope()
    val teams = remember { mutableStateListOf<AdminTeam>() }
    val requests = remember { mutableStateListOf<ServeRequest>() }
    var contact by remember { mutableStateOf("") }
    var emailReady by remember { mutableStateOf(true) }
    var view by remember { mutableStateOf("requests") }
    var editing by remember { mutableStateOf<AdminTeam?>(null) }
    var reload by remember { mutableIntStateOf(0) }
    var error by remember { mutableStateOf<String?>(null) }
    var loaded by remember { mutableStateOf(false) }
    LaunchedEffect(reload) {
        runCatching { Api.get("/admin/serve") }.onSuccess { res ->
            teams.clear(); teams.addAll(Api.decode<List<AdminTeam>>(res["teams"]))
            requests.clear(); requests.addAll(Api.decode<List<ServeRequest>>(res["requests"]))
            contact = Api.decode(res["contactEmail"]); emailReady = Api.decode(res["emailReady"])
        }.onFailure { error = it.message }
        loaded = true
    }
    val e = editing
    if (e != null) { TeamEditor(e, onBack = { editing = null }) { editing = null; reload++ }; return }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("requests" to "Requests (${requests.count { it.status == "new" }} new)", "teams" to "Teams & leaders").forEach { (k, label) ->
                val on = view == k
                Text(label, color = if (on) Brand.Black else Brand.White, fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                    modifier = (if (on) Modifier.clip(RoundedCornerShape(50)).background(Brand.GoldGradient) else Modifier.glass()).clickable { view = k }.padding(horizontal = 14.dp, vertical = 8.dp))
            }
        }
        if (!emailReady) Text("Emails aren't set up on the server yet, so leaders won't get them. Requests are still all listed here.",
            style = Type.Meta, color = Brand.GoldLight, modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Color(0x22D4AF37)).padding(12.dp))
        ErrorNote(error)
        if (!loaded) CircularProgressIndicator(color = Brand.Gold)
        if (view == "requests") {
            if (loaded && requests.isEmpty()) Text("No requests yet.", style = Type.Meta, color = Brand.Text2)
            requests.forEach { r ->
                Column(Modifier.fillMaxWidth().glass(RoundedCornerShape(18.dp), 0.85f).padding(14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(r.name, style = Type.CardTitle, color = Brand.White)
                            Text("${r.team} · ${r.phone}", style = Type.Meta, color = Brand.GoldLight)
                            Text(r.email, style = Type.Meta, color = Brand.Text2)
                        }
                        Text(if (r.emailed) "Emailed" else "", style = Type.Meta, color = Color(0xFF4ADE80))
                    }
                    if (r.availability.isNotBlank()) Text("Available: ${r.availability}", style = Type.Meta.copy(fontSize = 13.sp), color = Color(0xFFDADADF), modifier = Modifier.padding(top = 6.dp))
                    if (r.message.isNotBlank()) Text(r.message, style = Type.Body.copy(fontSize = 14.sp), color = Color(0xFFDADADF), modifier = Modifier.padding(top = 4.dp))
                    Spacer(Modifier.height(10.dp))
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        items(listOf("new" to "New", "contacted" to "Contacted", "placed" to "On the team", "declined" to "Not now")) { (k, label) ->
                            val on = r.status == k
                            Text(label, color = if (on) Brand.Black else Brand.White, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold,
                                modifier = (if (on) Modifier.clip(RoundedCornerShape(50)).background(Brand.GoldGradient) else Modifier.glass()).clickable {
                                    scope.launch { runCatching { Api.patch("/admin/serve/requests/${r.id}", mapOf("status" to k)) }.onSuccess { reload++ }.onFailure { error = it.message } }
                                }.padding(horizontal = 12.dp, vertical = 6.dp))
                        }
                    }
                }
            }
        } else {
            Column(Modifier.fillMaxWidth().glass(RoundedCornerShape(18.dp), 0.85f).padding(14.dp)) {
                Text("SERVE COORDINATOR", style = Type.Label, color = Brand.Gold)
                Text("Gets requests for teams without a leader email.", style = Type.Meta, color = Brand.Text2, modifier = Modifier.padding(bottom = 8.dp))
                Row(verticalAlignment = Alignment.Bottom) {
                    Field("EMAIL", contact, { contact = it.trim() }, Modifier.weight(1f), keyboard = KeyboardType.Email)
                    Spacer(Modifier.width(8.dp))
                    Text("Save", color = Brand.Black, fontWeight = FontWeight.Bold, modifier = Modifier.clip(RoundedCornerShape(50)).background(Brand.Gold).clickable {
                        scope.launch { runCatching { Api.put("/admin/serve/contact", mapOf("email" to contact)) }.onSuccess { reload++ }.onFailure { error = it.message } }
                    }.padding(horizontal = 18.dp, vertical = 15.dp))
                }
            }
            GoldButton("Add a team") { editing = AdminTeam(sortOrder = teams.size) }
            teams.forEach { t ->
                Row(Modifier.fillMaxWidth().glass(RoundedCornerShape(18.dp), 0.85f).pressable { editing = t }.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(t.name + if (!t.isActive) " (hidden)" else "", style = Type.CardTitle, color = Brand.White)
                        Text(if (t.leaderName.isNotBlank()) "Leader: ${t.leaderName}" else "No leader set", style = Type.Meta, color = if (t.leaderName.isNotBlank()) Brand.GoldLight else Brand.Muted)
                        Text(t.leaderEmail.ifBlank { "Requests go to the coordinator" }, style = Type.Meta, color = Brand.Text2)
                    }
                    Text("Edit", color = Brand.GoldLight, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                }
            }
        }
    }
}

@Composable
private fun TeamEditor(t: AdminTeam, onBack: () -> Unit, done: () -> Unit) {
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf(t.name) }
    var description by remember { mutableStateOf(t.description) }
    var icon by remember { mutableStateOf(t.icon) }
    var leader by remember { mutableStateOf(t.leaderName) }
    var email by remember { mutableStateOf(t.leaderEmail) }
    var phone by remember { mutableStateOf(t.leaderPhone) }
    var active by remember { mutableStateOf(t.isActive) }
    var error by remember { mutableStateOf<String?>(null) }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Header(if (t.id.isBlank()) "New team" else t.name, onBack)
        Field("TEAM NAME", name, { name = it.take(60) })
        Field("WHAT THE TEAM DOES", description, { description = it.take(300) }, minHeight = 80.dp, singleLine = false)
        Text("ICON", style = Type.Label.copy(fontSize = 10.5.sp), color = Brand.GoldLight)
        LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            items(teamIcons) { k ->
                val on = icon == k
                Text(k, color = if (on) Brand.Black else Brand.White, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold,
                    modifier = (if (on) Modifier.clip(RoundedCornerShape(50)).background(Brand.GoldGradient) else Modifier.glass()).clickable { icon = k }.padding(horizontal = 12.dp, vertical = 6.dp))
            }
        }
        Text("TEAM LEADER (GETS THE REQUESTS)", style = Type.Label, color = Brand.Gold, modifier = Modifier.padding(top = 6.dp))
        Field("NAME", leader, { leader = it.take(80) })
        Field("EMAIL", email, { email = it.trim().take(120) }, keyboard = KeyboardType.Email)
        Field("PHONE", phone, { phone = it.take(30) }, keyboard = KeyboardType.Phone)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Show this team in the app", color = Brand.White, modifier = Modifier.weight(1f))
            Switch(active, { active = it }, colors = SwitchDefaults.colors(checkedThumbColor = Brand.Black, checkedTrackColor = Brand.Gold, uncheckedTrackColor = Color(0x22FFFFFF)))
        }
        ErrorNote(error)
        GoldButton("Save team", enabled = name.isNotBlank()) {
            scope.launch {
                error = null
                runCatching {
                    Api.put("/admin/serve/teams/${t.id.ifBlank { "new" }}", mapOf("name" to name.trim(), "description" to description.trim(), "icon" to icon,
                        "leaderName" to leader.trim(), "leaderEmail" to email, "leaderPhone" to phone.trim(), "sortOrder" to t.sortOrder, "isActive" to active))
                }.onSuccess { done() }.onFailure { error = it.message }
            }
        }
        if (t.id.isNotBlank()) GhostButton("Delete team") {
            scope.launch { runCatching { Api.delete("/admin/serve/teams/${t.id}") }.onSuccess { done() }.onFailure { error = it.message } }
        }
    }
}
