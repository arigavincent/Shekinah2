package com.shekinahsons.globalapp.events

import android.content.Intent
import android.net.Uri
import android.provider.CalendarContract
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.OpenInNew
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.ConfirmationNumber
import androidx.compose.material.icons.rounded.EventAvailable
import androidx.compose.material.icons.rounded.Groups
import androidx.compose.material.icons.rounded.HourglassTop
import androidx.compose.material.icons.rounded.Place
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.data.Api
import com.shekinahsons.globalapp.data.Event
import com.shekinahsons.globalapp.data.HomeContent
import com.shekinahsons.globalapp.data.Session
import com.shekinahsons.globalapp.ui.components.AmbientGlow
import com.shekinahsons.globalapp.ui.components.ErrorNote
import com.shekinahsons.globalapp.ui.components.FadeImage
import com.shekinahsons.globalapp.ui.components.Field
import com.shekinahsons.globalapp.ui.components.GhostButton
import com.shekinahsons.globalapp.ui.components.GoldButton
import com.shekinahsons.globalapp.ui.components.SignInCard
import com.shekinahsons.globalapp.ui.components.TopBar
import com.shekinahsons.globalapp.ui.components.glass
import com.shekinahsons.globalapp.ui.components.lifted
import com.shekinahsons.globalapp.ui.components.outset
import com.shekinahsons.globalapp.ui.components.pressable
import com.shekinahsons.globalapp.ui.screens.GivingPage
import com.shekinahsons.globalapp.ui.screens.Purchase
import com.shekinahsons.globalapp.ui.screens.qrBitmap
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Type
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import java.time.LocalDate
import java.time.ZoneId

@Serializable
data class FormField(val id: String = "", val label: String = "", val type: String = "text", val required: Boolean = false, val options: List<String> = emptyList())

@Serializable
data class RegSetup(val mode: String = "none", val formUrl: String = "", val fields: List<FormField> = emptyList(), val price: Int = 0, val capacity: Int = 0)

@Serializable
data class MyReg(val registered: Boolean = false, val ticket: String = "", val answers: Map<String, String> = emptyMap(), val payment: String = "none")

@Serializable
data class RegInfo(val setup: RegSetup = RegSetup(), val registered: Int = 0, val spotsLeft: Int = -1, val mine: MyReg = MyReg())

private fun money(n: Int) = "KSh ${"%,d".format(n)}"
private fun date(e: Event) = runCatching { LocalDate.parse(e.eventDate) }.getOrNull()

// Events: upcoming gatherings, and signing up for them.
@Composable
fun EventsScreen(content: HomeContent, session: Session, openProfile: () -> Unit, onBack: () -> Unit) {
    var open by remember { mutableStateOf<Event?>(content.events.firstOrNull { it.id==com.shekinahsons.globalapp.notify.OpenLink.eventId }.also { com.shekinahsons.globalapp.notify.OpenLink.eventId=null }) }
    LaunchedEffect(com.shekinahsons.globalapp.notify.OpenLink.eventId,content.events) {
        val id=com.shekinahsons.globalapp.notify.OpenLink.eventId?.takeIf{it.isNotBlank()} ?: return@LaunchedEffect
        content.events.firstOrNull{it.id==id}?.let{open=it;com.shekinahsons.globalapp.notify.OpenLink.eventId=null}
    }
    BackHandler { if (open != null) open = null else onBack() }
    AnimatedContent(open, transitionSpec = { fadeIn() togetherWith fadeOut() }, label = "events", modifier = Modifier.fillMaxSize().background(Brand.Black)) { e ->
        if (e == null) EventList(content.events, onBack) { open = it } else EventDetail(e, session, openProfile) { open = null }
    }
}

@Composable
private fun EventList(events: List<Event>, onBack: () -> Unit, open: (Event) -> Unit) {
    val today = LocalDate.now(ZoneId.of("Africa/Nairobi"))
    val upcoming = events.filter { (date(it) ?: today) >= today }.sortedBy { date(it) ?: today }
    val past = (events - upcoming.toSet()).sortedByDescending { date(it) ?: today }
    val hero = upcoming.firstOrNull()
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 60.dp)) {
        item { TopBar(title = "Events", onBack = onBack) }
        if (events.isEmpty()) item { Text("No events right now. Check back soon.", style = Type.Body, color = Brand.Muted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(40.dp)) }
        hero?.let { e ->
            item {
                // The next event, large, the way Gospel Partner features its messages.
                Box(Modifier.padding(horizontal = 16.dp).fillMaxWidth().aspectRatio(0.82f).lifted(RoundedCornerShape(26.dp), 20.dp).clip(RoundedCornerShape(26.dp)).pressable { open(e) }) {
                    FadeImage(e.imageUrl, Modifier.fillMaxSize(), label = "EVENT")
                    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0.35f to Color.Transparent, 1f to Color(0xF2000000))))
                    Text("NEXT UP", style = Type.Label, color = Brand.Black, modifier = Modifier.padding(16.dp).clip(RoundedCornerShape(50)).background(Brand.GoldGradient).padding(horizontal = 12.dp, vertical = 5.dp))
                    Column(Modifier.align(Alignment.BottomStart).padding(20.dp)) {
                        Countdown(e)
                        Text(e.title, style = Type.Display, color = Color.White)
                        Spacer(Modifier.height(6.dp))
                        Text(listOf(e.date, e.time, e.location).filter { it.isNotBlank() }.joinToString(" · "), style = Type.Meta.copy(fontSize = 13.5.sp), color = Color(0xDDFFFFFF))
                        Spacer(Modifier.height(14.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Badge(e)
                            Spacer(Modifier.weight(1f))
                            Text(if (e.registration == "none" && e.price == 0) "Details" else "Register", color = Brand.Black, fontWeight = FontWeight.Bold, fontSize = 14.sp,
                                modifier = Modifier.clip(RoundedCornerShape(50)).background(Color.White).padding(horizontal = 18.dp, vertical = 10.dp))
                        }
                    }
                }
            }
        }
        val rest = upcoming.drop(1)
        if (rest.isNotEmpty()) {
            item { Text("Coming up", style = Type.Title, color = Brand.White, modifier = Modifier.padding(start = 16.dp, top = 26.dp, bottom = 10.dp)) }
            items(rest, key = { it.id }) { e -> EventRow(e) { open(e) } }
        }
        if (past.isNotEmpty()) {
            item { Text("Past events", style = Type.Title, color = Brand.Text2, modifier = Modifier.padding(start = 16.dp, top = 26.dp, bottom = 10.dp)) }
            items(past, key = { it.id }) { e -> EventRow(e, faded = true) { open(e) } }
        }
    }
}

@Composable
private fun Countdown(e: Event) {
    val d = date(e) ?: return
    val days = java.time.temporal.ChronoUnit.DAYS.between(LocalDate.now(), d)
    val label = when { days <= 0L -> "TODAY"; days == 1L -> "TOMORROW"; else -> "IN $days DAYS" }
    Text(label, style = Type.Label, color = Brand.Gold, modifier = Modifier.padding(bottom = 6.dp))
}

@Composable
private fun Badge(e: Event) {
    val (text, bg, fg) = when {
        e.price > 0 -> Triple(money(e.price), Brand.Gold, Brand.Black)
        e.registration == "form" -> Triple("Free · register", Color(0xFF1E7A4E), Color.White)
        e.registration == "link" -> Triple("Registration form", Brand.Blue, Color.White)
        else -> Triple("Free entry", Color(0x33FFFFFF), Color.White)
    }
    Text(text, color = fg, fontWeight = FontWeight.Bold, fontSize = 12.sp, modifier = Modifier.clip(RoundedCornerShape(50)).background(bg).padding(horizontal = 10.dp, vertical = 5.dp))
}

// A calendar-style date block beside the event.
@Composable
private fun EventRow(e: Event, faded: Boolean = false, onClick: () -> Unit) {
    val d = date(e)
    Row(
        Modifier.padding(horizontal = 16.dp, vertical = 6.dp).fillMaxWidth().glass(RoundedCornerShape(20.dp), 0.8f).pressable(onClick).padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(width = 92.dp, height = 92.dp).clip(RoundedCornerShape(14.dp))) {
            FadeImage(e.imageUrl, Modifier.fillMaxSize(), label = "EVENT")
            if (d != null) Column(
                Modifier.align(Alignment.TopStart).padding(6.dp).clip(RoundedCornerShape(10.dp)).background(Color(0xE6000000)).padding(horizontal = 8.dp, vertical = 4.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(d.month.name.take(3), color = Brand.Gold, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                Text("${d.dayOfMonth}", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold, lineHeight = 20.sp)
            }
        }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(e.title, style = Type.CardTitle, color = if (faded) Brand.Text2 else Brand.White, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(listOf(e.time, e.location).filter { it.isNotBlank() }.joinToString(" · "), style = Type.Meta, color = Brand.Text2, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(8.dp))
            Badge(e)
        }
    }
}

@Composable
private fun EventDetail(e: Event, session: Session, openProfile: () -> Unit, onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var info by remember { mutableStateOf<RegInfo?>(null) }
    var reload by remember { mutableIntStateOf(0) }
    var paying by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf(false) }
    var submitting by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(reload, session.member) {
        runCatching { Api.decode<RegInfo>(Api.get("/events/${e.id}/registration")) }.onSuccess { info = it }.onFailure { error = it.message }
    }
    LaunchedEffect(info?.mine?.payment) {
        while(info?.mine?.payment=="pending") { kotlinx.coroutines.delay(8_000); runCatching { Api.decode<RegInfo>(Api.get("/events/${e.id}/registration")) }.onSuccess { info=it } }
    }
    val i = info
    if (paying && i != null) {
        Column(Modifier.fillMaxSize().background(Brand.Black)) {
            TopBar(title = "Pay for your place", onBack = { paying = false })
            GivingPage(session, Purchase(e.id, e.title, i.setup.price, kind = "Event",
                after = "is reserved for you. Your ticket appears as soon as the finance team confirms your payment.", back = "Back to the event")) { paying = false; reload++ }
        }
        return
    }

    Box(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxWidth().height(460.dp).clipToBounds()) {
            AmbientGlow(e.imageUrl, Modifier.fillMaxSize(), blur = 70.dp, alpha = 0.8f)
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color(0x55000000), 1f to Brand.Black)))
        }
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding().padding(bottom = 40.dp)) {
            TopBar(title = "", onBack = onBack) {
                Icon(Icons.Rounded.Share, "Share", tint = Color.White, modifier = Modifier.size(42.dp).clip(CircleShape).clickable {
                    val text = "${e.title}\n${e.date} · ${e.time}\n${e.location}\n\nSee you there! Shekinah Sons Global\n${com.shekinahsons.globalapp.notify.OpenLink.uri("events",e.id)}"
                    context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), "Share event"))
                }.padding(10.dp))
            }
            Box(Modifier.padding(horizontal = 18.dp)) {
                AmbientGlow(e.imageUrl, Modifier.matchParentSize().outset(4.dp, drop = 16.dp), blur = 30.dp)
                FadeImage(e.imageUrl, Modifier.fillMaxWidth().aspectRatio(16 / 10f).clip(RoundedCornerShape(22.dp)), label = "EVENT")
            }
            Column(Modifier.padding(horizontal = 20.dp, vertical = 18.dp)) {
                Countdown(e)
                Text(e.title, style = Type.Display, color = Brand.White)
                Spacer(Modifier.height(14.dp))
                Column(Modifier.fillMaxWidth().glass(RoundedCornerShape(20.dp), 0.8f).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    InfoRow(Icons.Rounded.CalendarMonth, e.date)
                    if (e.time.isNotBlank()) InfoRow(Icons.Rounded.Schedule, e.time)
                    if (e.location.isNotBlank()) InfoRow(Icons.Rounded.Place, e.location)
                    if (i != null && i.setup.capacity > 0) InfoRow(Icons.Rounded.Groups, if (i.spotsLeft == 0) "Fully booked" else "${i.spotsLeft} of ${i.setup.capacity} places left")
                }
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    SmallAction(Icons.Rounded.EventAvailable, "Add to calendar") {
                        val start = date(e)?.atTime(runCatching { java.time.LocalTime.parse(e.time.uppercase(), java.time.format.DateTimeFormatter.ofPattern("h:mm a")) }.getOrDefault(java.time.LocalTime.of(9, 0)))
                        val intent = Intent(Intent.ACTION_INSERT).setData(CalendarContract.Events.CONTENT_URI)
                            .putExtra(CalendarContract.Events.TITLE, e.title).putExtra(CalendarContract.Events.EVENT_LOCATION, e.location)
                            .putExtra(CalendarContract.Events.DESCRIPTION, e.description)
                        start?.let { intent.putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, it.atZone(ZoneId.of("Africa/Nairobi")).toInstant().toEpochMilli()) }
                        runCatching { context.startActivity(intent) }
                    }
                }
                if (e.description.isNotBlank()) {
                    Spacer(Modifier.height(18.dp))
                    Text("About", style = Type.Title, color = Brand.White)
                    Spacer(Modifier.height(6.dp))
                    Text(e.description, style = Type.Body, color = Color(0xFFE0E0E4))
                }
                Spacer(Modifier.height(22.dp))
                ErrorNote(error)
                if (i == null) Box(Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Brand.Gold) }
                else Registration(e, i, session, editing, openProfile, submitting,
                    edit = { editing = it }, pay = { paying = true },
                    submit = { answers ->
                        scope.launch {
                            error = null; submitting = true
                            runCatching { Api.post("/events/${e.id}/register", mapOf("answers" to answers)) }
                                .onSuccess { editing = false; reload++; if (i.setup.price > 0 && i.mine.payment == "none") paying = true }
                                .onFailure { error = it.message }
                            submitting = false
                        }
                    },
                    cancel = {
                        scope.launch { runCatching { Api.delete("/events/${e.id}/register") }.onSuccess { reload++ }.onFailure { error = it.message } }
                    },
                )
            }
        }
    }
}

@Composable
private fun InfoRow(icon: androidx.compose.ui.graphics.vector.ImageVector, text: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(34.dp).clip(RoundedCornerShape(10.dp)).background(Color(0x22D4AF37)), contentAlignment = Alignment.Center) { Icon(icon, null, tint = Brand.Gold, modifier = Modifier.size(19.dp)) }
        Spacer(Modifier.width(12.dp))
        Text(text, color = Brand.White, fontFamily = Inter, fontSize = 15.sp)
    }
}

@Composable
private fun SmallAction(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, onClick: () -> Unit) {
    Row(Modifier.glass().clickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = Brand.GoldLight, modifier = Modifier.size(17.dp))
        Spacer(Modifier.width(6.dp))
        Text(label, color = Brand.White, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
    }
}

@Composable
private fun Registration(
    e: Event, i: RegInfo, session: Session, editing: Boolean, openProfile: () -> Unit, busy: Boolean,
    edit: (Boolean) -> Unit, pay: () -> Unit, submit: (Map<String, String>) -> Unit, cancel: () -> Unit,
) {
    val context = LocalContext.current
    val s = i.setup
    val mine = i.mine
    Text("Registration", style = Type.Title, color = Brand.White)
    Spacer(Modifier.height(10.dp))
    if(s.mode=="link" && s.price>0) Column(Modifier.fillMaxWidth().glass().padding(16.dp)) {
        Text("External registration form",style=Type.CardTitle,color=Brand.White)
        Text("Complete the external form separately. Your Shekinah ticket requires confirmed payment below; external responses are not synced.",style=Type.Body,color=Brand.Text2)
        GhostButton("Open form"){runCatching{context.startActivity(Intent(Intent.ACTION_VIEW,Uri.parse(s.formUrl)))}}
    }
    when {
        s.mode == "link" && s.price==0 -> Column(Modifier.fillMaxWidth().glass(RoundedCornerShape(20.dp), 0.8f).padding(16.dp)) {
            Text("Register with the event's form. It opens in your browser.", style = Type.Body, color = Brand.Text2)
            Spacer(Modifier.height(12.dp))
            Row(
                Modifier.fillMaxWidth().height(54.dp).clip(RoundedCornerShape(50)).background(Brand.GoldGradient)
                    .clickable { runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(s.formUrl))) } },
                horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Open registration form", color = Brand.Black, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                Spacer(Modifier.width(8.dp))
                Icon(Icons.AutoMirrored.Rounded.OpenInNew, null, tint = Brand.Black, modifier = Modifier.size(18.dp))
            }
        }
        s.mode == "none" && s.price == 0 -> Row(Modifier.fillMaxWidth().glass(RoundedCornerShape(20.dp), 0.8f).padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Rounded.CheckCircle, null, tint = Color(0xFF4ADE80))
            Spacer(Modifier.width(12.dp))
            Text("No registration needed. Just come, everyone is welcome!", style = Type.Body, color = Brand.White)
        }
        session.member == null -> SignInCard(if (s.price > 0) "Sign in to get your place at this event (${money(s.price)})." else "Sign in to register for this event.", openProfile)
        mine.registered && !editing && (s.price == 0 || mine.payment == "paid") -> Ticket(e, session, mine, canCancel = s.price == 0, edit = { edit(true) }, cancel = cancel, hasForm = s.fields.isNotEmpty())
        mine.registered && !editing && mine.payment == "pending" -> Row(Modifier.fillMaxWidth().glass(RoundedCornerShape(20.dp), 0.8f).padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Rounded.HourglassTop, null, tint = Brand.GoldLight)
            Spacer(Modifier.width(12.dp))
            Text("You're registered. Your payment is being confirmed, then your ticket appears here.", style = Type.Body, color = Brand.White)
        }
        mine.registered && !editing -> Column(Modifier.fillMaxWidth().glass(RoundedCornerShape(20.dp), 0.8f).padding(16.dp)) {
            Text("Your details are saved. Complete payment to get your ticket.", style = Type.Body, color = Brand.White)
            Spacer(Modifier.height(12.dp))
            GoldButton("Pay ${money(s.price)}", onClick = pay)
            Text("Change my details", color = Brand.GoldLight, fontSize = 13.5.sp, modifier = Modifier.padding(top = 10.dp).clickable { edit(true) })
        }
        i.spotsLeft == 0 && !mine.registered -> Text("This event is fully booked.", style = Type.Body, color = Brand.Text2)
        else -> RegistrationForm(s, mine, busy, submit, cancelEdit = if (editing) ({ edit(false) }) else null)
    }
}

@Composable
private fun RegistrationForm(s: RegSetup, mine: MyReg, busy: Boolean, submit: (Map<String, String>) -> Unit, cancelEdit: (() -> Unit)?) {
    val answers = remember { mutableStateMapOf<String, String>().apply { putAll(mine.answers) } }
    val missing = s.fields.any { it.required && answers[it.id].isNullOrBlank() }
    Column(Modifier.fillMaxWidth().glass(RoundedCornerShape(20.dp), 0.8f).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (s.fields.isEmpty()) Text("Reserve your place for this event.", style = Type.Body, color = Brand.Text2)
        s.fields.forEach { f ->
            val label = f.label.uppercase() + if (f.required) " *" else ""
            when (f.type) {
                "choice" -> Column {
                    Text(label, style = Type.Label.copy(fontSize = 10.5.sp), color = Brand.GoldLight, modifier = Modifier.padding(start = 4.dp, bottom = 6.dp))
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(f.options) { o ->
                            val on = answers[f.id] == o
                            Text(o, color = if (on) Brand.Black else Brand.White, fontWeight = FontWeight.SemiBold, fontSize = 13.5.sp,
                                modifier = (if (on) Modifier.clip(RoundedCornerShape(50)).background(Brand.GoldGradient) else Modifier.glass()).clickable { answers[f.id] = o }.padding(horizontal = 14.dp, vertical = 8.dp))
                        }
                    }
                }
                else -> Field(
                    label, answers[f.id].orEmpty(), { answers[f.id] = it.take(2000) },
                    keyboard = when (f.type) { "phone" -> KeyboardType.Phone; "email" -> KeyboardType.Email; "number" -> KeyboardType.Number; else -> KeyboardType.Text },
                    minHeight = if (f.type == "longtext") 100.dp else 52.dp, singleLine = f.type != "longtext",
                )
            }
        }
        GoldButton(if (s.price > 0 && mine.payment == "none") "Continue to payment · ${money(s.price)}" else if (mine.registered) "Save changes" else "Register", busy = busy, enabled = !missing) {
            submit(answers.toMap())
        }
        cancelEdit?.let { Text("Cancel", color = Brand.Text2, modifier = Modifier.align(Alignment.CenterHorizontally).clickable(onClick = it).padding(6.dp)) }
    }
}

// The ticket: shown at the entrance; the QR holds the event and ticket code.
@Composable
private fun Ticket(e: Event, session: Session, mine: MyReg, canCancel: Boolean, hasForm: Boolean, edit: () -> Unit, cancel: () -> Unit) {
    val qr = remember(mine.ticket) { qrBitmap("SSG-EVENT:${e.id}:${mine.ticket}").asImageBitmap() }
    var confirm by remember { mutableStateOf(false) }
    Column(
        Modifier.fillMaxWidth().lifted(RoundedCornerShape(24.dp), 18.dp, Brand.Gold).clip(RoundedCornerShape(24.dp))
            .background(Brush.linearGradient(listOf(Color(0xFF3A2C0A), Color(0xFF16130B)))).border(1.dp, Color(0x66D4AF37), RoundedCornerShape(24.dp)).padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Rounded.ConfirmationNumber, null, tint = Brand.Gold, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(8.dp))
            Text("YOU'RE REGISTERED", style = Type.Label, color = Brand.Gold)
        }
        Spacer(Modifier.height(6.dp))
        Text(session.member?.name.orEmpty(), style = Type.Title, color = Color.White)
        Text(e.title, style = Type.Meta, color = Brand.GoldLight)
        Spacer(Modifier.height(14.dp))
        Box(Modifier.size(190.dp).clip(RoundedCornerShape(16.dp)).background(Color.White).padding(10.dp)) {
            Image(qr, "Ticket code", Modifier.fillMaxSize())
        }
        Spacer(Modifier.height(10.dp))
        Text(mine.ticket, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 20.sp, letterSpacing = 4.sp)
        Text("Show this at the entrance", style = Type.Meta, color = Brand.Text2)
        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(18.dp)) {
            if (hasForm) Text("Edit my details", color = Brand.GoldLight, fontSize = 13.5.sp, modifier = Modifier.clickable(onClick = edit).padding(6.dp))
            if (canCancel) Text("Cancel registration", color = Brand.Text2, fontSize = 13.5.sp, modifier = Modifier.clickable { confirm = true }.padding(6.dp))
        }
    }
    if (confirm) androidx.compose.material3.AlertDialog(
        onDismissRequest = { confirm = false }, containerColor = Color(0xFF1C1C20),
        title = { Text("Cancel your registration?", color = Brand.White) },
        text = { Text("Your place goes to someone else.", color = Brand.Text2) },
        confirmButton = { androidx.compose.material3.TextButton({ confirm = false; cancel() }) { Text("Cancel it", color = Brand.Red) } },
        dismissButton = { androidx.compose.material3.TextButton({ confirm = false }) { Text("Keep it", color = Brand.Text2) } },
    )
}
