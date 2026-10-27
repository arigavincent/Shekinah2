package com.shekinahsons.globalapp.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.Reply
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.DoneAll
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.R
import com.shekinahsons.globalapp.data.Api
import com.shekinahsons.globalapp.data.Session
import com.shekinahsons.globalapp.ui.components.Avatar
import com.shekinahsons.globalapp.ui.components.GoldButton
import com.shekinahsons.globalapp.ui.components.glass
import com.shekinahsons.globalapp.ui.components.personColor
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Type
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Serializable
data class ChatQuote(val id: String = "", val displayName: String = "", val message: String = "")

@Serializable
data class ChatMessage(
    val id: String = "",
    val displayName: String = "",
    val message: String = "",
    val createdAt: String = "",
    val userId: String = "",
    val replyTo: ChatQuote? = null,
    // Local only: still on its way to the server.
    val sending: Boolean = false,
)

private val zone = ZoneId.systemDefault()
private fun ChatMessage.instant(): Instant = runCatching { Instant.parse(createdAt) }.getOrElse { Instant.now() }

private fun dayLabel(day: LocalDate): String {
    val today = LocalDate.now(zone)
    return when (day) {
        today -> "Today"
        today.minusDays(1) -> "Yesterday"
        else -> day.format(DateTimeFormatter.ofPattern(if (day.year == today.year) "EEEE, d MMMM" else "d MMMM yyyy"))
    }
}

// The church family group chat. Like a WhatsApp group: everyone's real
// name and colour, your messages on the right in gold, replies quote the
// message they answer, and new messages arrive every few seconds.
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ChatScreen(session: Session, onSignIn: () -> Unit, onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val messages = remember { mutableStateListOf<ChatMessage>() }
    var loaded by remember { mutableStateOf(false) }
    var draft by remember { mutableStateOf("") }
    var replying by remember { mutableStateOf<ChatMessage?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    val list = rememberLazyListState()
    val me = session.member

    suspend fun fetch(since: String?) {
        val path = if (since == null) "/community/messages?channel=global&order=desc" else "/community/messages?channel=global&order=asc&since=$since"
        val res = Api.get(path)
        val fresh = Api.decode<List<ChatMessage>>(res["messages"]).let { if (since == null) it.reversed() else it }
        val known = messages.map { it.id }.toSet()
        val add = fresh.filter { it.id !in known }
        if (add.isNotEmpty()) {
            // A message we sent comes back from the server: replace the local copy.
            messages.removeAll { m -> m.sending && add.any { it.userId == me?.id && it.message == m.message } }
            messages.addAll(add)
            messages.sortBy { it.instant() }
        }
    }

    LaunchedEffect(Unit) {
        runCatching { fetch(null) }.onFailure { error = it.message }
        loaded = true
        while (true) {
            delay(3_000)
            runCatching { fetch(messages.lastOrNull { !it.sending }?.createdAt) }
        }
    }
    // Keep the newest message in view as they arrive.
    LaunchedEffect(messages.size) { if (messages.isNotEmpty()) list.animateScrollToItem(0) }

    fun send() {
        val text = draft.trim()
        if (text.isEmpty() || me == null) return
        val quote = replying
        val local = ChatMessage("local-${System.nanoTime()}", me.name, text, Instant.now().toString(), me.id, quote?.let { ChatQuote(it.id, it.displayName, it.message) }, sending = true)
        messages.add(local)
        draft = ""; replying = null
        scope.launch {
            runCatching { Api.post("/community/messages", mapOf("channel" to "global", "message" to text, "replyTo" to (quote?.id ?: ""))) }
                .onSuccess { res ->
                    val saved = Api.decode<ChatMessage>(res["message"])
                    val i = messages.indexOfFirst { it.id == local.id }
                    if (i >= 0 && messages.none { it.id == saved.id }) messages[i] = saved else messages.remove(local)
                }
                .onFailure { messages.remove(local); draft = text; error = it.message }
        }
    }

    // Newest first in a reversed list, with a date chip where the day changes.
    val rows = remember(messages.toList()) {
        buildList<Any> {
            val ordered = messages.toList()
            ordered.forEachIndexed { i, m ->
                val day = m.instant().atZone(zone).toLocalDate()
                val prev = ordered.getOrNull(i - 1)
                if (prev == null || prev.instant().atZone(zone).toLocalDate() != day) add(dayLabel(day))
                add(m)
            }
        }.reversed()
    }

    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF0E0D0A), Color(0xFF07080B))))) {
        // Faint dove watermark, the way WhatsApp has its doodle wallpaper.
        Image(painterResource(R.drawable.dove_mark), null, Modifier.align(Alignment.Center).size(320.dp).graphicsLayer { alpha = 0.035f })
        Column(Modifier.fillMaxSize().imePadding()) {
            Row(
                Modifier.fillMaxWidth().background(Color(0xF2141416)).statusBarsPadding().height(64.dp).padding(horizontal = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(44.dp).clip(CircleShape).clickable(onClick = onBack), contentAlignment = Alignment.Center) {
                    Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back", tint = Brand.White)
                }
                Box(Modifier.size(42.dp).clip(CircleShape).background(Color(0xFF1F1A10)).border(1.dp, Color(0x55D4AF37), CircleShape), contentAlignment = Alignment.Center) {
                    Image(painterResource(R.drawable.dove_mark), null, Modifier.size(28.dp))
                }
                Spacer(Modifier.width(10.dp))
                Column(Modifier.weight(1f)) {
                    Text("Shekinah Family", fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 17.sp, color = Brand.White)
                    val people = messages.map { it.userId }.distinct().size
                    Text(if (people > 0) "$people people talking · names are visible to all" else "Community chat", style = Type.Meta, color = Brand.Text2, maxLines = 1)
                }
            }

            LazyColumn(
                state = list, reverseLayout = true, modifier = Modifier.weight(1f).fillMaxWidth(),
                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 12.dp),
            ) {
                items(rows, key = { if (it is ChatMessage) it.id else "day-$it" }) { row ->
                    when (row) {
                        is String -> Box(Modifier.fillMaxWidth().padding(vertical = 10.dp), contentAlignment = Alignment.Center) {
                            Text(row, color = Brand.Text2, fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 12.sp,
                                modifier = Modifier.glass(RoundedCornerShape(10.dp)).padding(horizontal = 12.dp, vertical = 5.dp))
                        }
                        is ChatMessage -> {
                            val index = messages.indexOfFirst { it.id == row.id }
                            val prev = messages.getOrNull(index - 1)
                            val firstOfRun = prev == null || prev.userId != row.userId || prev.instant().atZone(zone).toLocalDate() != row.instant().atZone(zone).toLocalDate()
                            Bubble(row, mine = row.userId == me?.id, firstOfRun = firstOfRun, onReply = { replying = row }, onCopy = { copy(context, row.message) })
                        }
                    }
                }
                if (loaded && messages.isEmpty()) item {
                    Text("Say hello to the family 👋", style = Type.Body, color = Brand.Muted, modifier = Modifier.fillMaxWidth().padding(40.dp))
                }
            }

            error?.let {
                Text(it, color = Color(0xFFFFB4AE), fontSize = 12.5.sp, modifier = Modifier.fillMaxWidth().background(Color(0x33E53935)).clickable { error = null }.padding(horizontal = 16.dp, vertical = 8.dp))
            }

            if (me == null) {
                Box(Modifier.fillMaxWidth().background(Color(0xF2141416)).navigationBarsPadding().padding(16.dp)) {
                    GoldButton("Sign in to join the conversation", onClick = onSignIn)
                }
            } else {
                Column(Modifier.fillMaxWidth().background(Color(0xF2141416)).navigationBarsPadding().padding(horizontal = 8.dp, vertical = 8.dp)) {
                    replying?.let { r ->
                        Row(
                            Modifier.fillMaxWidth().padding(bottom = 6.dp).clip(RoundedCornerShape(12.dp)).background(Color(0xFF1E1E22)),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(Modifier.width(4.dp).height(52.dp).background(personColor(r.displayName)))
                            Column(Modifier.weight(1f).padding(horizontal = 10.dp, vertical = 6.dp)) {
                                Text(if (r.userId == me.id) "You" else r.displayName, color = personColor(r.displayName), fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                                Text(r.message, style = Type.Meta, color = Brand.Text2, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                            Icon(Icons.Rounded.Close, "Cancel reply", tint = Brand.Text2, modifier = Modifier.padding(10.dp).size(20.dp).clickable { replying = null })
                        }
                    }
                    Row(verticalAlignment = Alignment.Bottom) {
                        Box(Modifier.weight(1f).heightIn(min = 48.dp).glass(RoundedCornerShape(24.dp), 0.9f).padding(horizontal = 18.dp, vertical = 13.dp)) {
                            if (draft.isEmpty()) Text("Message", style = Type.Body, color = Brand.Muted)
                            BasicTextField(draft, { draft = it.take(2000) }, textStyle = Type.Body.copy(color = Brand.White), cursorBrush = SolidColor(Brand.Gold), maxLines = 5, modifier = Modifier.fillMaxWidth())
                        }
                        Spacer(Modifier.width(8.dp))
                        Box(
                            Modifier.size(48.dp).clip(CircleShape).background(if (draft.isBlank()) SolidColor(Color(0x33D4AF37)) else Brand.GoldGradient).clickable(enabled = draft.isNotBlank()) { send() },
                            contentAlignment = Alignment.Center,
                        ) { Icon(Icons.AutoMirrored.Rounded.Send, "Send", tint = if (draft.isBlank()) Brand.Muted else Brand.Black, modifier = Modifier.size(22.dp)) }
                    }
                }
            }
        }
    }
}

private fun copy(context: Context, text: String) {
    context.getSystemService(ClipboardManager::class.java).setPrimaryClip(ClipData.newPlainText("message", text))
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun Bubble(m: ChatMessage, mine: Boolean, firstOfRun: Boolean, onReply: () -> Unit, onCopy: () -> Unit) {
    var menu by remember { mutableStateOf(false) }
    val time = m.instant().atZone(zone).format(DateTimeFormatter.ofPattern("HH:mm"))
    val shape = RoundedCornerShape(
        topStart = if (!mine && firstOfRun) 4.dp else 18.dp, topEnd = if (mine && firstOfRun) 4.dp else 18.dp, bottomStart = 18.dp, bottomEnd = 18.dp,
    )
    Row(
        Modifier.fillMaxWidth().padding(top = if (firstOfRun) 8.dp else 2.dp),
        horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start,
        verticalAlignment = Alignment.Top,
    ) {
        if (!mine) {
            if (firstOfRun) Avatar(m.displayName, m.displayName, 32.dp) else Spacer(Modifier.width(32.dp))
            Spacer(Modifier.width(6.dp))
        }
        Box {
            Column(
                Modifier.widthIn(max = 290.dp).clip(shape)
                    .background(if (mine) Brush.linearGradient(listOf(Color(0xFF4A3A12), Color(0xFF33290E))) else SolidColor(Color(0xFF1C1C20)))
                    .border(1.dp, if (mine) Color(0x40D4AF37) else Color(0x14FFFFFF), shape)
                    .combinedClickable(onClick = {}, onLongClick = { menu = true })
                    .padding(start = 11.dp, end = 11.dp, top = 7.dp, bottom = 6.dp),
            ) {
                if (!mine && firstOfRun) Text(m.displayName, color = personColor(m.displayName), fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                m.replyTo?.let { q ->
                    Row(Modifier.padding(top = 4.dp, bottom = 4.dp).clip(RoundedCornerShape(8.dp)).background(Color(0x33000000))) {
                        Box(Modifier.width(3.dp).height(42.dp).background(personColor(q.displayName)))
                        Column(Modifier.padding(horizontal = 8.dp, vertical = 4.dp)) {
                            Text(q.displayName, color = personColor(q.displayName), fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, maxLines = 1)
                            Text(q.message, color = Brand.Text2, fontSize = 12.5.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
                Text(m.message, color = Brand.White, fontFamily = Inter, fontSize = 15.sp, lineHeight = 21.sp)
                Row(Modifier.align(Alignment.End), verticalAlignment = Alignment.CenterVertically) {
                    Text(time, color = if (mine) Color(0xB3F0D27A) else Brand.Muted, fontSize = 11.sp)
                    if (mine) {
                        Spacer(Modifier.width(4.dp))
                        Icon(Icons.Rounded.DoneAll, if (m.sending) "Sending" else "Sent", tint = if (m.sending) Brand.Muted else Brand.BlueText, modifier = Modifier.size(15.dp))
                    }
                }
            }
            DropdownMenu(menu, onDismissRequest = { menu = false }, containerColor = Brand.Surface2) {
                DropdownMenuItem(text = { Text("Reply", color = Brand.White) }, leadingIcon = { Icon(Icons.AutoMirrored.Rounded.Reply, null, tint = Brand.Gold) }, onClick = { menu = false; onReply() })
                DropdownMenuItem(text = { Text("Copy", color = Brand.White) }, leadingIcon = { Icon(Icons.Rounded.ContentCopy, null, tint = Brand.Gold) }, onClick = { menu = false; onCopy() })
            }
        }
    }
}
