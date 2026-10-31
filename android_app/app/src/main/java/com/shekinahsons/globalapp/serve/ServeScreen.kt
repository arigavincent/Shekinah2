package com.shekinahsons.globalapp.serve

import android.content.Context
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
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.CameraAlt
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.ChildCare
import androidx.compose.material.icons.rounded.Groups
import androidx.compose.material.icons.rounded.HourglassTop
import androidx.compose.material.icons.rounded.LocalCafe
import androidx.compose.material.icons.rounded.MeetingRoom
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.Public
import androidx.compose.material.icons.rounded.VolunteerActivism
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.data.Api
import com.shekinahsons.globalapp.data.Session
import com.shekinahsons.globalapp.ui.components.ErrorNote
import com.shekinahsons.globalapp.ui.components.Field
import com.shekinahsons.globalapp.ui.components.GoldButton
import com.shekinahsons.globalapp.ui.components.SignInCard
import com.shekinahsons.globalapp.ui.components.TopBar
import com.shekinahsons.globalapp.ui.components.glass
import com.shekinahsons.globalapp.ui.components.lifted
import com.shekinahsons.globalapp.ui.components.pressable
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Scripture
import com.shekinahsons.globalapp.ui.theme.Type
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

@Serializable
data class ServeTeam(val id: String = "", val name: String = "", val description: String = "", val icon: String = "groups", val leaderName: String = "", val members: Int = 0)

// Each team's icon and colours.
private fun look(icon: String): Pair<ImageVector, List<Color>> = when (icon) {
    "music" -> Icons.Rounded.MusicNote to listOf(Color(0xFF8E5CF6), Color(0xFF3B1C80))
    "camera" -> Icons.Rounded.CameraAlt to listOf(Color(0xFF3B82F6), Color(0xFF12347A))
    "door" -> Icons.Rounded.MeetingRoom to listOf(Color(0xFFE9C23C), Color(0xFF7A5A0C))
    "child" -> Icons.Rounded.ChildCare to listOf(Color(0xFFF472B6), Color(0xFF7A1846))
    "youth" -> Icons.Rounded.Groups to listOf(Color(0xFF22C55E), Color(0xFF0E5A2B))
    "prayer" -> Icons.Rounded.VolunteerActivism to listOf(Color(0xFFF59E0B), Color(0xFF7A3E06))
    "outreach" -> Icons.Rounded.Public to listOf(Color(0xFF14B8A6), Color(0xFF0B4F49))
    "hospitality" -> Icons.Rounded.LocalCafe to listOf(Color(0xFFEF4444), Color(0xFF7A1414))
    else -> Icons.Rounded.Groups to listOf(Brand.Gold, Brand.GoldDeep)
}

private val times = listOf("Sundays", "1st service", "2nd service", "Midweek", "Events", "Flexible")

// Serve: the teams of the house; asking to join one goes to its leader.
@Composable
fun ServeScreen(session: Session, openProfile: () -> Unit, onBack: () -> Unit) {
    val teams = remember { mutableStateListOf<ServeTeam>() }
    val mine = remember { mutableStateMapOf<String, String>() }
    var open by remember { mutableStateOf<ServeTeam?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var reload by remember { mutableIntStateOf(0) }
    LaunchedEffect(reload, session.member) {
        runCatching { Api.get("/serve/teams") }.onSuccess { res ->
            teams.clear(); teams.addAll(Api.decode<List<ServeTeam>>(res["teams"]))
            mine.clear(); mine.putAll(Api.decode<Map<String, String>>(res["mine"]))
        }.onFailure { error = it.message }
        loading = false
    }
    BackHandler { if (open != null) open = null else onBack() }
    AnimatedContent(open, transitionSpec = { fadeIn() togetherWith fadeOut() }, label = "serve", modifier = Modifier.fillMaxSize().background(Brand.Black)) { t ->
        if (t != null) TeamPage(t, mine[t.id], session, openProfile, back = { open = null }) { reload++ }
        else LazyVerticalGrid(GridCells.Fixed(2), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 40.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item(span = { GridItemSpan(2) }) { TopBar(title = "Serve", onBack = onBack) }
            item(span = { GridItemSpan(2) }) {
                Box(Modifier.fillMaxWidth().lifted(RoundedCornerShape(24.dp), 16.dp, Brand.Gold).clip(RoundedCornerShape(24.dp))
                    .background(Brush.linearGradient(listOf(Color(0xFF3A2C0A), Color(0xFF15120B), Color(0xFF0B1630)))).border(1.dp, Color(0x44D4AF37), RoundedCornerShape(24.dp)).padding(20.dp)) {
                    Column {
                        Text("SERVE IN THE HOUSE", style = Type.Label, color = Brand.Gold)
                        Spacer(Modifier.height(6.dp))
                        Text("Every gift has a place", style = Type.Display, color = Color.White)
                        Spacer(Modifier.height(8.dp))
                        Text("“Each of you should use whatever gift you have received to serve others.” 1 Peter 4:10", fontFamily = Scripture, fontSize = 15.sp, lineHeight = 21.sp, color = Brand.GoldLight)
                        Spacer(Modifier.height(12.dp))
                        Text("Choose a team. Your request goes straight to its leader, who will call you.", style = Type.Meta, color = Brand.Text2)
                    }
                }
            }
            if (loading) item(span = { GridItemSpan(2) }) { Box(Modifier.fillMaxWidth().padding(30.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Brand.Gold) } }
            error?.let { item(span = { GridItemSpan(2) }) { ErrorNote(it) } }
            items(teams, key = { it.id }) { team -> TeamTile(team, mine[team.id]) { open = team } }
        }
    }
}

@Composable
private fun TeamTile(t: ServeTeam, status: String?, onClick: () -> Unit) {
    val (icon, colors) = look(t.icon)
    val shape = RoundedCornerShape(22.dp)
    Column(
        Modifier.fillMaxWidth().aspectRatio(0.78f).lifted(shape, 12.dp, colors.first().copy(alpha = 0.35f)).clip(shape)
            .background(Brush.verticalGradient(listOf(colors.last().copy(alpha = 0.55f), Color(0xFF121214))))
            .border(1.dp, colors.first().copy(alpha = 0.35f), shape).pressable(onClick).padding(14.dp),
    ) {
        Row(verticalAlignment = Alignment.Top) {
            Box(Modifier.size(46.dp).clip(RoundedCornerShape(14.dp)).background(Brush.linearGradient(colors)), contentAlignment = Alignment.Center) {
                Icon(icon, null, tint = Color.White, modifier = Modifier.size(26.dp))
            }
            Spacer(Modifier.weight(1f))
            status?.let { StatusChip(it) }
        }
        Spacer(Modifier.weight(1f))
        if (t.members > 0) {
            Text(if (t.members == 1) "1 serving" else "${t.members} serving", color = Color.White, fontSize = 10.5.sp, fontWeight = FontWeight.Bold,
                modifier = Modifier.clip(RoundedCornerShape(50)).background(colors.first().copy(alpha = 0.35f)).border(1.dp, colors.first().copy(alpha = 0.6f), RoundedCornerShape(50)).padding(horizontal = 8.dp, vertical = 3.dp))
            Spacer(Modifier.height(8.dp))
        }
        Text(t.name, color = Color.White, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 18.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
        Spacer(Modifier.height(4.dp))
        Text(t.description, style = Type.Meta.copy(fontSize = 12.sp, lineHeight = 16.sp), color = Color(0xCCFFFFFF), maxLines = 3, overflow = TextOverflow.Ellipsis)
        if (t.leaderName.isNotBlank()) {
            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Rounded.Person, null, tint = colors.first(), modifier = Modifier.size(14.dp))
                Text(" Led by ${t.leaderName}", color = Color(0xE6FFFFFF), fontSize = 11.5.sp, fontWeight = FontWeight.Medium, maxLines = 1)
            }
        }
    }
}

@Composable
private fun StatusChip(status: String) {
    val (label, bg) = when (status) {
        "placed" -> "On the team" to Color(0xFF1E7A4E)
        "contacted" -> "In touch" to Brand.Blue
        "declined" -> "Not now" to Color(0x55FFFFFF)
        else -> "Requested" to Color(0xCC6B5310)
    }
    Text(label, color = Color.White, fontSize = 10.5.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clip(RoundedCornerShape(50)).background(bg).padding(horizontal = 8.dp, vertical = 3.dp))
}

@Composable
private fun TeamPage(t: ServeTeam, status: String?, session: Session, openProfile: () -> Unit, back: () -> Unit, sent: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val prefs = remember { context.getSharedPreferences("giving", Context.MODE_PRIVATE) }
    val (icon, colors) = look(t.icon)
    var phone by remember { mutableStateOf(prefs.getString("phone", "") ?: "") }
    val picked = remember { mutableStateListOf<String>() }
    var message by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var done by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding()) {
        Box(Modifier.fillMaxWidth().height(250.dp).background(Brush.verticalGradient(listOf(colors.last(), Brand.Black)))) {
            Icon(icon, null, tint = Color.White, modifier = Modifier.align(Alignment.CenterEnd).padding(end = 20.dp).size(150.dp).graphicsLayer { alpha = 0.12f })
            Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back", tint = Color.White, modifier = Modifier.padding(top = 40.dp, start = 12.dp).size(44.dp).clip(CircleShape).background(Color(0x33000000)).clickable(onClick = back).padding(10.dp))
            Column(Modifier.align(Alignment.BottomStart).padding(20.dp)) {
                Box(Modifier.size(56.dp).clip(RoundedCornerShape(16.dp)).background(Brush.linearGradient(colors)), contentAlignment = Alignment.Center) {
                    Icon(icon, null, tint = Color.White, modifier = Modifier.size(30.dp))
                }
                Spacer(Modifier.height(10.dp))
                Text(t.name, style = Type.Display, color = Color.White)
                if (t.leaderName.isNotBlank()) Text("Led by ${t.leaderName}" + if (t.members > 0) " · ${t.members} serving" else "", style = Type.Meta, color = Color(0xCCFFFFFF))
            }
        }
        Column(Modifier.padding(horizontal = 20.dp)) {
            Text(t.description, style = Type.Body, color = Color(0xFFE0E0E4))
            Spacer(Modifier.height(22.dp))
            when {
                done -> Column(Modifier.fillMaxWidth().glass(RoundedCornerShape(22.dp), 0.85f).padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Rounded.CheckCircle, null, tint = Color(0xFF4ADE80), modifier = Modifier.size(48.dp))
                    Spacer(Modifier.height(10.dp))
                    Text("Request sent", style = Type.Title, color = Color.White)
                    Text((if (t.leaderName.isNotBlank()) t.leaderName else "The team leader") + " has your details and will call you soon. Thank you for offering to serve!",
                        style = Type.Body, color = Brand.Text2, modifier = Modifier.padding(top = 6.dp))
                }
                status != null && status != "declined" -> Row(Modifier.fillMaxWidth().glass(RoundedCornerShape(20.dp), 0.85f).padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(if (status == "placed") Icons.Rounded.CheckCircle else Icons.Rounded.HourglassTop, null, tint = if (status == "placed") Color(0xFF4ADE80) else Brand.GoldLight)
                    Spacer(Modifier.width(12.dp))
                    Text(when (status) { "placed" -> "You're on the ${t.name} team. Welcome!"; "contacted" -> "The team leader has been in touch with you."; else -> "Your request was sent. The team leader will call you." },
                        style = Type.Body, color = Color.White)
                }
                session.member == null -> SignInCard("Sign in to ask to serve with ${t.name}; the leader will see who you are.", openProfile)
                else -> Column(Modifier.fillMaxWidth().glass(RoundedCornerShape(22.dp), 0.85f).padding(16.dp)) {
                    Text("Join ${t.name}", style = Type.Title, color = Color.White)
                    Text("Your name and email go with this: ${session.member?.name}, ${session.member?.email}", style = Type.Meta, color = Brand.Text2)
                    Spacer(Modifier.height(14.dp))
                    Field("PHONE", phone, { phone = it.take(20) }, hint = "07XX XXX XXX", keyboard = KeyboardType.Phone)
                    Spacer(Modifier.height(12.dp))
                    Text("WHEN CAN YOU SERVE?", style = Type.Label.copy(fontSize = 10.5.sp), color = Brand.GoldLight, modifier = Modifier.padding(start = 4.dp, bottom = 6.dp))
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(times) { x ->
                            val on = x in picked
                            Text(x, color = if (on) Brand.Black else Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                                modifier = (if (on) Modifier.clip(RoundedCornerShape(50)).background(Brush.linearGradient(colors.map { it.copy(alpha = 1f) })) else Modifier.glass())
                                    .clickable { if (on) picked.remove(x) else picked.add(x) }.padding(horizontal = 14.dp, vertical = 8.dp))
                        }
                    }
                    Spacer(Modifier.height(12.dp))
                    Field("ANYTHING YOU'D LIKE THEM TO KNOW", message, { message = it.take(1500) }, hint = "Experience, skills, questions", minHeight = 100.dp, singleLine = false)
                    ErrorNote(error)
                    Spacer(Modifier.height(14.dp))
                    GoldButton("Send my request", busy = busy, enabled = phone.filter(Char::isDigit).length >= 9) {
                        scope.launch {
                            busy = true; error = null
                            prefs.edit().putString("phone", phone).apply()
                            runCatching { Api.post("/serve/requests", mapOf("teamId" to t.id, "phone" to phone, "availability" to picked.joinToString(", "), "message" to message)) }
                                .onSuccess { done = true; sent() }.onFailure { error = it.message }
                            busy = false
                        }
                    }
                }
            }
            Spacer(Modifier.height(40.dp))
        }
    }
}
