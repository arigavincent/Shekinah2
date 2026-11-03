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
                if (user.role != "member") Badge(if (user.role == "super_admin") "SUPER ADMIN" else "ADMIN", Brand.Gold)
                Badge(user.membershipStatus.uppercase(), KitBlue)
                if (user.staffRole.isNotBlank()) Badge(user.staffRole.uppercase(), KitViolet)
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

    // Both kinds of check-in: the gate scanner (services) and event check-in.
    suspend fun loadCheckins() {
        val events = runCatching { Api.decode<List<SaRecentCheckin>>(Api.get("/admin/checkins/recent")["checkins"]) }.getOrDefault(emptyList())
        val gate = runCatching {
            Api.get("/attendance?date=${java.time.LocalDate.now()}")["records"]?.jsonArray.orEmpty().map { r ->
                val o = r.jsonObject
                fun f(k: String) = o[k]?.jsonPrimitive?.contentOrNull.orEmpty()
                SaRecentCheckin(id = f("id"), eventTitle = f("occasion"), name = f("name"), email = f("email"), phone = f("phone"), source = "gate", notes = f("by").let { if (it.isBlank()) "" else "by $it" }, createdAt = f("createdAt"))
            }
        }.getOrDefault(emptyList())
        recent.clear(); recent.addAll((events + gate).sortedByDescending { it.createdAt })
    }
    suspend fun reload() {
        runCatching { Api.decode<List<SaAttendanceSession>>(Api.get("/admin/sa/attendance/sessions")["sessions"]) }
            .onSuccess { list.clear(); list.addAll(it.sortedByDescending { s -> s.sessionDate }) }.onFailure { error = it.message }
        loadCheckins()
    }
    LaunchedEffect(Unit) { reload(); loading = false }
    // Check-ins update by themselves while the page is open.
    LaunchedEffect(tab) { while (tab == "checkins") { kotlinx.coroutines.delay(15_000); loadCheckins() } }

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
            Text("Today's gate scans and recent event check-ins. Updates every 15 seconds.", style = Type.Meta, color = Brand.Text2)
            if (!loading && recent.isEmpty()) EmptyState(Icons.Rounded.QrCodeScanner, "No check-ins yet", "Scan members' codes at the gate or at an event.")
            recent.forEach { c ->
                KitRow(
                    title = c.name,
                    line1 = listOf(c.phone, c.eventTitle).filter { it.isNotBlank() }.joinToString(" · "),
                    line2 = listOfNotNull(c.createdAt.takeIf { it.length >= 16 }?.let { it.take(10) + " " + it.substring(11, 16) + " UTC" }, c.notes.ifBlank { null }).joinToString(" · "),
                    leading = { PersonAvatar(c.name, c.email.ifBlank { c.name }) },
                    trailing = {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                        Badge(if (c.source == "gate") "GATE" else "EVENT", if (c.source == "gate") KitBlue else Brand.Gold)
                        if (c.phone.isNotBlank()) Icon(Icons.Rounded.Call, "Call ${c.name}", tint = KitGreen, modifier = Modifier.size(38.dp).clip(CircleShape).background(KitGreen.copy(alpha = 0.12f)).clickable {
                            runCatching { context.startActivity(android.content.Intent(android.content.Intent.ACTION_DIAL, android.net.Uri.parse("tel:${c.phone}"))) }
                        }.padding(9.dp))
                        }
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

// A confirm step for anything that can't be undone easily.
@Composable
internal fun ConfirmDialog(title: String, body: String, action: String, onDismiss: () -> Unit, onConfirm: () -> Unit) {
    AlertDialog(onDismissRequest = onDismiss, containerColor = Color(0xFF1A1A1E),
        title = { Text(title, color = Brand.White) }, text = { Text(body, color = Brand.Text2) },
        confirmButton = { TextButton(onClick = { onDismiss(); onConfirm() }) { Text(action, color = KitRed) } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel", color = Brand.Text2) } })
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun KitSheet(title: String, onDismiss: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = Color(0xFF16161A)) {
        Column(Modifier.fillMaxWidth().navigationBarsPadding().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(title, style = Type.Title, color = Brand.White)
            content()
        }
    }
}

@Composable
internal fun SmallAction(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, tint: Color = Brand.Text2, onClick: () -> Unit) {
    Icon(icon, label, tint = tint, modifier = Modifier.size(36.dp).clip(CircleShape).background(tint.copy(alpha = 0.10f)).clickable(onClick = onClick).padding(8.dp))
}

@Composable
internal fun SaKiosksPane() {
    val scope = rememberCoroutineScope()
    val list = remember { mutableStateListOf<SaKiosk>() }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var showPair by remember { mutableStateOf(false) }
    var unbinding by remember { mutableStateOf<SaKiosk?>(null) }
    suspend fun reload() { runCatching { Api.decode<List<SaKiosk>>(Api.get("/admin/sa/kiosks")["kiosks"]) }.onSuccess { list.clear(); list.addAll(it) }.onFailure { error = it.message } }
    LaunchedEffect(Unit) { reload(); loading = false }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        StatStrip(listOf(Stat("${list.size}", "Devices"), Stat("${list.count { !it.locked }}", "Active", KitGreen), Stat("${list.count { it.locked }}", "Locked", KitRed)))
        Text("Phones or tablets at the entrance or book table, set up for check-in and sales. Lock one if it goes missing.", style = Type.Meta, color = Brand.Text2)
        SectionHeading("POS devices", "+ Pair a device") { showPair = true }
        ErrorNote(error)
        if (loading) Loading()
        if (!loading && list.isEmpty()) EmptyState(Icons.Rounded.PointOfSale, "No devices yet", "Pair the gate phone or the book-table tablet.")
        list.forEach { k ->
            KitRow(k.name, line1 = k.location.ifBlank { "No location set" }, line2 = if (k.serialNumber.isNotBlank()) "Serial ${k.serialNumber}" else "",
                leading = { IconTile(Icons.Rounded.PointOfSale, if (k.locked) KitRed else KitBlue) },
                trailing = { Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Badge(if (k.locked) "LOCKED" else "ACTIVE", if (k.locked) KitRed else KitGreen)
                    SmallAction(if (k.locked) Icons.Rounded.LockOpen else Icons.Rounded.Lock, if (k.locked) "Unlock" else "Lock", Brand.GoldLight) {
                        scope.launch { runCatching { Api.patch("/admin/sa/kiosks/${k.id}/lock", mapOf("locked" to !k.locked)) }
                            .onSuccess { val i = list.indexOfFirst { it.id == k.id }; if (i >= 0) list[i] = k.copy(locked = !k.locked) }.onFailure { error = it.message } }
                    }
                    SmallAction(Icons.Rounded.LinkOff, "Unpair", KitRed) { unbinding = k }
                } })
        }
    }
    if (showPair) {
        var name by remember { mutableStateOf("") }; var loc by remember { mutableStateOf("") }; var serial by remember { mutableStateOf("") }; var busy by remember { mutableStateOf(false) }
        KitSheet("Pair a device", { showPair = false }) {
            Field("NAME", name, { name = it }, hint = "e.g. Main gate phone")
            Field("WHERE IT IS", loc, { loc = it }, hint = "e.g. Front entrance")
            Field("SERIAL NUMBER (OPTIONAL)", serial, { serial = it })
            GoldButton("Pair", busy = busy, enabled = !busy && name.isNotBlank()) {
                scope.launch { busy = true; runCatching { Api.post("/admin/sa/kiosks", mapOf("name" to name.trim(), "location" to loc.trim(), "serialNumber" to serial.trim())) }
                    .onSuccess { reload(); showPair = false }.onFailure { error = it.message }; busy = false }
            }
        }
    }
    unbinding?.let { k -> ConfirmDialog("Unpair ${k.name}?", "It stops working as a POS until it's paired again.", "Unpair", { unbinding = null }) {
        scope.launch { runCatching { Api.delete("/admin/sa/kiosks/${k.id}") }.onSuccess { list.removeAll { it.id == k.id } }.onFailure { error = it.message } }
    } }
}

// ─── Comm Templates Pane ─────────────────────────────────────────────────────

private val channels = listOf("sms" to "SMS", "email" to "Email", "push" to "Push", "whatsapp" to "WhatsApp")
private fun channelIcon(c: String) = when (c) { "email" -> Icons.Rounded.Mail; "push" -> Icons.Rounded.NotificationsActive; "whatsapp" -> Icons.Rounded.Chat; else -> Icons.Rounded.Sms }
private fun channelTint(c: String) = when (c) { "email" -> KitBlue; "push" -> Brand.Gold; "whatsapp" -> KitGreen; else -> KitViolet }

@Composable
internal fun SaTemplatesPane() {
    val scope = rememberCoroutineScope()
    val list = remember { mutableStateListOf<SaCommTemplate>() }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var editing by remember { mutableStateOf<SaCommTemplate?>(null) }
    var deleting by remember { mutableStateOf<SaCommTemplate?>(null) }
    var filter by rememberSaveable { mutableStateOf("all") }
    suspend fun reload() { runCatching { Api.decode<List<SaCommTemplate>>(Api.get("/admin/sa/comm/templates")["templates"]) }.onSuccess { list.clear(); list.addAll(it) }.onFailure { error = it.message } }
    LaunchedEffect(Unit) { reload(); loading = false }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        StatStrip(channels.map { (k, l) -> Stat("${list.count { it.channel == k }}", l, channelTint(k)) })
        Text("Messages you send often (welcome, reminders, thank-you). Use {name} for the person's name.", style = Type.Meta, color = Brand.Text2)
        FilterPills(listOf("all" to "All") + channels, filter) { filter = it }
        SectionHeading("Templates", "+ New template") { editing = SaCommTemplate() }
        ErrorNote(error)
        if (loading) Loading()
        val shown = list.filter { filter == "all" || it.channel == filter }
        if (!loading && shown.isEmpty()) EmptyState(Icons.Rounded.Mail, "No templates yet", "Save a message once and reuse it.")
        shown.forEach { t ->
            KitRow(t.name, line1 = t.body.replace("\n", " "), line2 = t.subject,
                leading = { IconTile(channelIcon(t.channel), channelTint(t.channel)) },
                trailing = { Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Badge(t.channel.uppercase(), channelTint(t.channel))
                    SmallAction(Icons.Rounded.DeleteOutline, "Delete", KitRed) { deleting = t }
                } }, onClick = { editing = t })
        }
    }
    editing?.let { t ->
        var name by remember(t.id) { mutableStateOf(t.name) }; var channel by remember(t.id) { mutableStateOf(t.channel) }
        var subject by remember(t.id) { mutableStateOf(t.subject) }; var body by remember(t.id) { mutableStateOf(t.body) }; var busy by remember { mutableStateOf(false) }
        KitSheet(if (t.id.isBlank()) "New template" else "Edit template", { editing = null }) {
            FilterPills(channels, channel) { channel = it }
            Field("NAME", name, { name = it }, hint = "e.g. Welcome new member")
            if (channel == "email") Field("SUBJECT", subject, { subject = it })
            Field("MESSAGE", body, { body = it }, minHeight = 120.dp, singleLine = false, hint = "Hello {name}, welcome to Shekinah Sons Global…")
            if (channel == "sms") Text("${body.length} characters · ${(body.length + 159) / 160} SMS", style = Type.Meta, color = Brand.Text2)
            GoldButton("Save", busy = busy, enabled = !busy && name.isNotBlank() && body.isNotBlank()) {
                scope.launch { busy = true
                    runCatching { Api.put("/admin/sa/comm/templates", buildMap { if (t.id.isNotBlank()) put("id", t.id); put("name", name.trim()); put("channel", channel); put("subject", subject.trim()); put("body", body.trim()); put("isActive", true) }) }
                        .onSuccess { reload(); editing = null }.onFailure { error = it.message }; busy = false }
            }
        }
    }
    deleting?.let { t -> ConfirmDialog("Delete “${t.name}”?", "The template is removed. Messages already sent are not affected.", "Delete", { deleting = null }) {
        scope.launch { runCatching { Api.delete("/admin/sa/comm/templates/${t.id}") }.onSuccess { list.removeAll { it.id == t.id } }.onFailure { error = it.message } }
    } }
}

// ─── API Keys Pane ────────────────────────────────────────────────────────────

@Composable
internal fun SaApiKeysPane() {
    val scope = rememberCoroutineScope()
    val clipboard = androidx.compose.ui.platform.LocalClipboardManager.current
    val list = remember { mutableStateListOf<SaApiKey>() }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var showCreate by remember { mutableStateOf(false) }
    var rawKey by remember { mutableStateOf<String?>(null) }
    var revoking by remember { mutableStateOf<SaApiKey?>(null) }
    var rotating by remember { mutableStateOf<SaApiKey?>(null) }
    suspend fun reload() { runCatching { Api.decode<List<SaApiKey>>(Api.get("/admin/sa/api-keys")["keys"]) }.onSuccess { list.clear(); list.addAll(it) }.onFailure { error = it.message } }
    LaunchedEffect(Unit) { reload(); loading = false }
    val labels = KEY_PERMISSIONS.toMap()

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        StatStrip(listOf(Stat("${list.count { !it.revoked }}", "Active keys", KitGreen), Stat("${list.count { it.revoked }}", "Revoked", KitRed)))
        Text("Let other systems (Zapier, n8n, your website) use the church's data. Each key can only do what you tick.", style = Type.Meta, color = Brand.Text2)
        SectionHeading("Keys", "+ New key") { showCreate = true }
        ErrorNote(error)
        if (loading) Loading()
        if (!loading && list.isEmpty()) EmptyState(Icons.Rounded.Key, "No keys yet", "Create one when another system needs access.")
        list.sortedBy { it.revoked }.forEach { k ->
            KitRow(k.name, line1 = "${k.prefix}•••••• · " + k.permissions.joinToString(", ") { labels[it] ?: it },
                line2 = if (k.lastUsedAt.isNotBlank()) "Last used ${k.lastUsedAt.take(10)}" else "Never used",
                leading = { IconTile(Icons.Rounded.Key, if (k.revoked) Brand.Muted else KitViolet) },
                trailing = { Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (k.revoked) Badge("REVOKED", KitRed) else {
                        SmallAction(Icons.Rounded.Autorenew, "Rotate", Brand.GoldLight) { rotating = k }
                        SmallAction(Icons.Rounded.Block, "Revoke", KitRed) { revoking = k }
                    }
                } })
        }
    }
    if (showCreate) {
        var name by remember { mutableStateOf("") }; val perms = remember { mutableStateListOf<String>() }; var busy by remember { mutableStateOf(false) }
        KitSheet("New API key", { showCreate = false }) {
            Field("NAME", name, { name = it }, hint = "e.g. Website forms")
            Text("WHAT THIS KEY MAY DO", style = Type.Label.copy(fontSize = 10.sp), color = Brand.Text2)
            PermissionList(perms)
            GoldButton("Create key", busy = busy, enabled = !busy && name.isNotBlank() && perms.isNotEmpty()) {
                scope.launch { busy = true
                    runCatching { Api.post("/admin/sa/api-keys", mapOf("name" to name.trim(), "permissions" to perms.toList()))["key"]?.jsonPrimitive?.content }
                        .onSuccess { rawKey = it; reload(); showCreate = false }.onFailure { error = it.message }; busy = false }
            }
        }
    }
    rotating?.let { k -> ConfirmDialog("Rotate ${k.name}?", "A new key is made and the old one stops working at once. Update the system that uses it.", "Rotate", { rotating = null }) {
        scope.launch { runCatching { Api.post("/admin/sa/api-keys/${k.id}/rotate", emptyMap<String, String>())["key"]?.jsonPrimitive?.content }.onSuccess { rawKey = it; reload() }.onFailure { error = it.message } }
    } }
    revoking?.let { k -> ConfirmDialog("Revoke ${k.name}?", "It stops working immediately and can't be turned back on.", "Revoke", { revoking = null }) {
        scope.launch { runCatching { Api.delete("/admin/sa/api-keys/${k.id}") }.onSuccess { val i = list.indexOfFirst { it.id == k.id }; if (i >= 0) list[i] = k.copy(revoked = true) }.onFailure { error = it.message } }
    } }
    rawKey?.let { key ->
        AlertDialog(onDismissRequest = { rawKey = null }, containerColor = Color(0xFF1A1A1E),
            title = { Text("Copy the key now", color = Brand.Gold) },
            text = { Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("For safety it's shown only once.", color = Brand.Text2, fontSize = 13.sp)
                Text(key, color = Brand.White, fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace, fontSize = 12.sp,
                    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Color(0x1FFFFFFF)).padding(12.dp))
                ActionPill("Copy", Icons.Rounded.ContentCopy, Brand.GoldLight, Modifier.fillMaxWidth()) { clipboard.setText(androidx.compose.ui.text.AnnotatedString(key)) }
            } },
            confirmButton = { TextButton(onClick = { rawKey = null }) { Text("Done", color = Brand.Gold) } })
    }
}

@Composable
internal fun PermissionList(perms: MutableList<String>) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        KEY_PERMISSIONS.forEach { (perm, label) ->
            val on = perm in perms
            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(if (on) Color(0x26D4AF37) else Color(0x0FFFFFFF))
                .border(1.dp, if (on) Brand.Gold.copy(alpha = 0.5f) else Color(0x14FFFFFF), RoundedCornerShape(14.dp))
                .clickable { if (on) perms.remove(perm) else perms.add(perm) }.padding(horizontal = 14.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(label, color = Brand.White, fontSize = 14.sp, modifier = Modifier.weight(1f))
                Icon(if (on) Icons.Rounded.CheckCircle else Icons.Rounded.RadioButtonUnchecked, null, tint = if (on) Brand.Gold else Brand.Muted, modifier = Modifier.size(22.dp))
            }
        }
    }
}

// ─── Webhooks Pane ───────────────────────────────────────────────────────────

private val WEBHOOK_EVENTS = listOf(
    "member.created" to "New member", "member.updated" to "Member details changed", "giving.received" to "Gift received", "giving.refunded" to "Gift refunded",
    "event.registered" to "Event registration", "attendance.session.created" to "Service recorded", "user.suspended" to "Account suspended", "user.deleted" to "Account removed",
)

@Composable
internal fun SaWebhooksPane() {
    val scope = rememberCoroutineScope()
    val list = remember { mutableStateListOf<SaWebhook>() }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var note by remember { mutableStateOf<String?>(null) }
    var editing by remember { mutableStateOf<SaWebhook?>(null) }
    var deleting by remember { mutableStateOf<SaWebhook?>(null) }
    suspend fun reload() { runCatching { Api.decode<List<SaWebhook>>(Api.get("/admin/sa/webhooks")["webhooks"]) }.onSuccess { list.clear(); list.addAll(it) }.onFailure { error = it.message } }
    LaunchedEffect(Unit) { reload(); loading = false }
    val labels = WEBHOOK_EVENTS.toMap()

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        StatStrip(listOf(Stat("${list.size}", "Webhooks"), Stat("${list.count { it.lastStatus in 200..299 }}", "Working", KitGreen), Stat("${list.count { it.lastStatus !in 0..299 }}", "Failing", KitRed)))
        Text("Tell another system the moment something happens (a gift, a new member). It must be an https address.", style = Type.Meta, color = Brand.Text2)
        SectionHeading("Webhooks", "+ New webhook") { editing = SaWebhook() }
        ErrorNote(error)
        note?.let { Text(it, color = KitGreen, fontSize = 13.sp) }
        if (loading) Loading()
        if (!loading && list.isEmpty()) EmptyState(Icons.Rounded.Webhook, "No webhooks yet", "Connect Zapier, n8n or your own server.")
        list.forEach { w ->
            val ok = w.lastStatus in 200..299
            KitRow(w.url.removePrefix("https://"), line1 = w.events.joinToString(", ") { labels[it] ?: it },
                line2 = if (w.lastStatus == 0) "Not delivered yet" else "Last delivery: HTTP ${w.lastStatus}",
                leading = { IconTile(Icons.Rounded.Webhook, if (w.lastStatus == 0) KitViolet else if (ok) KitGreen else KitRed) },
                trailing = { Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    SmallAction(Icons.Rounded.Send, "Send a test", Brand.GoldLight) {
                        scope.launch { note = null; error = null
                            runCatching { Api.post("/admin/sa/webhooks/${w.id}/test", emptyMap<String, String>()) }
                                .onSuccess { r -> val st = r["status"]?.jsonPrimitive?.intOrNull ?: 0; if (st in 200..299) note = "Test delivered (HTTP $st)." else error = "The endpoint did not accept the test" + if (st > 0) " (HTTP $st)." else "."; reload() }
                                .onFailure { error = it.message } }
                    }
                    SmallAction(Icons.Rounded.DeleteOutline, "Delete", KitRed) { deleting = w }
                } }, onClick = { editing = w })
        }
    }
    editing?.let { w ->
        var url by remember(w.id) { mutableStateOf(w.url) }; val events = remember(w.id) { mutableStateListOf<String>().apply { addAll(w.events.ifEmpty { listOf("member.created") }) } }; var busy by remember { mutableStateOf(false) }
        KitSheet(if (w.id.isBlank()) "New webhook" else "Edit webhook", { editing = null }) {
            Field("ADDRESS", url, { url = it.trim() }, hint = "https://example.com/hook", keyboard = androidx.compose.ui.text.input.KeyboardType.Uri)
            Text("SEND WHEN", style = Type.Label.copy(fontSize = 10.sp), color = Brand.Text2)
            WEBHOOK_EVENTS.forEach { (e, label) ->
                val on = e in events
                Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(if (on) Color(0x26D4AF37) else Color(0x0FFFFFFF)).clickable { if (on) events.remove(e) else events.add(e) }.padding(horizontal = 14.dp, vertical = 11.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(label, color = Brand.White, fontSize = 14.sp, modifier = Modifier.weight(1f))
                    Icon(if (on) Icons.Rounded.CheckCircle else Icons.Rounded.RadioButtonUnchecked, null, tint = if (on) Brand.Gold else Brand.Muted, modifier = Modifier.size(22.dp))
                }
            }
            GoldButton("Save", busy = busy, enabled = !busy && url.startsWith("https://") && events.isNotEmpty()) {
                scope.launch { busy = true
                    runCatching { Api.put("/admin/sa/webhooks", buildMap { if (w.id.isNotBlank()) put("id", w.id); put("url", url); put("events", events.toList()); put("isActive", true) }) }
                        .onSuccess { reload(); editing = null }.onFailure { error = it.message }; busy = false }
            }
        }
    }
    deleting?.let { w -> ConfirmDialog("Delete this webhook?", "${w.url} will stop receiving updates.", "Delete", { deleting = null }) {
        scope.launch { runCatching { Api.delete("/admin/sa/webhooks/${w.id}") }.onSuccess { list.removeAll { it.id == w.id } }.onFailure { error = it.message } }
    } }
}

// ─── Audit Trail Pane ─────────────────────────────────────────────────────────

@Composable
internal fun SaAuditPane() {
    val list = remember { mutableStateListOf<SaAuditEntry>() }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var query by rememberSaveable { mutableStateOf("") }
    var kind by rememberSaveable { mutableStateOf("all") }
    var limit by remember { mutableStateOf(100) }
    LaunchedEffect(limit) {
        runCatching { Api.decode<List<SaAuditEntry>>(Api.get("/admin/sa/audit-trail?limit=$limit")["entries"]) }.onSuccess { list.clear(); list.addAll(it) }.onFailure { error = it.message }
        loading = false
    }
    fun kindOf(e: SaAuditEntry) = when (e.method) { "DELETE" -> "removed"; "POST" -> "added"; "PUT", "PATCH" -> "changed"; else -> e.method.lowercase().ifBlank { "action" } }
    val today = java.time.LocalDate.now().toString()
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        StatStrip(listOf(Stat("${list.count { it.createdAt.startsWith(today) }}", "Today"), Stat("${list.map { it.actorEmail }.distinct().size}", "People", KitBlue), Stat("${list.count { it.method == "DELETE" }}", "Removals", KitRed)))
        SearchBar(query, { query = it }, "Search person or action")
        FilterPills(listOf("all" to "Everything", "added" to "Added", "changed" to "Changed", "removed" to "Removed"), kind) { kind = it }
        ErrorNote(error)
        if (loading) Loading()
        val shown = list.filter { e -> (query.isBlank() || e.actorEmail.contains(query, true) || e.route.contains(query, true)) && (kind == "all" || kindOf(e) == kind) }
        if (!loading && shown.isEmpty()) EmptyState(Icons.Rounded.History, "Nothing found", "Try another search.")
        var lastDay = ""
        shown.forEach { e ->
            val day = e.createdAt.take(10)
            if (day != lastDay) { lastDay = day; Text(if (day == today) "TODAY" else day, style = Type.Label.copy(fontSize = 10.sp), color = Brand.Gold, modifier = Modifier.padding(top = 4.dp)) }
            val k = kindOf(e)
            val tint = when (k) { "removed" -> KitRed; "added" -> KitGreen; "changed" -> Brand.Gold; else -> Brand.Text2 }
            KitRow(e.actorEmail.ifBlank { "System" }, line1 = k.replaceFirstChar(Char::uppercase) + " · " + e.route.removePrefix("/api/v1").removePrefix("/admin"),
                line2 = e.createdAt.drop(11).take(5) + " UTC",
                leading = { IconTile(when (k) { "removed" -> Icons.Rounded.DeleteOutline; "added" -> Icons.Rounded.AddCircleOutline; else -> Icons.Rounded.Edit }, tint, 40) })
        }
        if (list.size >= limit) GhostButton("Show older") { limit += 100 }
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
    var saved by remember { mutableStateOf<Map<String, Boolean>>(emptyMap()) }
    var modules by remember { mutableStateOf<Map<String, Boolean>>(emptyMap()) }
    val moduleLabels = listOf(
        Triple("onlineGiving", "Online giving", "M-Pesa and card giving in the app") to Icons.Rounded.Payments,
        Triple("livestream", "Live services", "Watching live in the app") to Icons.Rounded.LiveTv,
        Triple("communityChat", "Community chat", "Members talk to each other") to Icons.Rounded.Forum,
        Triple("attendanceKiosk", "Attendance POS", "Check-in devices at the gate") to Icons.Rounded.PointOfSale,
        Triple("volunteerScheduling", "Volunteer scheduling", "Serve teams and rotas") to Icons.Rounded.VolunteerActivism,
        Triple("counseling", "Counseling", "Requests for a pastor's time") to Icons.Rounded.SupportAgent,
        Triple("taxStatements", "Giving statements", "Yearly statements for givers") to Icons.Rounded.Description,
    )
    LaunchedEffect(Unit) {
        runCatching { (Api.get("/admin/sa/system/modules")["modules"]?.jsonObject ?: JsonObject(emptyMap())).entries.associate { (k, v) -> k to (v.jsonPrimitive.booleanOrNull ?: false) } }
            .onSuccess { modules = it; saved = it }.onFailure { error = it.message }
        loading = false
    }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        StatStrip(listOf(Stat("${modules.count { it.value }}", "Switched on", KitGreen), Stat("${modules.count { !it.value }}", "Off", Brand.Text2)))
        Text("Turn whole features on or off for everyone. Changes apply when you save.", style = Type.Meta, color = Brand.Text2)
        ErrorNote(error)
        success?.let { Text(it, color = KitGreen, fontSize = 13.sp) }
        if (loading) Loading()
        moduleLabels.forEach { (t, icon) ->
            val (key, label, sub) = t
            val on = modules[key] ?: false
            KitRow(label, line1 = sub, leading = { IconTile(icon, if (on) KitGreen else Brand.Muted) }, trailing = {
                Switch(checked = on, onCheckedChange = { v -> modules = modules.toMutableMap().also { it[key] = v }; success = null },
                    colors = SwitchDefaults.colors(checkedThumbColor = Brand.Black, checkedTrackColor = Brand.Gold))
            })
        }
        GoldButton(if (modules == saved) "Saved" else "Save changes", busy = busy, enabled = !busy && modules.isNotEmpty() && modules != saved) {
            scope.launch { busy = true; error = null; success = null
                runCatching { Api.put("/admin/sa/system/modules", mapOf("modules" to modules)) }.onSuccess { saved = modules; success = "Saved. Members see the change right away." }.onFailure { error = it.message }
                busy = false }
        }
    }
}

// ─── Backup & GDPR Pane ───────────────────────────────────────────────────────

@Composable
internal fun SaBackupPane() {
    val scope = rememberCoroutineScope()
    var gdprId by remember { mutableStateOf("") }
    var gdprReason by remember { mutableStateOf("") }
    var gdprConfirm by remember { mutableStateOf("") }
    var gdprBusy by remember { mutableStateOf(false) }
    var gdprResult by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        KitSection("Backups", "Every night, automatically") {
            KitRow("Nightly backup", line1 = "Database and all files, copied to Cloudflare", leading = { IconTile(Icons.Rounded.CloudDone, KitGreen) })
            Text("A backup holds every member's personal details, so it's downloaded only on a computer: web dashboard → System → Data & Backup → Download backup.", style = Type.Meta, color = Brand.Text2)
        }
        KitSection("Erase someone's data", "When a person asks to be forgotten (Kenya Data Protection Act)") {
            Text("Removes their name, contacts, messages and history for good. Gifts stay in the accounts without their details.", style = Type.Meta, color = Brand.Text2)
            SaMemberPicker(gdprId) { gdprId = it }
            Field("REASON", gdprReason, { gdprReason = it }, hint = "e.g. Their written request of 3 Nov 2026")
            Field("TYPE ERASE TO CONFIRM", gdprConfirm, { gdprConfirm = it.uppercase() })
            ErrorNote(error)
            gdprResult?.let { Text(it, color = KitGreen, fontSize = 13.sp) }
            Box(Modifier.fillMaxWidth().height(52.dp).clip(RoundedCornerShape(50))
                .background(if (gdprId.isNotBlank() && gdprReason.isNotBlank() && gdprConfirm == "ERASE" && !gdprBusy) KitRed else KitRed.copy(alpha = 0.25f))
                .clickable(enabled = gdprId.isNotBlank() && gdprReason.isNotBlank() && gdprConfirm == "ERASE" && !gdprBusy) {
                    scope.launch { gdprBusy = true; error = null; gdprResult = null
                        runCatching { Api.delete("/admin/sa/members/${gdprId.trim()}/purge-gdpr?reason=${java.net.URLEncoder.encode(gdprReason.trim(), "UTF-8")}") }
                            .onSuccess { gdprResult = "Their personal data has been erased."; gdprId = ""; gdprReason = ""; gdprConfirm = "" }.onFailure { error = it.message }
                        gdprBusy = false }
                }, contentAlignment = Alignment.Center) {
                Text(if (gdprBusy) "Erasing…" else "Erase permanently", color = Color.White, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 15.sp)
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
    var deleting by remember { mutableStateOf<SaRole?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }
    suspend fun reload() { list.clear(); list.addAll(Api.decode<List<SaRole>>(Api.get("/admin/sa/roles")["roles"])) }
    LaunchedEffect(Unit) { runCatching { reload() }.onFailure { error = it.message }; loading = false }
    val labels = KEY_PERMISSIONS.toMap()
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        StatStrip(listOf(Stat("${list.size}", "Roles"), Stat("${list.sumOf { it.holders }}", "People with a role", KitBlue)))
        Text("Design roles like “Media team” or “Usher”, then give them to people in Members. Changing a role changes it for everyone who has it.", style = Type.Meta, color = Brand.Text2)
        SectionHeading("Roles", "+ New role") { editing = SaRole() }
        ErrorNote(error)
        if (loading) Loading()
        if (!loading && list.isEmpty()) EmptyState(Icons.Rounded.AdminPanelSettings, "No roles yet", "Start with “Usher” (check-in only).")
        list.forEach { r ->
            KitRow(r.name, line1 = r.permissions.joinToString(", ") { labels[it] ?: it }.ifBlank { "No permissions yet" }, line2 = r.description,
                leading = { IconTile(Icons.Rounded.AdminPanelSettings, Brand.Gold) },
                trailing = { Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Badge(if (r.holders == 1) "1 PERSON" else "${r.holders} PEOPLE", KitBlue)
                    SmallAction(Icons.Rounded.ContentCopy, "Duplicate", Brand.GoldLight) { scope.launch { runCatching { Api.post("/admin/sa/roles/${r.id}/duplicate", emptyMap<String, String>()); reload() }.onFailure { error = it.message } } }
                    SmallAction(Icons.Rounded.DeleteOutline, "Delete", KitRed) { deleting = r }
                } }, onClick = { editing = r })
        }
    }
    editing?.let { role ->
        var name by remember(role.id) { mutableStateOf(role.name) }
        var description by remember(role.id) { mutableStateOf(role.description) }
        val perms = remember(role.id) { mutableStateListOf<String>().apply { addAll(role.permissions) } }
        var busy by remember { mutableStateOf(false) }
        KitSheet(if (role.id.isBlank()) "New role" else "Edit ${role.name}", { editing = null }) {
            Field("NAME", name, { name = it }, hint = "e.g. Usher")
            Field("WHAT IT'S FOR", description, { description = it }, hint = "e.g. Checks people in at the gate")
            Text("WHAT PEOPLE WITH THIS ROLE CAN DO", style = Type.Label.copy(fontSize = 10.sp), color = Brand.Text2)
            PermissionList(perms)
            if (role.holders > 0) Text("${role.holders} ${if (role.holders == 1) "person has" else "people have"} this role; they get the change straight away.", style = Type.Meta, color = Brand.GoldLight)
            GoldButton("Save", busy = busy, enabled = !busy && name.isNotBlank()) {
                scope.launch { busy = true
                    runCatching { Api.put("/admin/sa/roles", mapOf("id" to role.id, "name" to name.trim(), "description" to description.trim(), "permissions" to perms.toList())); reload() }
                        .onSuccess { editing = null }.onFailure { error = it.message }; busy = false }
            }
        }
    }
    deleting?.let { r -> ConfirmDialog("Delete ${r.name}?", if (r.holders > 0) "${r.holders} ${if (r.holders == 1) "person loses" else "people lose"} these permissions." else "No one has this role.", "Delete", { deleting = null }) {
        scope.launch { runCatching { Api.delete("/admin/sa/roles/${r.id}"); reload() }.onFailure { error = it.message } }
    } }
}
