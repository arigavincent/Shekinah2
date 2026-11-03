package com.shekinahsons.globalapp.admin

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.text.style.TextOverflow
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
    val phone: String = "", val isActive: Boolean = true, val archived: Boolean = false,
    val staffRoleId: String = "", val staffRole: String = "",
    val createdAt: String = "",
) { val suspended get() = !isActive }

@Serializable
data class SaGroup(
    val id: String = "", val name: String = "", val type: String = "ministry",
    val leaderId: String = "", val leaderName: String = "", val location: String = "",
    val schedule: String = "", val memberCount: Int = 0, val archived: Boolean = false, val maxCapacity: Int = 0,
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
    var view by rememberSaveable { mutableStateOf<String?>(null) }
    val gold = Brand.Gold; val blue = Color(0xFF6EA8FF); val green = Color(0xFF4ADE80); val rose = Color(0xFFFF8FA3); val violet = Color(0xFFB79CFF)
    val I = androidx.compose.material.icons.Icons.Rounded
    val groups = listOf(
        "People" to listOf(
            AdminTool("members", "Members", "Accounts, roles, suspend", I.People, gold),
            AdminTool("roles", "Roles", "What each staff role can do", I.AdminPanelSettings, gold),
            AdminTool("groups", "Groups", "Cells, ministries, classes", I.Groups, gold),
            AdminTool("templates", "Comm Templates", "Reusable messages", I.Mail, gold),
        ),
        "Gatherings" to listOf(
            AdminTool("attendance", "Attendance", "Check-ins and reports", I.FactCheck, blue),
            AdminTool("kiosks", "POS", "Check-in and sales points", I.PointOfSale, blue),
        ),
        "System" to listOf(
            AdminTool("modules", "System Modules", "Turn features on or off", I.Tune, green),
            AdminTool("audit", "Audit Trail", "Who changed what, and when", I.History, green),
            AdminTool("backup", "Backup & GDPR", "Exports and data requests", I.Backup, green),
            AdminTool("apikeys", "API Keys", "Access for other systems", I.Key, violet),
            AdminTool("webhooks", "Webhooks", "Send events to other apps", I.Webhook, violet),
        ),
    )
    val current = groups.flatMap { it.second }.firstOrNull { it.id == view }
    androidx.activity.compose.BackHandler(enabled = current != null) { view = null }
    LazyColumn(contentPadding = pagePadding, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (current == null) {
            item { PageTitle("Super Admin", "Full system governance & control") }
            toolHub(groups) { view = it }
        } else {
            item { ToolHeader(current) { view = null } }
            when (current.id) {
                "members"   -> item { SaMembersPane() }
                "roles"     -> item { SaRolesPane() }
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
}

// ─── Members Pane ─────────────────────────────────────────────────────────────

@Composable
internal fun SaMembersPane() {
    val scope = rememberCoroutineScope()
    val list = remember { mutableStateListOf<SaUser>() }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var query by rememberSaveable { mutableStateOf("") }
    var filter by rememberSaveable { mutableStateOf("all") }
    var selectedId by rememberSaveable { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        runCatching { Api.decode<List<SaUser>>(Api.get("/admin/members")["members"]) }
            .onSuccess { list.clear(); list.addAll(it) }.onFailure { error = it.message }
        loading = false
    }
    val selected = list.firstOrNull { it.id == selectedId }
    androidx.activity.compose.BackHandler(enabled = selected != null) { selectedId = null }
    if (selected != null) {
        SaMemberPage(selected,
            back = { selectedId = null },
            onSuspend = { scope.launch {
                runCatching { Api.post("/admin/sa/users/${selected.id}/suspend", emptyMap<String, String>()) }
                    .onSuccess { val i = list.indexOfFirst { it.id == selected.id }; if (i >= 0) list[i] = selected.copy(isActive = !selected.isActive) }
                    .onFailure { error = it.message }
            } },
            onArchive = { scope.launch {
                runCatching { Api.delete("/admin/sa/users/${selected.id}?mode=soft") }
                    .onSuccess { list.removeAll { it.id == selected.id }; selectedId = null }
                    .onFailure { error = it.message }
            } },
            onSaved = { updated -> val i = list.indexOfFirst { it.id == updated.id }; if (i >= 0) list[i] = updated })
        return
    }

    val weekAgo = remember { java.time.Instant.now().minus(java.time.Duration.ofDays(7)) }
    fun isNew(u: SaUser) = runCatching { java.time.Instant.parse(u.createdAt).isAfter(weekAgo) }.getOrDefault(false)
    fun isStaff(u: SaUser) = u.role != "member" || u.staffRoleId.isNotBlank()
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        StatStrip(listOf(
            Stat("${list.size}", "People"),
            Stat("${list.count(::isStaff)}", "Staff", KitBlue),
            Stat("${list.count(::isNew)}", "New this week", KitGreen),
            Stat("${list.count { it.suspended }}", "Suspended", KitRed),
        ))
        SearchBar(query, { query = it }, "Search name, email or phone")
        FilterPills(listOf("all" to "Everyone", "members" to "Members", "staff" to "Staff", "new" to "New", "suspended" to "Suspended"), filter) { filter = it }
        ErrorNote(error)
        if (loading) Loading()
        val digits = query.filter(Char::isDigit)
        val shown = list.filter { u ->
            (query.isBlank() || u.name.contains(query, true) || u.email.contains(query, true) || (digits.length >= 3 && u.phone.filter(Char::isDigit).contains(digits.trimStart('0')))) &&
                when (filter) { "members" -> !isStaff(u); "staff" -> isStaff(u); "new" -> isNew(u); "suspended" -> u.suspended; else -> true }
        }.sortedWith(compareBy<SaUser> { it.suspended }.thenBy { it.name.lowercase() })
        if (!loading && shown.isEmpty()) EmptyState(Icons.Rounded.PersonSearch, "No one found", "Try another name, or clear the filter.")
        Text("${shown.size} shown", style = Type.Meta, color = Brand.Muted)
        shown.forEach { u ->
            KitRow(
                title = u.name.ifBlank { u.email },
                line1 = listOf(u.phone, u.email).filter { it.isNotBlank() }.joinToString(" · "),
                line2 = u.staffRole.ifBlank { u.membershipStatus.replaceFirstChar(Char::uppercase) },
                leading = { PersonAvatar(u.name.ifBlank { u.email }, u.id) },
                trailing = {
                    Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        when (u.role) {
                            "super_admin" -> Badge("SUPER ADMIN", Brand.Gold)
                            "admin" -> Badge("ADMIN", KitBlue)
                        }
                        if (u.suspended) Badge("SUSPENDED", KitRed)
                        if (isNew(u)) Badge("NEW", KitGreen)
                    }
                },
                onClick = { selectedId = u.id },
            )
        }
    }
}

// One member on their own page: contact, details, role, sign-in help, account.
@Composable
internal fun SaMemberPage(user: SaUser, back: () -> Unit, onSuspend: () -> Unit, onArchive: () -> Unit, onSaved: (SaUser) -> Unit) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()
    var name by remember(user.id) { mutableStateOf(user.name) }
    var email by remember(user.id) { mutableStateOf(user.email) }
    var phone by remember(user.id) { mutableStateOf(user.phone) }
    var role by remember(user.id) { mutableStateOf(user.role) }
    var status by remember(user.id) { mutableStateOf(user.membershipStatus) }
    var staffRole by remember(user.id) { mutableStateOf(user.staffRoleId) }
    val roles = remember { mutableStateListOf<SaRole>() }
    LaunchedEffect(Unit) { runCatching { Api.decode<List<SaRole>>(Api.get("/admin/sa/roles")["roles"]) }.onSuccess { roles.clear(); roles.addAll(it) } }
    var busy by remember { mutableStateOf("") }
    var note by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var temporary by remember { mutableStateOf<String?>(null) }
    var confirmArchive by remember { mutableStateOf(false) }
    val changed = name.trim() != user.name || email != user.email || phone.trim() != user.phone || role != user.role || status != user.membershipStatus || staffRole != user.staffRoleId
    fun act(kind: String, block: suspend () -> Unit) = scope.launch {
        busy = kind; error = null; note = null; temporary = null
        runCatching { block() }.onFailure { error = it.message }
        busy = ""
    }
    fun open(uri: String) = runCatching { context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(uri))) }

    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        // Hero
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp))
                .background(androidx.compose.ui.graphics.Brush.linearGradient(listOf(personColor(user.id).copy(alpha = 0.35f), Color(0xFF141418))))
                .border(1.dp, Color(0x1FFFFFFF), RoundedCornerShape(24.dp)).padding(18.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Row(Modifier.fillMaxWidth()) {
                Text("← All members", color = Brand.GoldLight, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                    modifier = Modifier.clip(RoundedCornerShape(50)).clickable(onClick = back).padding(horizontal = 6.dp, vertical = 4.dp))
            }
            PersonAvatar(user.name.ifBlank { user.email }, user.id, 76)
            Spacer(Modifier.height(10.dp))
            Text(user.name.ifBlank { user.email }, style = Type.Title, color = Brand.White, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Badge(when (user.role) { "super_admin" -> "SUPER ADMIN"; "admin" -> "ADMIN"; else -> "MEMBER" }, if (user.role == "member") Brand.Text2 else Brand.Gold)
                Badge(user.membershipStatus.uppercase(), KitBlue)
                if (user.suspended) Badge("SUSPENDED", KitRed)
            }
            if (user.createdAt.length >= 10) Text("Joined " + user.createdAt.take(10), style = Type.Meta, color = Brand.Text2, modifier = Modifier.padding(top = 6.dp))
            Spacer(Modifier.height(14.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (user.phone.isNotBlank()) {
                    ActionPill("Call", Icons.Rounded.Call, KitGreen, Modifier.weight(1f)) { open("tel:${user.phone}") }
                    ActionPill("WhatsApp", Icons.Rounded.Chat, KitGreen, Modifier.weight(1f)) { open("https://wa.me/${user.phone.filter(Char::isDigit)}") }
                }
                if (user.email.isNotBlank()) ActionPill("Email", Icons.Rounded.Mail, KitBlue, Modifier.weight(1f)) { open("mailto:${user.email}") }
            }
        }

        KitSection("Details", "What the church knows them by") {
            Field("FULL NAME", name, { name = it })
            Field("PHONE", phone, { phone = it }, keyboard = androidx.compose.ui.text.input.KeyboardType.Phone, hint = "0712 345 678")
            Field("EMAIL", email, { email = it.trim() }, keyboard = androidx.compose.ui.text.input.KeyboardType.Email)
        }
        KitSection("Role and membership", "What they can do in the app") {
            FilterPills(listOf("member" to "Member", "admin" to "Admin", "super_admin" to "Super admin"), role) { role = it }
            Text("MEMBERSHIP", style = Type.Label.copy(fontSize = 10.sp), color = Brand.Text2)
            FilterPills(listOf("member" to "Member", "visitor" to "Visitor", "leader" to "Leader", "pastor" to "Pastor", "staff" to "Staff", "transferred" to "Transferred"), status) { status = it }
            if (roles.isNotEmpty()) {
                Text("STAFF ROLE", style = Type.Label.copy(fontSize = 10.sp), color = Brand.Text2)
                FilterPills(listOf("" to "No role") + roles.map { it.id to it.name }, staffRole) { staffRole = it }
            }
        }
        ErrorNote(error)
        note?.let { Text(it, color = KitGreen, fontSize = 13.sp) }
        GoldButton(if (busy == "save") "Saving…" else if (changed) "Save changes" else "Saved", busy = busy == "save", enabled = busy.isEmpty() && changed && name.isNotBlank() && "@" in email) {
            act("save") {
                Api.patch("/admin/sa/users/${user.id}", mapOf("name" to name.trim(), "email" to email, "phone" to phone.trim(), "role" to role, "membershipStatus" to status))
                if (staffRole != user.staffRoleId) Api.put("/admin/sa/users/${user.id}/role", mapOf("roleId" to staffRole))
                note = "Changes saved."
                onSaved(user.copy(name = name.trim(), email = email, phone = phone.trim(), role = role, membershipStatus = status, staffRoleId = staffRole, staffRole = roles.firstOrNull { it.id == staffRole }?.name.orEmpty()))
            }
        }

        KitSection("Sign-in help", "When they forget their password") {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ActionPill(if (busy == "email") "Sending…" else "Email a code", Icons.Rounded.Mail, Brand.GoldLight, Modifier.weight(1f)) {
                    if (busy.isEmpty()) act("email") { note = Api.post("/admin/members/${user.id}/reset-password", emptyMap<String, String>())["message"]?.jsonPrimitive?.content }
                }
                ActionPill(if (busy == "temp") "Setting…" else "Temporary password", Icons.Rounded.Key, Brand.GoldLight, Modifier.weight(1f)) {
                    if (busy.isEmpty()) act("temp") { temporary = Api.post("/admin/sa/users/${user.id}/temporary-password", emptyMap<String, String>())["temporaryPassword"]?.jsonPrimitive?.content }
                }
            }
            temporary?.let {
                Text("Share this privately. They choose their own password when they sign in.", style = Type.Meta, color = Brand.Text2)
                Text(it, color = Brand.White, fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace, fontSize = 17.sp,
                    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Color(0x1FFFFFFF)).padding(horizontal = 14.dp, vertical = 12.dp))
            }
        }

        KitSection("Account") {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ActionPill(if (user.suspended) "Reactivate" else "Suspend", if (user.suspended) Icons.Rounded.LockOpen else Icons.Rounded.Block, if (user.suspended) KitGreen else KitRed, Modifier.weight(1f), onSuspend)
                ActionPill("Archive", Icons.Rounded.Archive, KitRed, Modifier.weight(1f)) { confirmArchive = true }
            }
            Text(if (user.suspended) "Suspended: they can't sign in or be checked in." else "Suspending signs them out everywhere until reactivated.", style = Type.Meta, color = Brand.Text2)
        }
    }
    if (confirmArchive) AlertDialog(
        onDismissRequest = { confirmArchive = false }, containerColor = Color(0xFF1A1A1E),
        title = { Text("Archive ${user.name}?", color = Brand.White) },
        text = { Text("They disappear from the members list and can't sign in. Their giving and attendance history is kept.", color = Brand.Text2) },
        confirmButton = { TextButton(onClick = { confirmArchive = false; onArchive() }) { Text("Archive", color = KitRed) } },
        dismissButton = { TextButton(onClick = { confirmArchive = false }) { Text("Cancel", color = Brand.Text2) } },
    )
}

// ─── Groups Pane ──────────────────────────────────────────────────────────────

@Serializable
data class SaRosterMember(val userId: String = "", val name: String = "", val email: String = "", val role: String = "member", val joinedAt: String = "")

private val groupTypes = listOf("ministry" to "Ministry", "department" to "Department", "small_group" to "Small group", "sunday_school" to "Sunday school")
private fun groupTint(type: String) = when (type) { "ministry" -> Brand.Gold; "department" -> KitBlue; "small_group" -> KitGreen; else -> KitViolet }
private fun groupIcon(type: String) = when (type) { "ministry" -> Icons.Rounded.VolunteerActivism; "department" -> Icons.Rounded.Apartment; "small_group" -> Icons.Rounded.Groups; else -> Icons.Rounded.ChildCare }

@Composable
internal fun SaGroupsPane() {
    val scope = rememberCoroutineScope()
    val list = remember { mutableStateListOf<SaGroup>() }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var showCreate by remember { mutableStateOf(false) }
    var filter by rememberSaveable { mutableStateOf("all") }
    var openId by rememberSaveable { mutableStateOf<String?>(null) }
    suspend fun reload() { runCatching { Api.decode<List<SaGroup>>(Api.get("/admin/sa/groups")["groups"]) }.onSuccess { list.clear(); list.addAll(it.filter { g -> !g.archived }) }.onFailure { error = it.message } }
    LaunchedEffect(Unit) { reload(); loading = false }

    val open = list.firstOrNull { it.id == openId }
    androidx.activity.compose.BackHandler(enabled = open != null) { openId = null }
    if (open != null) { SaGroupPage(open, back = { openId = null; scope.launch { reload() } }, archived = { openId = null; scope.launch { reload() } }); return }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        StatStrip(listOf(Stat("${list.size}", "Groups"), Stat("${list.sumOf { it.memberCount }}", "Places filled", KitGreen), Stat("${list.count { it.leaderName.isBlank() }}", "Without a leader", KitRed)))
        FilterPills(listOf("all" to "All") + groupTypes, filter) { filter = it }
        ErrorNote(error)
        SectionHeading("Groups", "+ New group") { showCreate = true }
        if (loading) Loading()
        val shown = list.filter { filter == "all" || it.type == filter }
        if (!loading && shown.isEmpty()) EmptyState(Icons.Rounded.Groups, "No groups yet", "Create ministries, departments and cells.")
        shown.forEach { g ->
            KitRow(g.name,
                line1 = (groupTypes.firstOrNull { it.first == g.type }?.second ?: g.type) + if (g.leaderName.isNotBlank()) " · Led by ${g.leaderName}" else "",
                line2 = listOf(g.schedule, g.location).filter { it.isNotBlank() }.joinToString(" · "),
                leading = { IconTile(groupIcon(g.type), groupTint(g.type)) },
                trailing = { Column(horizontalAlignment = Alignment.End) {
                    Text("${g.memberCount}", color = Brand.White, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    Text("members", style = Type.Meta.copy(fontSize = 10.5.sp), color = Brand.Text2)
                } },
                onClick = { openId = g.id })
        }
    }
    if (showCreate) GroupSheet(null, onDismiss = { showCreate = false }) { body -> Api.put("/admin/sa/groups", body); reload(); showCreate = false }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun GroupSheet(group: SaGroup?, onDismiss: () -> Unit, save: suspend (Map<String, Any>) -> Unit) {
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf(group?.name.orEmpty()) }
    var type by remember { mutableStateOf(group?.type ?: "ministry") }
    var schedule by remember { mutableStateOf(group?.schedule.orEmpty()) }
    var location by remember { mutableStateOf(group?.location.orEmpty()) }
    var leader by remember { mutableStateOf(group?.leaderId.orEmpty()) }
    var capacity by remember { mutableStateOf(group?.maxCapacity?.takeIf { it > 0 }?.toString().orEmpty()) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = Color(0xFF16161A)) {
        Column(Modifier.fillMaxWidth().navigationBarsPadding().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(if (group == null) "New group" else "Edit group", style = Type.Title, color = Brand.White)
            FilterPills(groupTypes, type) { type = it }
            Field("NAME", name, { name = it }, hint = "e.g. Ushers, Worship team, Kasarani cell")
            Field("WHEN THEY MEET", schedule, { schedule = it }, hint = "e.g. Saturdays 4 PM")
            Field("WHERE", location, { location = it }, hint = "e.g. Church hall")
            Field("MOST PEOPLE (OPTIONAL)", capacity, { capacity = it.filter(Char::isDigit).take(5) }, keyboard = androidx.compose.ui.text.input.KeyboardType.Number, hint = "Leave empty for no limit")
            Text("LEADER", style = Type.Label.copy(fontSize = 10.sp), color = Brand.Text2)
            if (group?.leaderName?.isNotBlank() == true && leader == group.leaderId) Text("Currently ${group.leaderName}. Search to change.", style = Type.Meta, color = Brand.Text2)
            SaMemberPicker(leader) { leader = it.ifBlank { group?.leaderId.orEmpty() } }
            ErrorNote(error)
            GoldButton(if (group == null) "Create group" else "Save", busy = busy, enabled = !busy && name.isNotBlank()) {
                scope.launch {
                    busy = true; error = null
                    runCatching { save(buildMap { group?.let { put("id", it.id) }; put("name", name.trim()); put("type", type); put("schedule", schedule.trim()); put("location", location.trim()); put("maxCapacity", capacity.toIntOrNull() ?: 0); if (leader.isNotBlank()) put("leaderId", leader) }) }.onFailure { error = it.message }
                    busy = false
                }
            }
        }
    }
}

// One group: who is in it, add and remove people, edit or archive it.
@Composable
private fun SaGroupPage(group: SaGroup, back: () -> Unit, archived: () -> Unit) {
    val scope = rememberCoroutineScope()
    val roster = remember { mutableStateListOf<SaRosterMember>() }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var adding by remember { mutableStateOf("") }
    var addRole by remember { mutableStateOf("member") }
    var editing by remember { mutableStateOf(false) }
    var confirmArchive by remember { mutableStateOf(false) }
    suspend fun reload() { runCatching { Api.decode<List<SaRosterMember>>(Api.get("/admin/sa/groups/${group.id}/roster")["members"]) }.onSuccess { roster.clear(); roster.addAll(it) }.onFailure { error = it.message } }
    LaunchedEffect(group.id) { reload(); loading = false }
    val tint = groupTint(group.type)
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(androidx.compose.ui.graphics.Brush.linearGradient(listOf(tint.copy(alpha = 0.3f), Color(0xFF141418))))
            .border(1.dp, Color(0x1FFFFFFF), RoundedCornerShape(24.dp)).padding(18.dp)) {
            Text("← All groups", color = Brand.GoldLight, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                modifier = Modifier.clip(RoundedCornerShape(50)).clickable(onClick = back).padding(horizontal = 6.dp, vertical = 4.dp))
            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconTile(groupIcon(group.type), tint, 52)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(group.name, style = Type.Title, color = Brand.White)
                    Text((groupTypes.firstOrNull { it.first == group.type }?.second ?: group.type) + " · ${roster.size} people", style = Type.Meta, color = Brand.Text2)
                }
            }
            if (group.schedule.isNotBlank() || group.location.isNotBlank()) Text(listOf(group.schedule, group.location).filter { it.isNotBlank() }.joinToString(" · "), style = Type.Meta, color = Brand.Text2, modifier = Modifier.padding(top = 8.dp))
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ActionPill("Edit", Icons.Rounded.Edit, Brand.GoldLight, Modifier.weight(1f)) { editing = true }
                ActionPill("Archive", Icons.Rounded.Archive, KitRed, Modifier.weight(1f)) { confirmArchive = true }
            }
        }
        KitSection("Add someone") {
            SaMemberPicker(adding) { adding = it }
            FilterPills(listOf("member" to "Member", "assistant" to "Assistant", "leader" to "Leader"), addRole) { addRole = it }
            GoldButton("Add to ${group.name}", enabled = adding.isNotBlank()) {
                scope.launch { runCatching { Api.post("/admin/sa/groups/${group.id}/roster", mapOf("userId" to adding, "role" to addRole)) }.onSuccess { adding = ""; addRole = "member"; reload() }.onFailure { error = it.message } }
            }
        }
        ErrorNote(error)
        SectionHeading("People")
        if (loading) Loading()
        if (!loading && roster.isEmpty()) EmptyState(Icons.Rounded.PersonAdd, "No one yet", "Add the first person above.")
        roster.forEach { m ->
            KitRow(m.name, line1 = m.email, leading = { PersonAvatar(m.name, m.userId) },
                trailing = { Row(verticalAlignment = Alignment.CenterVertically) {
                    if (m.role != "member") Badge(m.role.uppercase(), if (m.role == "leader") Brand.Gold else KitBlue)
                    Icon(Icons.Rounded.RemoveCircleOutline, "Remove ${m.name}", tint = Brand.Muted, modifier = Modifier.padding(start = 6.dp).size(34.dp).clip(CircleShape).clickable {
                        scope.launch { runCatching { Api.delete("/admin/sa/groups/${group.id}/roster/${m.userId}") }.onSuccess { roster.removeAll { it.userId == m.userId } }.onFailure { error = it.message } }
                    }.padding(6.dp))
                } })
        }
    }
    if (editing) GroupSheet(group, onDismiss = { editing = false }) { body -> Api.put("/admin/sa/groups", body); editing = false; back() }
    if (confirmArchive) AlertDialog(onDismissRequest = { confirmArchive = false }, containerColor = Color(0xFF1A1A1E),
        title = { Text("Archive ${group.name}?", color = Brand.White) },
        text = { Text("It leaves the groups list. The people in it are not affected.", color = Brand.Text2) },
        confirmButton = { TextButton(onClick = { confirmArchive = false; scope.launch { runCatching { Api.delete("/admin/sa/groups/${group.id}?mode=soft") }.onSuccess { archived() }.onFailure { error = it.message } } }) { Text("Archive", color = KitRed) } },
        dismissButton = { TextButton(onClick = { confirmArchive = false }) { Text("Cancel", color = Brand.Text2) } })
}

// ─── Attendance Pane ─────────────────────────────────────────────────────────

@Serializable
data class SaRecentCheckin(val id: String = "", val eventTitle: String = "", val name: String = "", val email: String = "", val phone: String = "", val source: String = "", val notes: String = "", val createdAt: String = "")

@Composable
internal fun SaAttendancePane() {
    val context = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()
    val list = remember { mutableStateListOf<SaAttendanceSession>() }
    val recent = remember { mutableStateListOf<SaRecentCheckin>() }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var showCreate by remember { mutableStateOf(false) }
    var removing by remember { mutableStateOf<SaAttendanceSession?>(null) }
    var tab by rememberSaveable { mutableStateOf("services") }

    suspend fun reload() {
        runCatching { Api.decode<List<SaAttendanceSession>>(Api.get("/admin/sa/attendance/sessions")["sessions"]) }
            .onSuccess { list.clear(); list.addAll(it.sortedByDescending { s -> s.sessionDate }) }.onFailure { error = it.message }
        runCatching { Api.decode<List<SaRecentCheckin>>(Api.get("/admin/checkins/recent")["checkins"]) }
            .onSuccess { recent.clear(); recent.addAll(it) }
    }
    LaunchedEffect(Unit) { reload(); loading = false }
    // Check-ins update by themselves while the page is open.
    LaunchedEffect(tab) { while (tab == "checkins") { kotlinx.coroutines.delay(15_000); runCatching { Api.decode<List<SaRecentCheckin>>(Api.get("/admin/checkins/recent")["checkins"]) }.onSuccess { recent.clear(); recent.addAll(it) } } }

    val month = java.time.LocalDate.now().toString().take(7)
    val thisMonth = list.filter { it.sessionDate.startsWith(month) }
    val today = java.time.LocalDate.now().toString()
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        StatStrip(listOf(
            Stat("${thisMonth.size}", "Services this month"),
            Stat(list.firstOrNull()?.headcount?.toString() ?: "–", "Last headcount", KitBlue),
            Stat(if (thisMonth.isEmpty()) "–" else "${thisMonth.sumOf { it.headcount } / thisMonth.size}", "Average", KitViolet),
            Stat("${recent.count { it.createdAt.startsWith(today) }}", "Checked in today", KitGreen),
        ))
        FilterPills(listOf("services" to "Services", "checkins" to "Recent check-ins"), tab) { tab = it }
        ErrorNote(error)
        if (loading) Loading()
        if (tab == "services") {
            SectionHeading("Services", "+ Record a service") { showCreate = true }
            if (!loading && list.isEmpty()) EmptyState(Icons.Rounded.EventAvailable, "No services recorded yet", "Record the headcount after each service.")
            list.forEach { s ->
                val date = runCatching { java.time.LocalDate.parse(s.sessionDate.take(10)) }.getOrNull()
                KitRow(
                    title = s.title,
                    line1 = s.occasion,
                    line2 = s.notes,
                    leading = {
                        Column(Modifier.size(48.dp).clip(RoundedCornerShape(14.dp)).background(Color(0x26D4AF37)), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                            Text(date?.dayOfMonth?.toString() ?: "?", color = Brand.White, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                            Text(date?.month?.getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.ENGLISH)?.uppercase() ?: "", color = Brand.Gold, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }
                    },
                    trailing = {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(horizontalAlignment = Alignment.End) {
                                Text("${s.headcount}", color = Brand.White, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                                Text("present", style = Type.Meta.copy(fontSize = 10.5.sp), color = Brand.Text2)
                            }
                            Icon(Icons.Rounded.DeleteOutline, "Remove", tint = Brand.Muted, modifier = Modifier.padding(start = 6.dp).size(34.dp).clip(CircleShape).clickable { removing = s }.padding(7.dp))
                        }
                    },
                )
            }
        } else {
            SectionHeading("Recent check-ins")
            Text("From the gate scanner and event check-in. Updates every 15 seconds.", style = Type.Meta, color = Brand.Text2)
            if (!loading && recent.isEmpty()) EmptyState(Icons.Rounded.QrCodeScanner, "No check-ins yet", "Scan members' codes at the gate or at an event.")
            recent.forEach { c ->
                KitRow(
                    title = c.name,
                    line1 = listOf(c.phone, c.eventTitle).filter { it.isNotBlank() }.joinToString(" · "),
                    line2 = listOfNotNull(c.createdAt.takeIf { it.length >= 16 }?.let { it.take(10) + " " + it.substring(11, 16) + " UTC" }, c.notes.ifBlank { null }).joinToString(" · "),
                    leading = { PersonAvatar(c.name, c.email.ifBlank { c.name }) },
                    trailing = {
                        if (c.phone.isNotBlank()) Icon(Icons.Rounded.Call, "Call ${c.name}", tint = KitGreen, modifier = Modifier.size(38.dp).clip(CircleShape).background(KitGreen.copy(alpha = 0.12f)).clickable {
                            runCatching { context.startActivity(android.content.Intent(android.content.Intent.ACTION_DIAL, android.net.Uri.parse("tel:${c.phone}"))) }
                        }.padding(9.dp))
                    },
                )
            }
        }
    }
    if (showCreate) RecordServiceSheet(onDismiss = { showCreate = false }) { title, occasion, date, headcount, notes ->
        Api.post("/admin/sa/attendance/sessions", mapOf("title" to title, "occasion" to occasion, "headcount" to headcount, "sessionDate" to date, "notes" to notes))
        reload(); showCreate = false
    }
    removing?.let { s ->
        AlertDialog(onDismissRequest = { removing = null }, containerColor = Color(0xFF1A1A1E),
            title = { Text("Remove “${s.title}”?", color = Brand.White) },
            text = { Text("The headcount for ${s.sessionDate.take(10)} will be removed from the reports.", color = Brand.Text2) },
            confirmButton = { TextButton(onClick = { removing = null; scope.launch { runCatching { Api.delete("/admin/sa/attendance/sessions/${s.id}") }.onSuccess { list.removeAll { it.id == s.id } }.onFailure { error = it.message } } }) { Text("Remove", color = KitRed) } },
            dismissButton = { TextButton(onClick = { removing = null }) { Text("Cancel", color = Brand.Text2) } })
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RecordServiceSheet(onDismiss: () -> Unit, save: suspend (String, String, String, Int, String) -> Unit) {
    val scope = rememberCoroutineScope()
    var title by remember { mutableStateOf("Sunday Service") }
    var occasion by remember { mutableStateOf("Service") }
    var day by remember { mutableStateOf(java.time.LocalDate.now()) }
    var headcount by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = Color(0xFF16161A)) {
        Column(Modifier.fillMaxWidth().navigationBarsPadding().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Record a service", style = Type.Title, color = Brand.White)
            FilterPills(listOf("Service" to "Service", "Midweek" to "Midweek", "Prayer" to "Prayer", "Youth" to "Youth", "Event" to "Event"), occasion) { occasion = it }
            Field("TITLE", title, { title = it })
            Text("DATE", style = Type.Label.copy(fontSize = 10.sp), color = Brand.Text2)
            FilterPills((0..6).map { java.time.LocalDate.now().minusDays(it.toLong()) }.map { d -> d.toString() to when (d) { java.time.LocalDate.now() -> "Today"; java.time.LocalDate.now().minusDays(1) -> "Yesterday"; else -> d.dayOfWeek.getDisplayName(java.time.format.TextStyle.SHORT, java.util.Locale.ENGLISH) + " " + d.dayOfMonth } }, day.toString()) { day = java.time.LocalDate.parse(it) }
            Field("HOW MANY CAME", headcount, { headcount = it.filter(Char::isDigit).take(6) }, keyboard = androidx.compose.ui.text.input.KeyboardType.Number, hint = "e.g. 230")
            Field("NOTES (OPTIONAL)", notes, { notes = it.take(300) }, hint = "e.g. Guest speaker, heavy rain")
            ErrorNote(error)
            GoldButton("Save", busy = busy, enabled = !busy && title.isNotBlank() && headcount.isNotBlank()) {
                scope.launch { busy = true; error = null; runCatching { save(title.trim(), occasion, day.toString(), headcount.toInt(), notes.trim()) }.onFailure { error = it.message }; busy = false }
            }
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
            Text("POS devices", color = Brand.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
            Text("+ Pair", color = Brand.Gold, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { showPair = true })
        }
        ErrorNote(error)
        if (loading) CircularProgressIndicator(color = Brand.Gold, modifier = Modifier.align(Alignment.CenterHorizontally))
        if (!loading && list.isEmpty()) Empty("No POS devices paired yet.")
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
                title = { Text("Pair new POS device", color = Brand.White) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Field("POS NAME", kioskName, { kioskName = it })
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
    val keyPerms = remember { mutableStateListOf<String>() }
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
                if (!k.revoked) Text("Rotate", color = Brand.Gold, fontSize = 12.sp,
                    modifier = Modifier.padding(end = 14.dp).clickable {
                        scope.launch {
                            runCatching { Api.post("/admin/sa/api-keys/${k.id}/rotate", emptyMap<String, String>())["key"]?.jsonPrimitive?.content }
                                .onSuccess { fresh -> rawKey = fresh; list.clear(); list.addAll(Api.decode<List<SaApiKey>>(Api.get("/admin/sa/api-keys")["keys"])) }
                                .onFailure { error = it.message }
                        }
                    })
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
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Field("KEY NAME", keyName, { keyName = it }, hint = "e.g. n8n Integration")
                        Text("WHAT THIS KEY MAY DO", color = Brand.Text2, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        Column(Modifier.heightIn(max = 260.dp).verticalScroll(rememberScrollState())) {
                            KEY_PERMISSIONS.forEach { (perm, label) ->
                                Row(Modifier.fillMaxWidth().clickable { if (perm in keyPerms) keyPerms.remove(perm) else keyPerms.add(perm) }.padding(vertical = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically) {
                                    Checkbox(checked = perm in keyPerms, onCheckedChange = null)
                                    Spacer(Modifier.width(8.dp))
                                    Text(label, color = Brand.White, fontSize = 14.sp)
                                }
                            }
                        }
                    }
                },
                confirmButton = {
                    GoldButton("Generate", busy = busy, enabled = keyName.isNotBlank() && keyPerms.isNotEmpty()) {
                        scope.launch {
                            busy = true
                            runCatching {
                                val resp = Api.post("/admin/sa/api-keys", mapOf("name" to keyName, "permissions" to keyPerms.toList()))
                                resp["key"]?.jsonPrimitive?.content
                            }.onSuccess { k ->
                                rawKey = k
                                val resp2 = Api.get("/admin/sa/api-keys")
                                list.clear(); list.addAll(Api.decode<List<SaApiKey>>(resp2["keys"]))
                                showCreate = false; keyName = ""; keyPerms.clear()
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
        "attendanceKiosk" to "Attendance POS",
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
            Text("Backups hold every member's personal data, so they are downloaded on a computer, not a phone: open the web dashboard → System & Governance → Data & Backup → Download backup.",
                color = Brand.Text2, fontSize = 13.sp)
        }
        HorizontalDivider(color = Brand.Line)
        Text("GDPR — Right to be Forgotten", color = Color(0xFFFF6B6B), fontWeight = FontWeight.Bold, fontSize = 16.sp)
        Column(Modifier.glass(RoundedCornerShape(18.dp), 0.9f).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Permanently purge all personal data for a member. Financial records are anonymised, not deleted.", color = Brand.Text2, fontSize = 13.sp)
            SaMemberPicker(gdprId) { gdprId = it }
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
                    runCatching { Api.delete("/admin/sa/members/${gdprId.trim()}/purge-gdpr?reason=${java.net.URLEncoder.encode(gdprReason.trim(), "UTF-8")}") }
                        .onSuccess { gdprResult = "Personal data erased. Payments stay in the accounts without the payer's details."; gdprId = ""; gdprReason = ""; gdprConfirm = "" }
                        .onFailure { error = it.message }
                    gdprBusy = false
                }
            }
        }
    }
}

private val KEY_PERMISSIONS = listOf(
    "sermons:manage" to "Manage sermons", "events:manage" to "Manage events", "content:manage" to "Devotions, updates & plans",
    "finance:manage" to "Payments & giving", "checkin:scan" to "Check-in", "books:publish" to "Publish books",
    "community:moderate" to "Moderate community", "live:broadcast" to "Go live", "live:moderate" to "Moderate live chat",
)

// Search members by name or email; the value is the chosen member's id.
@Composable
internal fun SaMemberPicker(value: String, onPick: (String) -> Unit) {
    var query by remember { mutableStateOf("") }
    var chosen by remember { mutableStateOf<SaUser?>(null) }
    val results = remember { mutableStateListOf<SaUser>() }
    LaunchedEffect(value) { if (value.isEmpty()) chosen = null }
    LaunchedEffect(query) {
        if (query.length < 2) { results.clear(); return@LaunchedEffect }
        kotlinx.coroutines.delay(250)
        runCatching { Api.decode<List<SaUser>>(Api.get("/admin/members?query=${java.net.URLEncoder.encode(query, "UTF-8")}")["members"]) }
            .onSuccess { found -> results.clear(); results.addAll(found.filter { !it.archived }.take(6)) }
    }
    val picked = chosen
    if (picked != null && picked.id == value) {
        Row(Modifier.fillMaxWidth().glass(RoundedCornerShape(14.dp), 0.9f).padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(picked.name, color = Brand.White, fontWeight = FontWeight.Bold, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(picked.email, color = Brand.Text2, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Text("Change", color = Brand.Gold, fontSize = 13.sp, modifier = Modifier.clickable { chosen = null; onPick("") }.padding(6.dp))
        }
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Field("MEMBER", query, { query = it }, hint = "Type a name or email")
        results.forEach { m ->
            Column(Modifier.fillMaxWidth().clickable { chosen = m; query = ""; results.clear(); onPick(m.id) }.padding(horizontal = 4.dp, vertical = 8.dp)) {
                Text(m.name, color = Brand.White, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(m.email, color = Brand.Text2, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

@Serializable
data class SaRole(val id: String = "", val name: String = "", val description: String = "", val permissions: List<String> = emptyList(), val holders: Int = 0)

// Role designer: named permission sets given to people from Members.
@Composable
internal fun SaRolesPane() {
    val scope = rememberCoroutineScope()
    val list = remember { mutableStateListOf<SaRole>() }
    var editing by remember { mutableStateOf<SaRole?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    suspend fun reload() { list.clear(); list.addAll(Api.decode<List<SaRole>>(Api.get("/admin/sa/roles")["roles"])) }
    LaunchedEffect(Unit) { runCatching { reload() }.onFailure { error = it.message } }
    val labels = KEY_PERMISSIONS.toMap()
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Design roles like \"Media team\", then give them to people in Members. Editing a role updates everyone who has it.", color = Brand.Text2, fontSize = 13.sp)
        GoldButton("New role") { editing = SaRole() }
        ErrorNote(error)
        list.forEach { r ->
            Column(Modifier.fillMaxWidth().glass(RoundedCornerShape(18.dp), 0.9f).clickable { editing = r }.padding(14.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(r.name, color = Brand.White, fontWeight = FontWeight.Bold, fontSize = 15.sp, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(if (r.holders == 1) "1 person" else "${r.holders} people", color = Brand.GoldLight, fontSize = 12.sp)
                }
                Text(r.permissions.joinToString(", ") { labels[it] ?: it }.ifBlank { "No permissions yet" }, color = Brand.Text2, fontSize = 12.5.sp, modifier = Modifier.padding(top = 4.dp))
                Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text("Duplicate", color = Brand.Gold, fontSize = 13.sp, modifier = Modifier.clickable { scope.launch { runCatching { Api.post("/admin/sa/roles/${r.id}/duplicate", emptyMap<String, String>()); reload() }.onFailure { error = it.message } } })
                    Text("Delete", color = Color(0xFFFF6B6B), fontSize = 13.sp, modifier = Modifier.clickable { scope.launch { runCatching { Api.delete("/admin/sa/roles/${r.id}"); reload() }.onFailure { error = it.message } } })
                }
            }
        }
    }
    editing?.let { role ->
        var name by remember(role.id) { mutableStateOf(role.name) }
        var description by remember(role.id) { mutableStateOf(role.description) }
        val perms = remember(role.id) { mutableStateListOf<String>().apply { addAll(role.permissions) } }
        var busy by remember { mutableStateOf(false) }
        AlertDialog(
            onDismissRequest = { editing = null },
            containerColor = Color(0xFF1A1A1E),
            title = { Text(if (role.id.isBlank()) "New role" else "Edit role", color = Brand.White, fontWeight = FontWeight.Bold) },
            text = {
                Column(Modifier.heightIn(max = 480.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Field("NAME", name, { name = it }, hint = "e.g. Media team")
                    Field("DESCRIPTION", description, { description = it }, hint = "What this role is for")
                    KEY_PERMISSIONS.forEach { (perm, label) ->
                        Row(Modifier.fillMaxWidth().clickable { if (perm in perms) perms.remove(perm) else perms.add(perm) }.padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(checked = perm in perms, onCheckedChange = null)
                            Spacer(Modifier.width(8.dp))
                            Text(label, color = Brand.White, fontSize = 14.sp)
                        }
                    }
                }
            },
            confirmButton = {
                GoldButton("Save", busy = busy, enabled = name.isNotBlank()) {
                    scope.launch {
                        busy = true
                        runCatching { Api.put("/admin/sa/roles", mapOf("id" to role.id, "name" to name.trim(), "description" to description.trim(), "permissions" to perms.toList())); reload() }
                            .onSuccess { editing = null }.onFailure { error = it.message }
                        busy = false
                    }
                }
            },
            dismissButton = { TextButton(onClick = { editing = null }) { Text("Cancel", color = Brand.Text2) } }
        )
    }
}
