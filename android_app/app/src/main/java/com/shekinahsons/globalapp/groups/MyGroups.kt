package com.shekinahsons.globalapp.groups

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
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
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.admin.Badge
import com.shekinahsons.globalapp.admin.EmptyState
import com.shekinahsons.globalapp.admin.KitBlue
import com.shekinahsons.globalapp.admin.KitGreen
import com.shekinahsons.globalapp.admin.KitRow
import com.shekinahsons.globalapp.admin.KitViolet
import com.shekinahsons.globalapp.admin.Loading
import com.shekinahsons.globalapp.admin.PersonAvatar
import com.shekinahsons.globalapp.data.Api
import com.shekinahsons.globalapp.data.Session
import com.shekinahsons.globalapp.ui.components.ErrorNote
import com.shekinahsons.globalapp.ui.components.GoldButton
import com.shekinahsons.globalapp.ui.components.TopBar
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Type
import kotlinx.serialization.Serializable

@Serializable
data class MyGroup(val id: String = "", val name: String = "", val type: String = "", val role: String = "member", val schedule: String = "", val location: String = "",
                   val leaderName: String = "", val leaderPhone: String = "", val memberCount: Int = 0, val joinedAt: String = "") {
    val leads get() = role == "leader" || role == "assistant"
}

@Serializable
data class GroupPerson(val userId: String = "", val name: String = "", val phone: String = "", val email: String = "", val role: String = "member")

internal fun groupTint(type: String) = when (type) { "ministry" -> Brand.Gold; "department" -> KitBlue; "small_group" -> KitGreen; else -> KitViolet }
internal fun groupIcon(type: String): ImageVector = when (type) { "ministry" -> Icons.Rounded.VolunteerActivism; "department" -> Icons.Rounded.Apartment; "small_group" -> Icons.Rounded.Groups; else -> Icons.Rounded.ChildCare }
private val typeNames = mapOf("ministry" to "Ministry", "department" to "Department", "small_group" to "Small group", "sunday_school" to "Sunday school")

// The groups a member belongs to; leaders can open theirs to reach everyone.
@Composable
fun MyGroupsScreen(session: Session, openProfile: () -> Unit, onBack: () -> Unit) {
    val groups = remember { mutableStateListOf<MyGroup>() }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var open by remember { mutableStateOf<MyGroup?>(null) }
    LaunchedEffect(session.member?.id) {
        if (session.member == null) { loading = false; return@LaunchedEffect }
        runCatching { Api.decode<List<MyGroup>>(Api.get("/me/groups")["groups"]) }.onSuccess { groups.clear(); groups.addAll(it) }.onFailure { error = it.message }
        loading = false
    }
    BackHandler(enabled = open != null) { open = null }
    open?.let { g -> GroupRoster(g) { open = null }; return }
    Column(Modifier.fillMaxSize().background(Brand.Black)) {
        TopBar(title = "My groups", onBack = onBack)
        LazyColumn(contentPadding = PaddingValues(start = 18.dp, end = 18.dp, bottom = 120.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item { Text("The ministries, departments and cells you're part of.", style = Type.Meta.copy(fontSize = 13.5.sp), color = Brand.Text2) }
            if (session.member == null) item { Column(verticalArrangement = Arrangement.spacedBy(10.dp)) { EmptyState(Icons.Rounded.Groups, "Sign in to see your groups", "Your church groups appear here."); GoldButton("Sign in", onClick = openProfile) } }
            item { ErrorNote(error) }
            if (loading) item { Loading() }
            if (!loading && session.member != null && groups.isEmpty() && error == null) item {
                EmptyState(Icons.Rounded.Groups, "No groups yet", "When the church adds you to a group, it shows here.")
            }
            items(groups, key = { it.id }) { g -> GroupCard(g) { open = g } }
        }
    }
}

@Composable
private fun GroupCard(g: MyGroup, openRoster: () -> Unit) {
    val context = LocalContext.current
    val tint = groupTint(g.type)
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp))
            .background(Brush.linearGradient(listOf(tint.copy(alpha = 0.22f), Color(0xFF141418))))
            .border(1.dp, tint.copy(alpha = 0.3f), RoundedCornerShape(22.dp)).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(48.dp).clip(RoundedCornerShape(14.dp)).background(tint.copy(alpha = 0.18f)), contentAlignment = Alignment.Center) {
                Icon(groupIcon(g.type), null, tint = tint, modifier = Modifier.size(26.dp))
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(g.name, style = Type.Title, color = Brand.White)
                Text("${typeNames[g.type] ?: g.type} · ${g.memberCount} ${if (g.memberCount == 1) "person" else "people"}", style = Type.Meta, color = Brand.Text2)
            }
            Badge(when (g.role) { "leader" -> "LEADER"; "assistant" -> "ASSISTANT"; else -> "MEMBER" }, if (g.leads) Brand.Gold else Brand.Text2)
        }
        if (g.schedule.isNotBlank()) Info(Icons.Rounded.Schedule, g.schedule)
        if (g.location.isNotBlank()) Info(Icons.Rounded.Place, g.location)
        if (g.leaderName.isNotBlank() && g.role != "leader") Row(verticalAlignment = Alignment.CenterVertically) {
            Info(Icons.Rounded.Person, "Led by ${g.leaderName}", Modifier.weight(1f))
            if (g.leaderPhone.isNotBlank()) {
                Contact(Icons.Rounded.Call, "Call ${g.leaderName}") { context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${g.leaderPhone}"))) }
                Spacer(Modifier.width(8.dp))
                Contact(Icons.Rounded.Chat, "WhatsApp ${g.leaderName}") { runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/${g.leaderPhone.filter(Char::isDigit)}"))) } }
            }
        }
        if (g.leads) Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(50)).background(Brand.GoldGradient).clickable(onClick = openRoster).padding(vertical = 12.dp),
            horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Rounded.People, null, tint = Brand.Black, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(8.dp))
            Text("See everyone in ${g.name}", color = Brand.Black, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 14.sp)
        }
    }
}

@Composable
private fun Info(icon: ImageVector, text: String, modifier: Modifier = Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = Brand.GoldLight, modifier = Modifier.size(17.dp))
        Spacer(Modifier.width(8.dp))
        Text(text, color = Brand.White, fontFamily = Inter, fontSize = 14.sp)
    }
}

@Composable
private fun Contact(icon: ImageVector, label: String, onClick: () -> Unit) {
    Icon(icon, label, tint = KitGreen, modifier = Modifier.size(38.dp).clip(CircleShape).background(KitGreen.copy(alpha = 0.14f)).clickable(onClick = onClick).padding(9.dp))
}

// For leaders: everyone in the group, one tap to call or WhatsApp.
@Composable
private fun GroupRoster(g: MyGroup, back: () -> Unit) {
    val context = LocalContext.current
    val people = remember { mutableStateListOf<GroupPerson>() }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(g.id) {
        runCatching { Api.decode<List<GroupPerson>>(Api.get("/me/groups/${g.id}/members")["members"]) }.onSuccess { people.clear(); people.addAll(it) }.onFailure { error = it.message }
        loading = false
    }
    Column(Modifier.fillMaxSize().background(Brand.Black)) {
        TopBar(title = g.name, onBack = back)
        LazyColumn(contentPadding = PaddingValues(start = 18.dp, end = 18.dp, bottom = 120.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item { Text("${people.size} people · only leaders see this list", style = Type.Meta, color = Brand.Text2) }
            item { ErrorNote(error) }
            if (loading) item { Loading() }
            items(people, key = { it.userId }) { p ->
                KitRow(p.name, line1 = p.phone.ifBlank { p.email }, leading = { PersonAvatar(p.name, p.userId) }, trailing = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (p.role != "member") { Badge(p.role.uppercase(), Brand.Gold); Spacer(Modifier.width(6.dp)) }
                        if (p.phone.isNotBlank()) {
                            Contact(Icons.Rounded.Call, "Call ${p.name}") { context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${p.phone}"))) }
                            Spacer(Modifier.width(6.dp))
                            Contact(Icons.Rounded.Chat, "WhatsApp ${p.name}") { runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/${p.phone.filter(Char::isDigit)}"))) } }
                        }
                    }
                })
            }
        }
    }
}
