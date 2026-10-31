package com.shekinahsons.globalapp.admin

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.material3.HorizontalDivider
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.data.Api
import com.shekinahsons.globalapp.ui.components.*
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Type
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*

// ─── Data models ─────────────────────────────────────────────────────────────

@Serializable
data class SaUser(
    val id: String = "", val name: String = "", val email: String = "",
    val role: String = "member", val membershipStatus: String = "member",
    val phone: String = "", val suspended: Boolean = false, val deleted: Boolean = false,
    val createdAt: String = "",
)

@Serializable
data class SaGroup(
    val id: String = "", val name: String = "", val type: String = "ministry",
    val leaderId: String = "", val leaderName: String = "", val location: String = "",
    val schedule: String = "", val memberCount: Int = 0, val archived: Boolean = false,
)

@Serializable
data class SaAttendanceSession(
    val id: String = "", val title: String = "", val occasion: String = "",
    val sessionDate: String = "", val headcount: Int = 0, val notes: String = "",
    val kioskLocked: Boolean = false,
)

@Serializable
data class SaAuditEntry(
    val id: String = "", val actorEmail: String = "", val method: String = "",
    val route: String = "", val itemId: String = "", val createdAt: String = "",
)

@Serializable
data class SaCommTemplate(
    val id: String = "", val name: String = "", val channel: String = "sms",
    val subject: String = "", val body: String = "", val isActive: Boolean = true,
)

@Serializable
data class SaApiKey(
    val id: String = "", val name: String = "", val prefix: String = "",
    val permissions: List<String> = emptyList(), val lastUsedAt: String = "",
    val expiresAt: String = "", val revoked: Boolean = false,
)

@Serializable
data class SaWebhook(
    val id: String = "", val url: String = "", val events: List<String> = emptyList(),
    val isActive: Boolean = true, val lastStatus: Int = 0,
)

@Serializable
data class SaKiosk(
    val id: String = "", val name: String = "", val location: String = "",
    val serialNumber: String = "", val locked: Boolean = false, val pairedAt: String = "",
)

// ─── Main SuperAdminPage ──────────────────────────────────────────────────────

@Composable
internal fun SuperAdminPage() {
    var view by rememberSaveable { mutableStateOf("members") }
    val tools = listOf(
        "members" to "Members",
        "groups" to "Groups",
        "attendance" to "Attendance",
        "kiosks" to "Kiosks",
        "templates" to "Comm Templates",
        "apikeys" to "API Keys",
        "webhooks" to "Webhooks",
        "audit" to "Audit Trail",
        "modules" to "System Modules",
        "backup" to "Backup & GDPR",
    )
    LazyColumn(contentPadding = pagePadding, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { PageTitle("Super Admin", "Full system governance & control") }
        item { ToolChoices(tools, view) { view = it } }
        when (view) {
            "members"   -> item { SaMembersPane() }
            "groups"    -> item { SaGroupsPane() }
            "attendance"-> item { SaAttendancePane() }
            "kiosks"    -> item { SaKiosksPane() }
            "templates" -> item { SaTemplatesPane() }
            "apikeys"   -> item { SaApiKeysPane() }
            "webhooks"  -> item { SaWebhooksPane() }
            "audit"     -> item { SaAuditPane() }
            "modules"   -> item { SaModulesPane() }
            "backup"    -> item { SaBackupPane() }
        }
    }
}

// ─── Members Pane ─────────────────────────────────────────────────────────────

@Composable
internal fun SaMembersPane() {
    val scope = rememberCoroutineScope()
    val list = remember { mutableStateListOf<SaUser>() }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var query by remember { mutableStateOf("") }
    var selected by remember { mutableStateOf<SaUser?>(null) }

    LaunchedEffect(Unit) {
        runCatching {
            val resp = Api.get("/admin/members")
            Api.decode<List<SaUser>>(resp["members"])
        }.onSuccess { list.addAll(it) }.onFailure { error = it.message }
        loading = false
    }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Field("SEARCH", query, { query = it }, hint = "Name or email…")
        ErrorNote(error)
        if (loading) Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = Brand.Gold)
        }
        val shown = list.filter { u ->
            query.isBlank() || u.name.contains(query, true) || u.email.contains(query, true)
        }
        shown.forEach { u ->
            Column(
                Modifier.fillMaxWidth().glass(RoundedCornerShape(18.dp), 0.9f)
                    .clickable { selected = u }.padding(14.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(36.dp).clip(CircleShape).background(Brand.GoldGradient), contentAlignment = Alignment.Center) {
                        Text(u.name.firstOrNull()?.uppercase() ?: "?", color = Brand.Black, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                    }
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(u.name, color = Brand.White, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        Text(u.email, style = Type.Meta, color = Brand.Text2)
                    }
                    Text(u.role.uppercase(), style = Type.Label, color = if (u.role == "super_admin") Brand.Gold else Brand.Text2)
                }
                if (u.suspended) Spacer(Modifier.height(4.dp)).also {
                    Text("SUSPENDED", style = Type.Label, color = Color(0xFFFF6B6B))
                }
            }
        }
        selected?.let { u ->
            SaUserDetailDialog(u,
                onDismiss = { selected = null },
                onSuspend = { scope.launch {
                    runCatching { Api.post("/admin/sa/users/${u.id}/suspend", emptyMap<String, String>()) }
                        .onSuccess {
                            val idx = list.indexOfFirst { it.id == u.id }
                            if (idx >= 0) list[idx] = u.copy(suspended = !u.suspended)
                            selected = null
                        }.onFailure { error = it.message }
                }},
                onSoftDelete = { scope.launch {
                    runCatching { Api.delete("/admin/sa/users/${u.id}?mode=soft") }
                        .onSuccess { list.removeAll { it.id == u.id }; selected = null }
                        .onFailure { error = it.message }
                }}
            )
        }
    }
}

@Composable
internal fun SaUserDetailDialog(user: SaUser, onDismiss: () -> Unit, onSuspend: () -> Unit, onSoftDelete: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF1A1A1E),
        title = { Text(user.name, color = Brand.White, fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Email: ${user.email}", color = Brand.Text2, fontSize = 13.sp)
                Text("Role: ${user.role}", color = Brand.Text2, fontSize = 13.sp)
                Text("Status: ${user.membershipStatus}", color = Brand.Text2, fontSize = 13.sp)
                if (user.phone.isNotBlank()) Text("Phone: ${user.phone}", color = Brand.Text2, fontSize = 13.sp)
                HorizontalDivider(color = Brand.Line, modifier = Modifier.padding(vertical = 8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        if (user.suspended) "Reactivate" else "Suspend",
                        color = if (user.suspended) Color(0xFF4ADE80) else Color(0xFFFF6B6B),
                        fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                        modifier = Modifier.glass().clickable(onClick = onSuspend).padding(horizontal = 14.dp, vertical = 8.dp)
                    )
                    Text(
                        "Soft Delete",
                        color = Color(0xFFFF6B6B), fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                        modifier = Modifier.glass().clickable(onClick = onSoftDelete).padding(horizontal = 14.dp, vertical = 8.dp)
                    )
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Close", color = Brand.Gold) } }
    )
}

// ─── Groups Pane ──────────────────────────────────────────────────────────────

@Composable
internal fun SaGroupsPane() {
    val scope = rememberCoroutineScope()
    val list = remember { mutableStateListOf<SaGroup>() }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var showCreate by remember { mutableStateOf(false) }
    var newName by remember { mutableStateOf("") }
    var newType by remember { mutableStateOf("ministry") }
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        runCatching {
            val resp = Api.get("/admin/sa/groups")
            Api.decode<List<SaGroup>>(resp["groups"])
        }.onSuccess { list.addAll(it) }.onFailure { error = it.message }
        loading = false
    }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Ministry Groups", color = Brand.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Text("+ New", color = Brand.Gold, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { showCreate = true })
        }
        ErrorNote(error)
        if (loading) CircularProgressIndicator(color = Brand.Gold, modifier = Modifier.align(Alignment.CenterHorizontally))
        list.forEach { g ->
            Row(
                Modifier.fillMaxWidth().glass(RoundedCornerShape(16.dp), 0.9f).padding(14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(Modifier.weight(1f)) {
                    Text(g.name, color = Brand.White, fontWeight = FontWeight.SemiBold)
                    Text("${g.type.uppercase()} · ${g.memberCount} members", style = Type.Meta, color = Brand.Text2)
                    if (g.location.isNotBlank()) Text(g.location, style = Type.Meta, color = Brand.Muted)
                }
                Text(
                    "Archive",
                    color = Color(0xFFFF6B6B), fontSize = 12.sp,
                    modifier = Modifier.clickable {
                        scope.launch {
                            runCatching { Api.delete("/admin/sa/groups/${g.id}?mode=soft") }
                                .onSuccess { list.removeAll { it.id == g.id } }
                                .onFailure { error = it.message }
                        }
                    }
                )
            }
        }
        if (showCreate) {
            AlertDialog(
                onDismissRequest = { showCreate = false },
                containerColor = Color(0xFF1A1A1E),
                title = { Text("New Group", color = Brand.White) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Field("GROUP NAME", newName, { newName = it })
                        Chips(listOf("ministry" to "Ministry", "department" to "Department", "small_group" to "Small Group", "sunday_school" to "Sunday School"), newType) { newType = it }
                    }
                },
                confirmButton = {
                    GoldButton("Create", busy = busy, enabled = newName.isNotBlank()) {
                        scope.launch {
                            busy = true
                            runCatching {
                                Api.put("/admin/sa/groups", mapOf("name" to newName, "type" to newType))
                                val resp = Api.get("/admin/sa/groups")
                                Api.decode<List<SaGroup>>(resp["groups"])
                            }.onSuccess { g -> list.clear(); list.addAll(g); showCreate = false; newName = "" }
                                .onFailure { error = it.message }
                            busy = false
                        }
                    }
                },
                dismissButton = { TextButton(onClick = { showCreate = false }) { Text("Cancel", color = Brand.Text2) } }
            )
        }
    }
}

// ─── Attendance Pane ─────────────────────────────────────────────────────────

@Composable
internal fun SaAttendancePane() {
    val scope = rememberCoroutineScope()
    val list = remember { mutableStateListOf<SaAttendanceSession>() }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var showCreate by remember { mutableStateOf(false) }
    var title by remember { mutableStateOf("") }
    var occasion by remember { mutableStateOf("Sunday Service") }
    var headcount by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        runCatching {
            val resp = Api.get("/admin/sa/attendance/sessions")
            Api.decode<List<SaAttendanceSession>>(resp["sessions"])
        }.onSuccess { list.addAll(it) }.onFailure { error = it.message }
        loading = false
    }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Attendance Sessions", color = Brand.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Text("+ New", color = Brand.Gold, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { showCreate = true })
        }
        ErrorNote(error)
        if (loading) CircularProgressIndicator(color = Brand.Gold, modifier = Modifier.align(Alignment.CenterHorizontally))
        list.forEach { s ->
            Row(
                Modifier.fillMaxWidth().glass(RoundedCornerShape(16.dp), 0.9f).padding(14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(Modifier.weight(1f)) {
                    Text(s.title, color = Brand.White, fontWeight = FontWeight.SemiBold)
                    Text("${s.occasion} · ${s.headcount} present", style = Type.Meta, color = Brand.Text2)
                    Text(s.sessionDate.take(10), style = Type.Meta, color = Brand.Muted)
                }
                if (s.kioskLocked) Icon(Icons.Rounded.Lock, null, tint = Brand.Gold, modifier = Modifier.size(16.dp))
            }
        }
        if (showCreate) {
            AlertDialog(
                onDismissRequest = { showCreate = false },
                containerColor = Color(0xFF1A1A1E),
                title = { Text("New Session", color = Brand.White) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Field("SESSION TITLE", title, { title = it })
                        Field("OCCASION", occasion, { occasion = it })
                        Field("HEADCOUNT", headcount, { headcount = it.filter { c -> c.isDigit() } })
                    }
                },
                confirmButton = {
                    GoldButton("Create", busy = busy, enabled = title.isNotBlank()) {
                        scope.launch {
                            busy = true
                            runCatching {
                                Api.post("/admin/sa/attendance/sessions", mapOf(
                                    "title" to title, "occasion" to occasion,
                                    "headcount" to (headcount.toIntOrNull() ?: 0),
                                    "sessionDate" to java.time.LocalDate.now().toString()
                                ))
                            }.onSuccess {
                                val resp = Api.get("/admin/sa/attendance/sessions")
                                list.clear(); list.addAll(Api.decode<List<SaAttendanceSession>>(resp["sessions"]))
                                showCreate = false; title = ""; headcount = ""
                            }.onFailure { error = it.message }
                            busy = false
                        }
                    }
                },
                dismissButton = { TextButton(onClick = { showCreate = false }) { Text("Cancel", color = Brand.Text2) } }
            )
        }
    }
}

// ─── Kiosks Pane ─────────────────────────────────────────────────────────────

@Composable
internal fun SaKiosksPane() {
    val scope = rememberCoroutineScope()
    val list = remember { mutableStateListOf<SaKiosk>() }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var showPair by remember { mutableStateOf(false) }
    var kioskName by remember { mutableStateOf("") }
    var kioskLoc by remember { mutableStateOf("") }
    var kioskSerial by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        runCatching {
            val resp = Api.get("/admin/sa/kiosks")
            Api.decode<List<SaKiosk>>(resp["kiosks"])
        }.onSuccess { list.addAll(it) }.onFailure { error = it.message }
        loading = false
    }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("POS & Kiosks", color = Brand.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Text("+ Pair", color = Brand.Gold, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { showPair = true })
        }
        ErrorNote(error)
        if (loading) CircularProgressIndicator(color = Brand.Gold, modifier = Modifier.align(Alignment.CenterHorizontally))
        if (!loading && list.isEmpty()) Empty("No kiosks paired yet.")
        list.forEach { k ->
            Row(
                Modifier.fillMaxWidth().glass(RoundedCornerShape(16.dp), 0.9f).padding(14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(Modifier.weight(1f)) {
                    Text(k.name, color = Brand.White, fontWeight = FontWeight.SemiBold)
                    Text(k.location, style = Type.Meta, color = Brand.Text2)
                    Text("SN: ${k.serialNumber}", style = Type.Meta, color = Brand.Muted)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(if (k.locked) "Unlock" else "Lock", color = Brand.Gold, fontSize = 12.sp,
                        modifier = Modifier.clickable {
                            scope.launch {
                                runCatching { Api.patch("/admin/sa/kiosks/${k.id}/lock", mapOf("locked" to !k.locked)) }
                                    .onSuccess { val i = list.indexOfFirst { it.id == k.id }; if (i >= 0) list[i] = k.copy(locked = !k.locked) }
                                    .onFailure { error = it.message }
                            }
                        })
                    Text("Unbind", color = Color(0xFFFF6B6B), fontSize = 12.sp,
                        modifier = Modifier.clickable {
                            scope.launch {
                                runCatching { Api.delete("/admin/sa/kiosks/${k.id}") }
                                    .onSuccess { list.removeAll { it.id == k.id } }
                                    .onFailure { error = it.message }
                            }
                        })
                }
            }
        }
        if (showPair) {
            AlertDialog(
                onDismissRequest = { showPair = false },
                containerColor = Color(0xFF1A1A1E),
                title = { Text("Pair New Kiosk", color = Brand.White) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Field("KIOSK NAME", kioskName, { kioskName = it })
                        Field("LOCATION", kioskLoc, { kioskLoc = it })
                        Field("SERIAL NUMBER", kioskSerial, { kioskSerial = it })
                    }
                },
                confirmButton = {
                    GoldButton("Pair", busy = busy, enabled = kioskName.isNotBlank()) {
                        scope.launch {
                            busy = true
                            runCatching {
                                Api.post("/admin/sa/kiosks", mapOf("name" to kioskName, "location" to kioskLoc, "serialNumber" to kioskSerial))
                                val resp = Api.get("/admin/sa/kiosks")
                                Api.decode<List<SaKiosk>>(resp["kiosks"])
                            }.onSuccess { k -> list.clear(); list.addAll(k); showPair = false; kioskName = ""; kioskLoc = ""; kioskSerial = "" }
                                .onFailure { error = it.message }
                            busy = false
                        }
                    }
                },
                dismissButton = { TextButton(onClick = { showPair = false }) { Text("Cancel", color = Brand.Text2) } }
            )
        }
    }
}

// ─── Comm Templates Pane ─────────────────────────────────────────────────────

@Composable
internal fun SaTemplatesPane() {
    val scope = rememberCoroutineScope()
    val list = remember { mutableStateListOf<SaCommTemplate>() }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var showCreate by remember { mutableStateOf(false) }
    var tName by remember { mutableStateOf("") }
    var tChannel by remember { mutableStateOf("sms") }
    var tBody by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        runCatching {
            val resp = Api.get("/admin/sa/comm/templates")
            Api.decode<List<SaCommTemplate>>(resp["templates"])
        }.onSuccess { list.addAll(it) }.onFailure { error = it.message }
        loading = false
    }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Comm Templates", color = Brand.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Text("+ New", color = Brand.Gold, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { showCreate = true })
        }
        ErrorNote(error)
        if (loading) CircularProgressIndicator(color = Brand.Gold, modifier = Modifier.align(Alignment.CenterHorizontally))
        if (!loading && list.isEmpty()) Empty("No templates yet.")
        list.forEach { t ->
            Row(
                Modifier.fillMaxWidth().glass(RoundedCornerShape(16.dp), 0.9f).padding(14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(t.name, color = Brand.White, fontWeight = FontWeight.SemiBold)
                        Text(t.channel.uppercase(), style = Type.Label, color = Brand.Gold)
                    }
                    Text(t.body.take(80) + if (t.body.length > 80) "…" else "", style = Type.Meta, color = Brand.Text2)
                }
                Text("Del", color = Color(0xFFFF6B6B), fontSize = 12.sp,
                    modifier = Modifier.clickable {
                        scope.launch {
                            runCatching { Api.delete("/admin/sa/comm/templates/${t.id}") }
                                .onSuccess { list.removeAll { it.id == t.id } }
                                .onFailure { error = it.message }
                        }
                    })
            }
        }
        if (showCreate) {
            AlertDialog(
                onDismissRequest = { showCreate = false },
                containerColor = Color(0xFF1A1A1E),
                title = { Text("New Template", color = Brand.White) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Field("TEMPLATE NAME", tName, { tName = it })
                        Chips(listOf("sms" to "SMS", "email" to "Email", "push" to "Push", "whatsapp" to "WhatsApp"), tChannel) { tChannel = it }
                        Field("BODY", tBody, { tBody = it }, minHeight = 100.dp, singleLine = false)
                    }
                },
                confirmButton = {
                    GoldButton("Save", busy = busy, enabled = tName.isNotBlank() && tBody.isNotBlank()) {
                        scope.launch {
                            busy = true
                            runCatching {
                                Api.put("/admin/sa/comm/templates", mapOf("name" to tName, "channel" to tChannel, "body" to tBody, "isActive" to true))
                                val resp = Api.get("/admin/sa/comm/templates")
                                Api.decode<List<SaCommTemplate>>(resp["templates"])
                            }.onSuccess { t -> list.clear(); list.addAll(t); showCreate = false; tName = ""; tBody = "" }
                                .onFailure { error = it.message }
                            busy = false
                        }
                    }
                },
                dismissButton = { TextButton(onClick = { showCreate = false }) { Text("Cancel", color = Brand.Text2) } }
            )
        }
    }
}

// ─── API Keys Pane ────────────────────────────────────────────────────────────

@Composable
internal fun SaApiKeysPane() {
    val scope = rememberCoroutineScope()
    val list = remember { mutableStateListOf<SaApiKey>() }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var showCreate by remember { mutableStateOf(false) }
    var keyName by remember { mutableStateOf("") }
    var rawKey by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        runCatching {
            val resp = Api.get("/admin/sa/api-keys")
            Api.decode<List<SaApiKey>>(resp["keys"])
        }.onSuccess { list.addAll(it) }.onFailure { error = it.message }
        loading = false
    }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("API Keys", color = Brand.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Text("+ Generate", color = Brand.Gold, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { showCreate = true })
        }
        ErrorNote(error)
        if (loading) CircularProgressIndicator(color = Brand.Gold, modifier = Modifier.align(Alignment.CenterHorizontally))
        if (!loading && list.isEmpty()) Empty("No API keys yet.")
        list.forEach { k ->
            Row(
                Modifier.fillMaxWidth().glass(RoundedCornerShape(16.dp), 0.9f).padding(14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(Modifier.weight(1f)) {
                    Text(k.name, color = Brand.White, fontWeight = FontWeight.SemiBold)
                    Text("${k.prefix}••••••••", color = Brand.Text2, fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace, fontSize = 12.sp)
                    if (k.revoked) Text("REVOKED", style = Type.Label, color = Color(0xFFFF6B6B))
                }
                if (!k.revoked) Text("Revoke", color = Color(0xFFFF6B6B), fontSize = 12.sp,
                    modifier = Modifier.clickable {
                        scope.launch {
                            runCatching { Api.delete("/admin/sa/api-keys/${k.id}") }
                                .onSuccess { val i = list.indexOfFirst { it.id == k.id }; if (i >= 0) list[i] = k.copy(revoked = true) }
                                .onFailure { error = it.message }
                        }
                    })
            }
        }
        rawKey?.let { key ->
            AlertDialog(
                onDismissRequest = { rawKey = null },
                containerColor = Color(0xFF1A1A1E),
                title = { Text("API Key Generated", color = Brand.Gold) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Copy this key now — it will not be shown again.", color = Brand.Text2, fontSize = 13.sp)
                        Text(key, color = Brand.White, fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace, fontSize = 12.sp,
                            modifier = Modifier.glass().padding(10.dp))
                    }
                },
                confirmButton = { TextButton(onClick = { rawKey = null }) { Text("Done", color = Brand.Gold) } }
            )
        }
        if (showCreate) {
            AlertDialog(
                onDismissRequest = { showCreate = false },
                containerColor = Color(0xFF1A1A1E),
                title = { Text("Generate API Key", color = Brand.White) },
                text = { Field("KEY NAME", keyName, { keyName = it }, hint = "e.g. n8n Integration") },
                confirmButton = {
                    GoldButton("Generate", busy = busy, enabled = keyName.isNotBlank()) {
                        scope.launch {
                            busy = true
                            runCatching {
                                val resp = Api.post("/admin/sa/api-keys", mapOf("name" to keyName, "permissions" to listOf<String>()))
                                resp["key"]?.jsonPrimitive?.content
                            }.onSuccess { k ->
                                rawKey = k
                                val resp2 = Api.get("/admin/sa/api-keys")
                                list.clear(); list.addAll(Api.decode<List<SaApiKey>>(resp2["keys"]))
                                showCreate = false; keyName = ""
                            }.onFailure { error = it.message }
                            busy = false
                        }
                    }
                },
                dismissButton = { TextButton(onClick = { showCreate = false }) { Text("Cancel", color = Brand.Text2) } }
            )
        }
    }
}

// ─── Webhooks Pane ───────────────────────────────────────────────────────────

@Composable
internal fun SaWebhooksPane() {
    val scope = rememberCoroutineScope()
    val list = remember { mutableStateListOf<SaWebhook>() }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var showCreate by remember { mutableStateOf(false) }
    var wUrl by remember { mutableStateOf("") }
    var testResult by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        runCatching {
            val resp = Api.get("/admin/sa/webhooks")
            Api.decode<List<SaWebhook>>(resp["webhooks"])
        }.onSuccess { list.addAll(it) }.onFailure { error = it.message }
        loading = false
    }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("Webhooks", color = Brand.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Text("+ New", color = Brand.Gold, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { showCreate = true })
        }
        ErrorNote(error)
        if (loading) CircularProgressIndicator(color = Brand.Gold, modifier = Modifier.align(Alignment.CenterHorizontally))
        if (!loading && list.isEmpty()) Empty("No webhooks configured.")
        list.forEach { w ->
            Column(Modifier.fillMaxWidth().glass(RoundedCornerShape(16.dp), 0.9f).padding(14.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(w.url, color = Brand.White, fontSize = 13.sp, maxLines = 1)
                        Text("Events: ${w.events.joinToString(", ")}", style = Type.Meta, color = Brand.Text2)
                        if (w.lastStatus > 0) Text("Last: HTTP ${w.lastStatus}", style = Type.Meta,
                            color = if (w.lastStatus in 200..299) Color(0xFF4ADE80) else Color(0xFFFF6B6B))
                    }
                    Box(Modifier.size(8.dp).clip(CircleShape).background(if (w.isActive) Color(0xFF4ADE80) else Brand.Muted))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.padding(top = 8.dp)) {
                    Text("Test", color = Brand.Gold, fontSize = 12.sp, modifier = Modifier.clickable {
                        scope.launch {
                            runCatching { Api.post("/admin/sa/webhooks/${w.id}/test", emptyMap<String, String>()) }
                                .onSuccess { testResult = "Test sent — check your endpoint." }
                                .onFailure { testResult = "Failed: ${it.message}" }
                        }
                    })
                    Text("Delete", color = Color(0xFFFF6B6B), fontSize = 12.sp, modifier = Modifier.clickable {
                        scope.launch {
                            runCatching { Api.delete("/admin/sa/webhooks/${w.id}") }
                                .onSuccess { list.removeAll { it.id == w.id } }
                                .onFailure { error = it.message }
                        }
                    })
                }
            }
        }
        testResult?.let { Text(it, color = Color(0xFF4ADE80), fontSize = 13.sp) }
        if (showCreate) {
            AlertDialog(
                onDismissRequest = { showCreate = false },
                containerColor = Color(0xFF1A1A1E),
                title = { Text("New Webhook", color = Brand.White) },
                text = { Field("ENDPOINT URL", wUrl, { wUrl = it }, hint = "https://…") },
                confirmButton = {
                    GoldButton("Save", busy = busy, enabled = wUrl.startsWith("http")) {
                        scope.launch {
                            busy = true
                            runCatching {
                                Api.put("/admin/sa/webhooks", mapOf("url" to wUrl, "events" to listOf("member.created"), "isActive" to true))
                                val resp = Api.get("/admin/sa/webhooks")
                                Api.decode<List<SaWebhook>>(resp["webhooks"])
                            }.onSuccess { w -> list.clear(); list.addAll(w); showCreate = false; wUrl = "" }
                                .onFailure { error = it.message }
                            busy = false
                        }
                    }
                },
                dismissButton = { TextButton(onClick = { showCreate = false }) { Text("Cancel", color = Brand.Text2) } }
            )
        }
    }
}

// ─── Audit Trail Pane ─────────────────────────────────────────────────────────

@Composable
internal fun SaAuditPane() {
    val scope = rememberCoroutineScope()
    val list = remember { mutableStateListOf<SaAuditEntry>() }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var query by remember { mutableStateOf("") }

    LaunchedEffect(Unit) {
        runCatching {
            val resp = Api.get("/admin/sa/audit-trail?limit=50")
            Api.decode<List<SaAuditEntry>>(resp["entries"])
        }.onSuccess { list.addAll(it) }.onFailure { error = it.message }
        loading = false
    }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Audit Trail", color = Brand.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
        Field("SEARCH", query, { query = it }, hint = "Email, route…")
        ErrorNote(error)
        if (loading) CircularProgressIndicator(color = Brand.Gold, modifier = Modifier.align(Alignment.CenterHorizontally))
        val shown = list.filter { e -> query.isBlank() || e.actorEmail.contains(query, true) || e.route.contains(query, true) }
        if (!loading && shown.isEmpty()) Empty("No audit entries found.")
        shown.take(30).forEach { e ->
            Row(
                Modifier.fillMaxWidth().glass(RoundedCornerShape(14.dp), 0.9f).padding(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    Modifier.size(32.dp).clip(CircleShape).background(
                        when (e.method) { "DELETE" -> Color(0x33FF6B6B); "POST", "PUT", "PATCH" -> Color(0x33D4AF37); else -> Color(0x33FFFFFF) }
                    ), contentAlignment = Alignment.Center
                ) {
                    Text(e.method.take(3), fontSize = 9.sp, fontWeight = FontWeight.Bold,
                        color = when (e.method) { "DELETE" -> Color(0xFFFF6B6B); "POST", "PUT", "PATCH" -> Brand.Gold; else -> Brand.Text2 })
                }
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(e.actorEmail, color = Brand.White, fontSize = 12.sp, maxLines = 1)
                    Text(e.route, color = Brand.Text2, fontSize = 11.sp, maxLines = 1)
                    Text(e.createdAt.take(16).replace("T", " "), style = Type.Meta, color = Brand.Muted)
                }
            }
        }
    }
}

// ─── System Modules Pane ─────────────────────────────────────────────────────

@Composable
internal fun SaModulesPane() {
    val scope = rememberCoroutineScope()
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var success by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var modules by remember { mutableStateOf<Map<String, Boolean>>(emptyMap()) }

    val moduleLabels = listOf(
        "onlineGiving" to "Online Giving",
        "counseling" to "Counseling Module",
        "volunteerScheduling" to "Volunteer Scheduling",
        "livestream" to "Livestream",
        "communityChat" to "Community Chat",
        "attendanceKiosk" to "Attendance Kiosk",
        "taxStatements" to "Tax Statements",
    )

    LaunchedEffect(Unit) {
        runCatching {
            val resp = Api.get("/admin/sa/system/modules")
            val raw = resp["modules"]?.jsonObject ?: JsonObject(emptyMap())
            raw.entries.associate { (k, v) -> k to (v.jsonPrimitive.booleanOrNull ?: false) }
        }.onSuccess { modules = it }.onFailure { error = it.message }
        loading = false
    }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("System Modules", color = Brand.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
        ErrorNote(error)
        success?.let { Text(it, color = Color(0xFF4ADE80), fontSize = 13.sp) }
        if (loading) CircularProgressIndicator(color = Brand.Gold, modifier = Modifier.align(Alignment.CenterHorizontally))
        moduleLabels.forEach { (key, label) ->
            Row(
                Modifier.fillMaxWidth().glass(RoundedCornerShape(14.dp), 0.9f).padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(label, color = Brand.White, modifier = Modifier.weight(1f), fontSize = 14.sp)
                Switch(
                    checked = modules[key] ?: false,
                    onCheckedChange = { newVal -> modules = modules.toMutableMap().also { it[key] = newVal } },
                    colors = SwitchDefaults.colors(checkedThumbColor = Brand.Black, checkedTrackColor = Color(0xFFD4AF37))
                )
            }
        }
        GoldButton("Save Module Settings", busy = busy, enabled = modules.isNotEmpty()) {
            scope.launch {
                busy = true; error = null; success = null
                runCatching { Api.put("/admin/sa/system/modules", mapOf("modules" to modules)) }
                    .onSuccess { success = "Module settings saved." }
                    .onFailure { error = it.message }
                busy = false
            }
        }
    }
}

// ─── Backup & GDPR Pane ───────────────────────────────────────────────────────

@Composable
internal fun SaBackupPane() {
    val scope = rememberCoroutineScope()
    var backupBusy by remember { mutableStateOf(false) }
    var backupResult by remember { mutableStateOf<String?>(null) }
    var gdprId by remember { mutableStateOf("") }
    var gdprReason by remember { mutableStateOf("") }
    var gdprConfirm by remember { mutableStateOf("") }
    var gdprBusy by remember { mutableStateOf(false) }
    var gdprResult by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("Database Backup", color = Brand.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
        Column(Modifier.glass(RoundedCornerShape(18.dp), 0.9f).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Trigger a manual backup of the Shekinah database to cloud storage.", color = Brand.Text2, fontSize = 13.sp)
            backupResult?.let { Text(it, color = Color(0xFF4ADE80), fontSize = 13.sp) }
            GoldButton("Trigger Backup Now", busy = backupBusy) {
                scope.launch {
                    backupBusy = true; backupResult = null; error = null
                    runCatching { Api.post("/admin/sa/system/backup", emptyMap<String, String>()) }
                        .onSuccess { backupResult = "Backup triggered. Check cloud storage." }
                        .onFailure { error = it.message }
                    backupBusy = false
                }
            }
        }
        HorizontalDivider(color = Brand.Line)
        Text("GDPR — Right to be Forgotten", color = Color(0xFFFF6B6B), fontWeight = FontWeight.Bold, fontSize = 16.sp)
        Column(Modifier.glass(RoundedCornerShape(18.dp), 0.9f).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Permanently purge all personal data for a member. Financial records are anonymised, not deleted.", color = Brand.Text2, fontSize = 13.sp)
            Field("MEMBER ID", gdprId, { gdprId = it }, hint = "UUID of member to purge")
            Field("REASON", gdprReason, { gdprReason = it }, hint = "Legal basis for erasure")
            Field("TYPE 'PURGE' TO CONFIRM", gdprConfirm, { gdprConfirm = it })
            ErrorNote(error)
            gdprResult?.let { Text(it, color = Color(0xFF4ADE80), fontSize = 13.sp) }
            GoldButton(
                "Execute GDPR Purge",
                busy = gdprBusy,
                enabled = gdprId.isNotBlank() && gdprReason.isNotBlank() && gdprConfirm == "PURGE"
            ) {
                scope.launch {
                    gdprBusy = true; error = null; gdprResult = null
                    runCatching { Api.delete("/admin/sa/members/${gdprId.trim()}/purge-gdpr") }
                        .onSuccess { gdprResult = "Member data purged successfully." }
                        .onFailure { error = it.message }
                    gdprBusy = false
                }
            }
        }
    }
}
