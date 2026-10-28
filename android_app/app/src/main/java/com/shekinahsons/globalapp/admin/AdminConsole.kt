package com.shekinahsons.globalapp.admin

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
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
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Logout
import androidx.compose.material.icons.automirrored.rounded.MenuBook
import androidx.compose.material.icons.rounded.Campaign
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Dashboard
import androidx.compose.material.icons.rounded.Forum
import androidx.compose.material.icons.rounded.Groups
import androidx.compose.material.icons.rounded.MoreHoriz
import androidx.compose.material.icons.rounded.Payments
import androidx.compose.material.icons.rounded.PhoneAndroid
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.QrCodeScanner
import androidx.compose.material.icons.rounded.Sensors
import androidx.compose.material.icons.rounded.VolunteerActivism
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.books.LibraryScreen
import com.shekinahsons.globalapp.data.Api
import com.shekinahsons.globalapp.data.Session
import com.shekinahsons.globalapp.live.GoLiveScreen
import com.shekinahsons.globalapp.ui.components.Avatar
import com.shekinahsons.globalapp.ui.components.ErrorNote
import com.shekinahsons.globalapp.ui.components.Field
import com.shekinahsons.globalapp.ui.components.GoldButton
import com.shekinahsons.globalapp.ui.components.glass
import com.shekinahsons.globalapp.ui.components.lifted
import com.shekinahsons.globalapp.ui.components.pressable
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Type
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import java.time.Duration
import java.time.OffsetDateTime

@Serializable
data class AdminOverview(
    val members: Int = 0, val newMembersWeek: Int = 0, val pendingPayments: Int = 0, val pendingAmount: Int = 0,
    val givenThisMonth: Int = 0, val books: Int = 0, val bookSalesMonth: Int = 0, val newPrayers: Int = 0,
    val chatToday: Int = 0, val liveTitle: String = "", val liveStatus: String = "",
)

@Serializable
data class Txn(
    val id: String = "", val category: String = "", val method: String = "", val phone: String = "", val amount: Int = 0,
    val note: String = "", val status: String = "", val createdAt: String = "", val payerName: String = "",
    val providerReference: String = "", val email: String = "",
)

@Serializable
data class TeamMember(val id: String = "", val name: String = "", val email: String = "", val role: String = "", val permissions: List<String> = emptyList())

@Serializable
data class PermissionChange(val member: String = "", val email: String = "", val permission: String = "", val action: String = "", val changedBy: String = "", val at: String = "")

@Serializable
data class AdminPrayer(val id: String = "", val name: String = "", val text: String = "", val category: String = "", val status: String = "", val ownerEmail: String = "", val createdAt: String = "")

private enum class Section(val label: String, val icon: ImageVector) {
    Overview("Overview", Icons.Rounded.Dashboard),
    Payments("Payments", Icons.Rounded.Payments),
    Team("Team", Icons.Rounded.Groups),
    Books("Books", Icons.AutoMirrored.Rounded.MenuBook),
    More("More", Icons.Rounded.MoreHoriz),
}

private val permissionInfo = listOf(
    Triple("live:broadcast", "Go live", "Stream services from the Live tab"),
    Triple("live:moderate", "Moderate live chat", "Pin, remove and block comments"),
    Triple("books:publish", "Publish books", "Add books and set free or a price"),
    Triple("checkin:scan", "Gate check-in", "Scan members' codes and see attendance"),
)
private fun permissionName(p: String) = permissionInfo.firstOrNull { it.first == p }?.second ?: p

private fun money(n: Int) = "KSh ${"%,d".format(n)}"

// "5 min ago", "3 h ago", "2 d ago".
private fun ago(iso: String): String = runCatching {
    val d = Duration.between(OffsetDateTime.parse(iso), OffsetDateTime.now())
    when {
        d.toMinutes() < 1 -> "just now"
        d.toMinutes() < 60 -> "${d.toMinutes()} min ago"
        d.toHours() < 24 -> "${d.toHours()} h ago"
        else -> "${d.toDays()} d ago"
    }
}.getOrDefault("")

// The admin console: what needs attention, payments to verify, who may do
// what, the books, notifications and prayer requests. Opens for accounts
// whose role is admin.
@Composable
fun AdminConsole(session: Session, openApp: () -> Unit, openLive: () -> Unit) {
    var section by rememberSaveable { mutableStateOf(Section.Overview) }
    var goLive by remember { mutableStateOf(false) }
    var gate by remember { mutableStateOf(false) }
    BackHandler(enabled = section != Section.Overview && !goLive && !gate) { section = Section.Overview }

    if (gate) {
        com.shekinahsons.globalapp.attendance.GateScreen(null) { gate = false }
        return
    }
    if (goLive) {
        GoLiveScreen(session) { goLive = false }
        return
    }
    Box(Modifier.fillMaxSize().background(Brand.Black)) {
        // A warm wash behind the header.
        Box(Modifier.fillMaxWidth().height(260.dp).background(Brush.verticalGradient(listOf(Color(0x33D4AF37), Color.Transparent))))
        Column(Modifier.fillMaxSize()) {
            if (section != Section.Books) Header(session, openApp)
            AnimatedContent(section, transitionSpec = { fadeIn() togetherWith fadeOut() }, label = "admin", modifier = Modifier.weight(1f)) { s ->
                when (s) {
                    Section.Overview -> OverviewPage(session, go = { section = it }, goLive = { goLive = true }, openLive = openLive, openGate = { gate = true })
                    Section.Payments -> PaymentsPage()
                    Section.Team -> TeamPage()
                    Section.Books -> LibraryScreen(session, openProfile = {}, onBack = { section = Section.Overview }, bottomInset = 76.dp)
                    Section.More -> MorePage()
                }
            }
        }
        SectionBar(section, Modifier.align(Alignment.BottomCenter)) { section = it }
    }
}

@Composable
private fun Header(session: Session, openApp: () -> Unit) {
    Row(Modifier.fillMaxWidth().statusBarsPadding().padding(start = 20.dp, end = 12.dp, top = 12.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Avatar(session.member?.name.orEmpty(), session.member?.id.orEmpty(), 42.dp)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text("ADMIN CONSOLE", style = Type.Label, color = Brand.Gold)
            Text(session.member?.name.orEmpty(), style = Type.CardTitle, color = Brand.White, maxLines = 1)
        }
        Row(
            Modifier.glass().clickable(onClick = openApp).padding(horizontal = 14.dp, vertical = 9.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Rounded.PhoneAndroid, null, tint = Brand.GoldLight, modifier = Modifier.size(17.dp))
            Spacer(Modifier.width(6.dp))
            Text("View app", color = Brand.White, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
        }
        Icon(Icons.AutoMirrored.Rounded.Logout, "Sign out", tint = Brand.Text2, modifier = Modifier.padding(start = 4.dp).size(42.dp).clip(CircleShape).clickable { session.signOut() }.padding(10.dp))
    }
}

@Composable
private fun SectionBar(current: Section, modifier: Modifier, select: (Section) -> Unit) {
    Row(
        modifier.navigationBarsPadding().padding(horizontal = 14.dp, vertical = 10.dp).fillMaxWidth()
            .lifted(RoundedCornerShape(28.dp), 20.dp).clip(RoundedCornerShape(28.dp)).background(Color(0xF0151517))
            .border(1.dp, Brand.Line, RoundedCornerShape(28.dp)).padding(6.dp),
    ) {
        Section.entries.forEach { s ->
            val on = s == current
            Column(
                Modifier.weight(1f).clip(RoundedCornerShape(22.dp)).background(if (on) Brand.GoldGradient else SolidColor(Color.Transparent))
                    .clickable { select(s) }.padding(vertical = 8.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Icon(s.icon, null, tint = if (on) Brand.Black else Brand.Text2, modifier = Modifier.size(21.dp))
                Text(s.label, color = if (on) Brand.Black else Brand.Text2, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 11.sp)
            }
        }
    }
}

private val pagePadding = PaddingValues(start = 18.dp, end = 18.dp, top = 8.dp, bottom = 130.dp)

@Composable
private fun PageTitle(title: String, subtitle: String) {
    Column(Modifier.padding(bottom = 14.dp)) {
        Text(title, style = Type.Display, color = Brand.White)
        Text(subtitle, style = Type.Meta.copy(fontSize = 13.5.sp), color = Brand.Text2)
    }
}

// ---------------------------------------------------------------- Overview

@Composable
private fun OverviewPage(session: Session, go: (Section) -> Unit, goLive: () -> Unit, openLive: () -> Unit, openGate: () -> Unit) {
    var o by remember { mutableStateOf<AdminOverview?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var tick by remember { mutableIntStateOf(0) }
    LaunchedEffect(tick) {
        runCatching { Api.decode<AdminOverview>(Api.get("/admin/overview")) }.onSuccess { o = it; error = null }.onFailure { error = it.message }
    }
    LazyColumn(contentPadding = pagePadding, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { PageTitle("Good to see you, ${session.firstName}", "Here's what needs attention") }
        error?.let { item { ErrorNote(it); GoldButton("Try again") { tick++ } } }
        val v = o
        if (v == null && error == null) item { Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Brand.Gold) } }
        if (v != null) {
            item { LiveCard(v, goLive, openLive) }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Stat("Payments to check", "${v.pendingPayments}", if (v.pendingPayments > 0) money(v.pendingAmount) + " waiting" else "All clear", Icons.Rounded.Payments, v.pendingPayments > 0, Modifier.weight(1f)) { go(Section.Payments) }
                    Stat("Given this month", money(v.givenThisMonth), "Confirmed gifts", Icons.Rounded.VolunteerActivism, false, Modifier.weight(1f)) { go(Section.Payments) }
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Stat("Members", "${v.members}", "+${v.newMembersWeek} this week", Icons.Rounded.Groups, false, Modifier.weight(1f)) { go(Section.Team) }
                    Stat("Book sales", "${v.bookSalesMonth}", "${v.books} titles on the shelf", Icons.AutoMirrored.Rounded.MenuBook, false, Modifier.weight(1f)) { go(Section.Books) }
                }
            }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Stat("Prayer requests", "${v.newPrayers}", "New to read", Icons.Rounded.VolunteerActivism, v.newPrayers > 0, Modifier.weight(1f)) { go(Section.More) }
                    Stat("Chat today", "${v.chatToday}", "Community messages", Icons.Rounded.Forum, false, Modifier.weight(1f)) { go(Section.More) }
                }
            }
            item {
                Text("Quick actions", style = Type.Title, color = Brand.White, modifier = Modifier.padding(top = 8.dp, bottom = 2.dp))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    item { Quick("Gate check-in", Icons.Rounded.QrCodeScanner, onClick = openGate) }
                    item { Quick("Events & registrations", Icons.Rounded.Groups) { go(Section.More) } }
                    item { Quick("Send notification", Icons.Rounded.Campaign) { go(Section.More) } }
                    item { Quick("Publish a book", Icons.AutoMirrored.Rounded.MenuBook) { go(Section.Books) } }
                    item { Quick("Give permissions", Icons.Rounded.Groups) { go(Section.Team) } }
                }
            }
        }
    }
}

@Composable
private fun LiveCard(o: AdminOverview, goLive: () -> Unit, openLive: () -> Unit) {
    val live = o.liveStatus.isNotBlank()
    Row(
        Modifier.fillMaxWidth().lifted(RoundedCornerShape(24.dp), 18.dp, if (live) Brand.Red else Color.Black).clip(RoundedCornerShape(24.dp))
            .background(if (live) Brush.linearGradient(listOf(Color(0xFFE53935), Color(0xFF8E1414))) else Brush.linearGradient(listOf(Color(0xFF242426), Color(0xFF151517))))
            .border(1.dp, if (live) Color(0x55FFFFFF) else Brand.Line, RoundedCornerShape(24.dp))
            .clickable(onClick = if (live) openLive else goLive).padding(18.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(50.dp).clip(CircleShape).background(if (live) Color(0x33FFFFFF) else Color(0x22E53935)), contentAlignment = Alignment.Center) {
            Icon(Icons.Rounded.Sensors, null, tint = if (live) Color.White else Brand.Red, modifier = Modifier.size(28.dp))
        }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(if (live) (if (o.liveStatus == "live") "LIVE NOW" else "STARTING") else "NOT LIVE", style = Type.Label, color = if (live) Color.White else Brand.Red)
            Text(if (live) o.liveTitle.ifBlank { "Live service" } else "Go live from this phone", style = Type.CardTitle, color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(if (live) "Watch and moderate the chat" else "Camera, title and quality, then start", style = Type.Meta, color = Color(0xCCFFFFFF))
        }
        Text(if (live) "Open" else "Go live", color = if (live) Brand.Red else Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp,
            modifier = Modifier.clip(RoundedCornerShape(50)).background(if (live) Color.White else Brand.Red).padding(horizontal = 16.dp, vertical = 9.dp))
    }
}

@Composable
private fun Stat(label: String, value: String, detail: String, icon: ImageVector, alert: Boolean, modifier: Modifier, onClick: () -> Unit) {
    Column(
        modifier.lifted(RoundedCornerShape(22.dp), 12.dp).glass(RoundedCornerShape(22.dp), 0.9f)
            .then(if (alert) Modifier.border(1.dp, Brand.Gold, RoundedCornerShape(22.dp)) else Modifier)
            .pressable(onClick).padding(16.dp),
    ) {
        Box(Modifier.size(34.dp).clip(RoundedCornerShape(11.dp)).background(if (alert) Brand.GoldGradient else SolidColor(Color(0x1FFFFFFF))), contentAlignment = Alignment.Center) {
            Icon(icon, null, tint = if (alert) Brand.Black else Brand.GoldLight, modifier = Modifier.size(19.dp))
        }
        Spacer(Modifier.height(12.dp))
        Text(value, color = Brand.White, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 22.sp, maxLines = 1)
        Text(label, color = Brand.White, fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 13.sp, maxLines = 1)
        Text(detail, style = Type.Meta.copy(fontSize = 11.5.sp), color = if (alert) Brand.GoldLight else Brand.Text2, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun Quick(label: String, icon: ImageVector, onClick: () -> Unit) {
    Row(Modifier.glass(RoundedCornerShape(18.dp), 0.9f).pressable(onClick).padding(horizontal = 16.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = Brand.Gold, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(8.dp))
        Text(label, color = Brand.White, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 13.5.sp)
    }
}

@Composable
private fun Chips(options: List<Pair<String, String>>, current: String, select: (String) -> Unit) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(bottom = 6.dp)) {
        items(options) { (key, label) ->
            val on = key == current
            Text(label, color = if (on) Brand.Black else Brand.White, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                modifier = (if (on) Modifier.clip(RoundedCornerShape(50)).background(Brand.GoldGradient) else Modifier.glass()).clickable { select(key) }.padding(horizontal = 14.dp, vertical = 8.dp))
        }
    }
}

// ---------------------------------------------------------------- Payments

@Composable
private fun PaymentsPage() {
    val scope = rememberCoroutineScope()
    val all = remember { mutableStateListOf<Txn>() }
    var filter by rememberSaveable { mutableStateOf("awaiting_verification") }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf("") }
    var tick by remember { mutableIntStateOf(0) }
    LaunchedEffect(tick) {
        runCatching { Api.decode<List<Txn>>(Api.get("/admin/giving/transactions")["transactions"]) }
            .onSuccess { all.clear(); all.addAll(it); error = null }.onFailure { error = it.message }
        loading = false
    }
    fun review(t: Txn, status: String) = scope.launch {
        busy = t.id
        runCatching { Api.patch("/admin/giving/transactions/${t.id}", mapOf("status" to status)) }
            .onSuccess { val i = all.indexOfFirst { it.id == t.id }; if (i >= 0) all[i] = t.copy(status = status) }
            .onFailure { error = it.message }
        busy = ""
    }
    val shown = all.filter { filter == "all" || it.status == filter }
    LazyColumn(contentPadding = pagePadding, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { PageTitle("Payments", "Check each code against the M-Pesa, Airtel or bank statement") }
        item {
            Chips(listOf("awaiting_verification" to "Needs check (${all.count { it.status == "awaiting_verification" }})", "success" to "Confirmed", "failed" to "Not found", "all" to "All"), filter) { filter = it }
        }
        error?.let { item { ErrorNote(it) } }
        if (loading) item { Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Brand.Gold) } }
        if (!loading && shown.isEmpty()) item { Empty(if (filter == "awaiting_verification") "Nothing to check. All payments are verified." else "No payments here yet.") }
        items(shown, key = { it.id }) { t -> PaymentCard(t, busy == t.id, confirm = { review(t, "success") }, reject = { review(t, "failed") }) }
    }
}

@Composable
private fun PaymentCard(t: Txn, busy: Boolean, confirm: () -> Unit, reject: () -> Unit) {
    val book = t.category == "Book"
    val (methodName, methodColor) = when {
        "mpesa" in t.method -> "M-Pesa" to Color(0xFF2EAD4B)
        "airtel" in t.method -> "Airtel Money" to Color(0xFFE53935)
        else -> "Bank" to Brand.GoldDeep
    }
    Column(Modifier.fillMaxWidth().glass(RoundedCornerShape(22.dp), 0.9f).padding(16.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(methodName, color = Color.White, fontSize = 11.5.sp, fontWeight = FontWeight.Bold,
                modifier = Modifier.clip(RoundedCornerShape(50)).background(methodColor).padding(horizontal = 10.dp, vertical = 3.dp))
            Spacer(Modifier.width(8.dp))
            Text(if (book) "Book · ${t.note}" else t.category, color = Brand.GoldLight, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            Text(ago(t.createdAt), style = Type.Meta, color = Brand.Muted)
        }
        Spacer(Modifier.height(10.dp))
        Row(verticalAlignment = Alignment.Bottom) {
            Column(Modifier.weight(1f)) {
                Text(t.payerName.ifBlank { "Unnamed" }, style = Type.CardTitle, color = Brand.White)
                Text(listOf(t.phone, t.email).filter { it.isNotBlank() }.joinToString(" · "), style = Type.Meta, color = Brand.Text2)
            }
            Text(money(t.amount), color = Brand.White, fontWeight = FontWeight.Bold, fontSize = 20.sp)
        }
        if (t.providerReference.isNotBlank()) {
            Spacer(Modifier.height(10.dp))
            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Color(0x14FFFFFF)).padding(horizontal = 12.dp, vertical = 8.dp)) {
                Text("CODE", style = Type.Label, color = Brand.Muted, modifier = Modifier.padding(end = 10.dp))
                Text(t.providerReference, color = Brand.White, fontFamily = Inter, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
            }
        }
        Spacer(Modifier.height(12.dp))
        when (t.status) {
            "awaiting_verification" -> Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(Modifier.weight(1f).height(46.dp).clip(RoundedCornerShape(50)).border(1.dp, Color(0x55FFFFFF), RoundedCornerShape(50)).clickable(enabled = !busy, onClick = reject),
                    horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.Close, null, tint = Brand.Text2, modifier = Modifier.size(18.dp))
                    Text(" Not found", color = Brand.Text2, fontWeight = FontWeight.SemiBold)
                }
                Row(Modifier.weight(1f).height(46.dp).clip(RoundedCornerShape(50)).background(Brand.GoldGradient).clickable(enabled = !busy, onClick = confirm),
                    horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                    if (busy) CircularProgressIndicator(color = Brand.Black, strokeWidth = 2.dp, modifier = Modifier.size(18.dp))
                    else { Icon(Icons.Rounded.Check, null, tint = Brand.Black, modifier = Modifier.size(18.dp)); Text(if (book) " Confirm & unlock" else " Confirm", color = Brand.Black, fontWeight = FontWeight.Bold) }
                }
            }
            "success" -> Text(if (book) "Confirmed · the book is unlocked for them" else "Confirmed · receipt ready in their app", color = Color(0xFF4ADE80), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            "failed" -> Text("Marked not found", color = Brand.Red, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            else -> Text(t.status, style = Type.Meta, color = Brand.Text2)
        }
    }
}

@Composable
private fun Empty(text: String) {
    Column(Modifier.fillMaxWidth().padding(vertical = 40.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(56.dp).clip(CircleShape).background(Color(0x1FD4AF37)), contentAlignment = Alignment.Center) {
            Icon(Icons.Rounded.Check, null, tint = Brand.Gold, modifier = Modifier.size(28.dp))
        }
        Spacer(Modifier.height(10.dp))
        Text(text, style = Type.Body, color = Brand.Text2)
    }
}

// ---------------------------------------------------------------- Team

@Composable
private fun TeamPage() {
    val scope = rememberCoroutineScope()
    val members = remember { mutableStateListOf<TeamMember>() }
    val log = remember { mutableStateListOf<PermissionChange>() }
    var query by rememberSaveable { mutableStateOf("") }
    var view by rememberSaveable { mutableStateOf("people") }
    var error by remember { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf("") }
    var tick by remember { mutableIntStateOf(0) }
    LaunchedEffect(query) {
        kotlinx.coroutines.delay(250)
        runCatching { Api.decode<List<TeamMember>>(Api.get("/admin/members?query=${java.net.URLEncoder.encode(query, "UTF-8")}")["members"]) }
            .onSuccess { members.clear(); members.addAll(it) }.onFailure { error = it.message }
    }
    LaunchedEffect(view, tick) {
        if (view == "log") runCatching { Api.decode<List<PermissionChange>>(Api.get("/admin/permissions/log")["changes"]) }
            .onSuccess { log.clear(); log.addAll(it) }.onFailure { error = it.message }
    }
    fun toggle(m: TeamMember, p: String) = scope.launch {
        saving = m.id + p
        val next = if (p in m.permissions) m.permissions - p else m.permissions + p
        runCatching { Api.decode<List<String>>(Api.patch("/admin/members/${m.id}/permissions", mapOf("permissions" to next))["permissions"]) }
            .onSuccess { granted -> val i = members.indexOfFirst { it.id == m.id }; if (i >= 0) members[i] = m.copy(permissions = granted); tick++ }
            .onFailure { error = it.message }
        saving = ""
    }
    LazyColumn(contentPadding = pagePadding, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { PageTitle("Team & permissions", "Who may go live, moderate the chat and publish books") }
        item { Chips(listOf("people" to "People", "log" to "Change log"), view) { view = it } }
        error?.let { item { ErrorNote(it) } }
        if (view == "people") {
            item {
                Row(Modifier.fillMaxWidth().height(50.dp).glass(RoundedCornerShape(50), 0.8f).padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.Search, null, tint = Brand.Text2, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(10.dp))
                    Box(Modifier.weight(1f)) {
                        if (query.isEmpty()) Text("Search by name or email", style = Type.Body, color = Brand.Muted)
                        BasicTextField(query, { query = it }, singleLine = true, textStyle = Type.Body.copy(color = Brand.White), cursorBrush = SolidColor(Brand.Gold), modifier = Modifier.fillMaxWidth())
                    }
                }
            }
            items(members, key = { it.id }) { m ->
                val admin = m.role == "admin" || m.role == "super_admin"
                Column(Modifier.fillMaxWidth().glass(RoundedCornerShape(22.dp), 0.9f).padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Avatar(m.name, m.id, 40.dp)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(m.name, style = Type.CardTitle, color = Brand.White, maxLines = 1)
                            Text(m.email, style = Type.Meta, color = Brand.Text2, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                        if (admin) Text("ADMIN", color = Brand.Black, fontSize = 10.5.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clip(RoundedCornerShape(50)).background(Brand.Gold).padding(horizontal = 9.dp, vertical = 3.dp))
                    }
                    var resetNote by remember(m.id) { mutableStateOf<String?>(null) }
                    Text(resetNote ?: "Send password reset code", color = if (resetNote != null) Color(0xFF4ADE80) else Brand.BlueText, fontSize = 13.sp, fontWeight = FontWeight.Medium,
                        modifier = Modifier.padding(top = 8.dp).clip(RoundedCornerShape(8.dp)).clickable(enabled = resetNote == null) {
                            scope.launch { runCatching { Api.post("/admin/members/${m.id}/reset-password") }.onSuccess { resetNote = "Reset code emailed to ${m.email}" }.onFailure { error = it.message } }
                        }.padding(vertical = 4.dp))
                    if (admin) Text("Admins can do everything.", style = Type.Meta, color = Brand.Text2, modifier = Modifier.padding(top = 10.dp))
                    else permissionInfo.forEach { (key, label, detail) ->
                        Row(Modifier.fillMaxWidth().padding(top = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(label, color = Brand.White, fontSize = 14.5.sp, fontWeight = FontWeight.Medium)
                                Text(detail, style = Type.Meta, color = Brand.Text2)
                            }
                            Switch(
                                checked = key in m.permissions, enabled = saving != m.id + key, onCheckedChange = { toggle(m, key) },
                                colors = SwitchDefaults.colors(checkedThumbColor = Brand.Black, checkedTrackColor = Brand.Gold, uncheckedTrackColor = Color(0x22FFFFFF), uncheckedBorderColor = Color(0x44FFFFFF)),
                            )
                        }
                    }
                }
            }
        } else {
            if (log.isEmpty()) item { Empty("No permission changes yet.") }
            items(log) { c ->
                Row(Modifier.fillMaxWidth().glass(RoundedCornerShape(18.dp), 0.8f).padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(10.dp).clip(CircleShape).background(if (c.action == "granted") Color(0xFF4ADE80) else Brand.Red))
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text("${c.member} · ${if (c.action == "granted") "can now" else "can no longer"} ${permissionName(c.permission).lowercase()}", color = Brand.White, fontSize = 14.sp)
                        Text("by ${c.changedBy} · ${ago(c.at)}", style = Type.Meta, color = Brand.Text2)
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------- More: notifications and prayer requests

@Composable
private fun MorePage() {
    var view by rememberSaveable { mutableStateOf("events") }
    LazyColumn(contentPadding = pagePadding, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { PageTitle("More", "Events, serve teams, branches, notifications and prayer") }
        item { Chips(listOf("events" to "Events", "serve" to "Serve", "branches" to "Branches", "notify" to "Send notification", "prayers" to "Prayer requests"), view) { view = it } }
        when (view) {
            "events" -> item { AdminEventsPane() }
            "serve" -> item { AdminServePane() }
            "branches" -> item { AdminBranchesPane() }
            "notify" -> item { NotifyForm() }
            else -> prayers(this)
        }
    }
}

@Composable
private fun NotifyForm() {
    val scope = rememberCoroutineScope()
    var title by remember { mutableStateOf("") }
    var body by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("general") }
    var busy by remember { mutableStateOf(false) }
    var result by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    Column(Modifier.fillMaxWidth().glass(RoundedCornerShape(22.dp), 0.9f).padding(16.dp)) {
        Text("Goes to every phone that allows this kind of notification, and to everyone's notification feed.", style = Type.Meta, color = Brand.Text2)
        Spacer(Modifier.height(12.dp))
        Chips(listOf("general" to "Announcement", "events" to "Event", "sermons" to "Sermon", "live" to "Live"), category) { category = it }
        Spacer(Modifier.height(6.dp))
        Field("TITLE", title, { title = it.take(80) }, hint = "e.g. Sunday service at 9 AM")
        Spacer(Modifier.height(10.dp))
        Field("MESSAGE", body, { body = it.take(240) }, minHeight = 100.dp, singleLine = false)
        ErrorNote(error)
        result?.let { Text(it, color = Color(0xFF4ADE80), fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp)) }
        Spacer(Modifier.height(14.dp))
        GoldButton("Send now", busy = busy, enabled = title.isNotBlank() && body.isNotBlank()) {
            scope.launch {
                busy = true; error = null; result = null
                runCatching { Api.post("/admin/notifications/broadcast", mapOf("title" to title.trim(), "body" to body.trim(), "category" to category)) }
                    .onSuccess { result = "Sent. It's on its way to members' phones."; title = ""; body = "" }.onFailure { error = it.message }
                busy = false
            }
        }
    }
}

private fun prayers(scope: androidx.compose.foundation.lazy.LazyListScope) = scope.item { PrayerList() }

@Composable
private fun PrayerList() {
    val scope = rememberCoroutineScope()
    val list = remember { mutableStateListOf<AdminPrayer>() }
    var filter by rememberSaveable { mutableStateOf("new") }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        runCatching { Api.decode<List<AdminPrayer>>(Api.get("/admin/prayers")["prayers"]) }.onSuccess { list.addAll(it) }.onFailure { error = it.message }
        loading = false
    }
    fun mark(p: AdminPrayer, status: String) = scope.launch {
        runCatching { Api.patch("/admin/prayers/${p.id}", mapOf("status" to status)) }
            .onSuccess { val i = list.indexOfFirst { it.id == p.id }; if (i >= 0) list[i] = p.copy(status = status) }.onFailure { error = it.message }
    }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Chips(listOf("new" to "New (${list.count { it.status == "new" }})", "prayed_for" to "Prayed for", "all" to "All"), filter) { filter = it }
        ErrorNote(error)
        if (loading) Box(Modifier.fillMaxWidth().padding(30.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Brand.Gold) }
        val shown = list.filter { filter == "all" || it.status == filter }
        if (!loading && shown.isEmpty()) Empty("No prayer requests here.")
        shown.forEach { p ->
            Column(Modifier.fillMaxWidth().glass(RoundedCornerShape(22.dp), 0.9f).padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(p.name.ifBlank { "Member" }, style = Type.CardTitle, color = Brand.White, modifier = Modifier.weight(1f))
                    Text(ago(p.createdAt), style = Type.Meta, color = Brand.Muted)
                }
                if (p.category.isNotBlank()) Text(p.category.uppercase(), style = Type.Label, color = Brand.Gold, modifier = Modifier.padding(top = 2.dp))
                Spacer(Modifier.height(8.dp))
                Text(p.text, style = Type.Body, color = Color(0xFFE6E6EA))
                Spacer(Modifier.height(12.dp))
                if (p.status == "new") Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Prayed for", color = Brand.Black, fontWeight = FontWeight.Bold, fontSize = 13.5.sp,
                        modifier = Modifier.clip(RoundedCornerShape(50)).background(Brand.GoldGradient).clickable { mark(p, "prayed_for") }.padding(horizontal = 16.dp, vertical = 9.dp))
                    Text("Mark read", color = Brand.White, fontWeight = FontWeight.SemiBold, fontSize = 13.5.sp,
                        modifier = Modifier.glass().clickable { mark(p, "reviewed") }.padding(horizontal = 16.dp, vertical = 9.dp))
                } else Text(when (p.status) { "prayed_for" -> "Prayed for"; "reviewed" -> "Read"; "contacted" -> "Contacted"; else -> p.status }, style = Type.Meta, color = Color(0xFF4ADE80))
            }
        }
    }
}
