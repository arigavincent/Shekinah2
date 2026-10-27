package com.shekinahsons.globalapp.live

import android.Manifest
import android.app.Activity
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.view.ViewGroup
import android.view.WindowManager
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
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
import androidx.compose.foundation.layout.aspectRatio
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
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.rounded.Block
import androidx.compose.material.icons.rounded.Cameraswitch
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Fullscreen
import androidx.compose.material.icons.rounded.Mic
import androidx.compose.material.icons.rounded.MicOff
import androidx.compose.material.icons.rounded.PushPin
import androidx.compose.material.icons.rounded.RemoveRedEye
import androidx.compose.material.icons.rounded.Shield
import androidx.compose.material.icons.rounded.Tune
import androidx.compose.material.icons.rounded.VisibilityOff
import androidx.compose.material.icons.rounded.VolumeOff
import androidx.compose.material.icons.rounded.VolumeUp
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.pedro.common.ConnectChecker
import com.pedro.encoder.input.video.CameraHelper
import com.pedro.library.rtmp.RtmpCamera2
import com.pedro.library.view.OpenGlView
import com.shekinahsons.globalapp.R
import com.shekinahsons.globalapp.data.Api
import com.shekinahsons.globalapp.data.HomeContent
import com.shekinahsons.globalapp.data.Session
import com.shekinahsons.globalapp.extras.ServiceReminder
import com.shekinahsons.globalapp.ui.components.Avatar
import com.shekinahsons.globalapp.ui.components.Breathing
import com.shekinahsons.globalapp.ui.components.ColorGlow
import com.shekinahsons.globalapp.ui.components.Field
import com.shekinahsons.globalapp.ui.components.GoldButton
import com.shekinahsons.globalapp.ui.components.NavBarHeight
import com.shekinahsons.globalapp.ui.components.PulsingDot
import com.shekinahsons.globalapp.ui.components.TopBar
import com.shekinahsons.globalapp.ui.components.glass
import com.shekinahsons.globalapp.ui.components.lifted
import com.shekinahsons.globalapp.ui.components.outset
import com.shekinahsons.globalapp.ui.components.personColor
import com.shekinahsons.globalapp.ui.screens.ChatMessage
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Type
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import java.time.Instant
import java.util.UUID

@Serializable
data class LiveSession(
    val id: String = "", val title: String = "", val status: String = "", val broadcaster: String = "",
    val startedAt: String? = null, val playbackUrl: String = "", val viewers: Int = 0,
)

// A low-latency player for the live HLS stream.
@Composable
fun rememberLivePlayer(url: String, muted: Boolean): ExoPlayer {
    val context = LocalContext.current
    val player = remember(url) {
        ExoPlayer.Builder(context).build().apply {
            setMediaItem(MediaItem.Builder().setUri(url).setMimeType(MimeTypes.APPLICATION_M3U8)
                .setLiveConfiguration(MediaItem.LiveConfiguration.Builder().setTargetOffsetMs(2500).build()).build())
            prepare()
            playWhenReady = true
        }
    }
    LaunchedEffect(muted) { player.volume = if (muted) 0f else 1f }
    DisposableEffect(player) { onDispose { player.release() } }
    return player
}

@Composable
fun LivePicture(player: ExoPlayer, modifier: Modifier, fill: Boolean = true) {
    var ready by remember { mutableStateOf(false) }
    DisposableEffect(player) {
        val l = object : Player.Listener { override fun onRenderedFirstFrame() { ready = true } }
        player.addListener(l)
        onDispose { player.removeListener(l) }
    }
    Box(modifier.background(Color.Black)) {
        AndroidView(
            factory = { ctx ->
                PlayerView(ctx).apply {
                    this.player = player
                    useController = false
                    resizeMode = if (fill) AspectRatioFrameLayout.RESIZE_MODE_ZOOM else AspectRatioFrameLayout.RESIZE_MODE_FIT
                    layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
                    setShutterBackgroundColor(android.graphics.Color.BLACK)
                }
            },
            update = { it.resizeMode = if (fill) AspectRatioFrameLayout.RESIZE_MODE_ZOOM else AspectRatioFrameLayout.RESIZE_MODE_FIT },
            modifier = Modifier.fillMaxSize(),
        )
        if (!ready) CircularProgressIndicator(color = Brand.Red, strokeWidth = 2.dp, modifier = Modifier.align(Alignment.Center).size(30.dp))
    }
}

@Composable
fun LiveBadgeRow(viewers: Int, modifier: Modifier = Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        Row(Modifier.clip(RoundedCornerShape(6.dp)).background(Brand.Red).padding(horizontal = 8.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            PulsingDot(); Spacer(Modifier.width(6.dp)); Text("LIVE", style = Type.Label, color = Color.White)
        }
        Spacer(Modifier.width(6.dp))
        Row(Modifier.clip(RoundedCornerShape(6.dp)).background(Color(0x99000000)).padding(horizontal = 8.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Rounded.RemoveRedEye, null, tint = Color.White, modifier = Modifier.size(13.dp))
            Spacer(Modifier.width(4.dp))
            Text("$viewers", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

// Home's "on air" card: the actual live picture, silent, with a red glow.
@Composable
fun HomeLivePreview(content: HomeContent, onOpen: () -> Unit) {
    val url = content.live.playbackHlsUrl
    if (url.isBlank()) return
    val player = rememberLivePlayer(url, muted = true)
    val glow = Breathing()
    val shape = RoundedCornerShape(20.dp)
    Column(Modifier.padding(horizontal = 16.dp).padding(top = 22.dp)) {
        Box {
            ColorGlow(Brand.Red.copy(alpha = 0.8f * glow), Modifier.matchParentSize().outset(4.dp, drop = 8.dp), blur = 30.dp)
            Box(Modifier.fillMaxWidth().aspectRatio(16 / 9f).clip(shape).border(1.dp, Brand.Red.copy(alpha = 0.6f), shape).clickable(onClick = onOpen)) {
                LivePicture(player, Modifier.fillMaxSize())
                Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color(0x88000000), 0.35f to Color.Transparent, 0.65f to Color.Transparent, 1f to Color(0xE6000000))))
                LiveBadgeRow(content.live.viewers.toIntOrNull() ?: 0, Modifier.align(Alignment.TopStart).padding(12.dp))
                Icon(Icons.Rounded.VolumeOff, "Muted", tint = Color.White, modifier = Modifier.align(Alignment.TopEnd).padding(12.dp).size(30.dp).glass(CircleShape).padding(6.dp))
                Row(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(content.live.title.ifBlank { "Live Service" }, style = Type.Title, color = Color.White, maxLines = 1)
                        Text("Tap to watch with sound and join the chat", style = Type.Meta, color = Color(0xCCFFFFFF))
                    }
                    Text("Join", color = Brand.Black, fontWeight = FontWeight.Bold, fontSize = 14.sp,
                        modifier = Modifier.clip(RoundedCornerShape(50)).background(Brand.GoldGradient).padding(horizontal = 18.dp, vertical = 9.dp))
                }
            }
        }
    }
}

// The Live tab: the service and its chat while on air; otherwise the next
// service, and a Go Live button for members allowed to broadcast.
@Composable
fun LiveTab(content: HomeContent, session: Session, openGoLive: () -> Unit, openProfile: () -> Unit) {
    if (content.live.isLive && content.live.playbackHlsUrl.isNotBlank()) LiveWatch(content, session, openProfile)
    else LiveOffline(content, session, openGoLive)
}

@Composable
private fun LiveOffline(content: HomeContent, session: Session, openGoLive: () -> Unit) {
    val glow = Breathing(3600, 0.45f, 1f)
    val start = remember(content.live.nextService) { ServiceReminder.nextStart(content.live.nextService) }
    Column(Modifier.fillMaxSize().background(Brand.Black)) {
        TopBar()
        Column(Modifier.padding(horizontal = 20.dp)) {
            Text("Live", style = Type.Display, color = Brand.White)
            Text("Services stream here, with chat for the whole family.", style = Type.Meta.copy(fontSize = 13.5.sp), color = Brand.Text2)
        }
        Spacer(Modifier.height(22.dp))
        Box(Modifier.padding(horizontal = 20.dp)) {
            ColorGlow(Brand.Gold.copy(alpha = 0.4f * glow), Modifier.matchParentSize().padding(10.dp), blur = 40.dp)
            Column(
                Modifier.fillMaxWidth().aspectRatio(16 / 10f).clip(RoundedCornerShape(22.dp))
                    .background(Brush.linearGradient(listOf(Color(0xFF2A1F07), Color(0xFF0B0B0D), Color(0xFF0B1630))))
                    .border(1.dp, Brand.Gold.copy(alpha = 0.35f), RoundedCornerShape(22.dp)).padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center,
            ) {
                Image(painterResource(R.drawable.dove_mark), null, Modifier.size(54.dp))
                Spacer(Modifier.height(10.dp))
                Text("NEXT SERVICE", style = Type.Label, color = Brand.Gold)
                Spacer(Modifier.height(6.dp))
                Text(content.live.nextService.ifBlank { "Sunday Service" }, style = Type.Display, color = Brand.White, textAlign = TextAlign.Center)
                if (start != null) Text(ServiceReminder.countdown(start), style = Type.Meta, color = Brand.Text2)
                Spacer(Modifier.height(8.dp))
                Text("You'll get a notification the moment we go live.", style = Type.Meta.copy(fontSize = 13.sp), color = Brand.Text2, textAlign = TextAlign.Center)
            }
        }
        if (session.canBroadcast) {
            Spacer(Modifier.height(24.dp))
            Box(Modifier.padding(horizontal = 20.dp)) {
                Row(
                    Modifier.fillMaxWidth().height(62.dp).lifted(RoundedCornerShape(50), 18.dp, Brand.Red).clip(RoundedCornerShape(50))
                        .background(Brush.horizontalGradient(listOf(Color(0xFFFF5A4E), Color(0xFFD7263D)))).clickable(onClick = openGoLive),
                    horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
                ) {
                    PulsingDot(Color.White, 9.dp); Spacer(Modifier.width(10.dp))
                    Text("Go Live", color = Color.White, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                }
            }
            Text("You're allowed to broadcast. Everyone gets notified when you go live.", style = Type.Meta, color = Brand.Muted,
                textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(horizontal = 30.dp, vertical = 10.dp))
        }
    }
}

private fun viewerId(context: android.content.Context): String {
    val p = context.getSharedPreferences("live", android.content.Context.MODE_PRIVATE)
    return p.getString("viewer", null) ?: UUID.randomUUID().toString().also { p.edit().putString("viewer", it).apply() }
}

@Composable
private fun LiveWatch(content: HomeContent, session: Session, openProfile: () -> Unit) {
    val context = LocalContext.current
    val activity = context as Activity
    val player = rememberLivePlayer(content.live.playbackHlsUrl, muted = false)
    val chat = remember { LiveChat() }
    var viewers by remember { mutableIntStateOf(content.live.viewers.toIntOrNull() ?: 0) }
    var fullscreen by remember { mutableStateOf(false) }
    DisposableEffect(Unit) { chat.start(); onDispose { chat.stop() } }
    // Count this phone as watching.
    LaunchedEffect(Unit) {
        val id = viewerId(context)
        while (true) {
            runCatching { viewers = Api.post("/live/heartbeat", mapOf("viewerId" to id))["viewers"].toString().toIntOrNull() ?: viewers }
            delay(15_000)
        }
    }
    DisposableEffect(fullscreen) {
        val insets = WindowInsetsControllerCompat(activity.window, activity.window.decorView)
        if (fullscreen) {
            activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
            insets.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            insets.hide(WindowInsetsCompat.Type.systemBars())
        } else {
            activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            insets.show(WindowInsetsCompat.Type.systemBars())
        }
        onDispose { activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED; insets.show(WindowInsetsCompat.Type.systemBars()) }
    }
    BackHandler(enabled = fullscreen) { fullscreen = false }

    if (fullscreen) {
        // Full screen: the picture, with the latest comments floating over it.
        Box(Modifier.fillMaxSize().background(Color.Black)) {
            LivePicture(player, Modifier.fillMaxSize(), fill = false)
            LiveBadgeRow(viewers, Modifier.align(Alignment.TopStart).statusBarsPadding().padding(16.dp))
            Icon(Icons.Rounded.Close, "Exit full screen", tint = Color.White, modifier = Modifier.align(Alignment.TopEnd).padding(16.dp).size(40.dp).glass(CircleShape).clickable { fullscreen = false }.padding(8.dp))
            FloatingComments(chat, Modifier.align(Alignment.BottomStart).padding(16.dp).widthIn(max = 360.dp))
        }
        return
    }

    Column(Modifier.fillMaxSize().background(Brand.Black).imePadding()) {
        Box(Modifier.fillMaxWidth().statusBarsPadding().aspectRatio(16 / 9f)) {
            LivePicture(player, Modifier.fillMaxSize(), fill = false)
            LiveBadgeRow(viewers, Modifier.align(Alignment.TopStart).padding(12.dp))
            Icon(Icons.Rounded.Fullscreen, "Full screen", tint = Color.White, modifier = Modifier.align(Alignment.BottomEnd).padding(10.dp).size(38.dp).glass(CircleShape).clickable { fullscreen = true }.padding(7.dp))
        }
        Column(Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
            Text(content.live.title.ifBlank { "Live Service" }, style = Type.Title, color = Brand.White, maxLines = 2)
            Text("Shekinah Sons Global · $viewers watching", style = Type.Meta, color = Brand.Text2)
        }
        LiveChatPanel(chat, session, openProfile, Modifier.weight(1f).navigationBarsPadding().padding(bottom = NavBarHeight + 6.dp))
    }
}

// Comments float up over the picture in full screen, like YouTube/Instagram live.
@Composable
private fun FloatingComments(chat: LiveChat, modifier: Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        chat.pinned?.let { p -> CommentPill(p, pinned = true) }
        chat.messages.takeLast(5).forEach { m -> CommentPill(m) }
    }
}

@Composable
private fun CommentPill(m: ChatMessage, pinned: Boolean = false) {
    Row(Modifier.clip(RoundedCornerShape(16.dp)).background(if (pinned) Color(0xCC3A2C0A) else Color(0x99000000)).padding(horizontal = 10.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        if (pinned) { Icon(Icons.Rounded.PushPin, null, tint = Brand.Gold, modifier = Modifier.size(13.dp)); Spacer(Modifier.width(5.dp)) }
        Text(m.displayName, color = personColor(m.displayName), fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
        Spacer(Modifier.width(6.dp))
        Text(m.message, color = Color.White, fontSize = 13.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun LiveChatPanel(chat: LiveChat, session: Session, openProfile: () -> Unit, modifier: Modifier = Modifier, compact: Boolean = false) {
    val scope = rememberCoroutineScope()
    val list = rememberLazyListState()
    var draft by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var settings by remember { mutableStateOf(false) }
    val me = session.member
    LaunchedEffect(chat.messages.size) { if (chat.messages.isNotEmpty()) list.animateScrollToItem(chat.messages.size - 1) }

    fun send() {
        val text = draft.trim()
        if (text.isEmpty() || me == null) return
        val local = ChatMessage("local-${System.nanoTime()}", me.name, text, Instant.now().toString(), me.id, sending = true)
        chat.addLocal(local); draft = ""
        scope.launch {
            runCatching { Api.post("/community/messages", mapOf("channel" to "live", "message" to text)) }
                .onSuccess { chat.replace(local.id, Api.decode(it["message"])) }
                .onFailure { chat.remove(local.id); draft = text; error = it.message }
        }
    }

    Column(modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Live chat", style = Type.CardTitle, color = Brand.White, modifier = Modifier.weight(1f))
            if (session.canModerate) {
                Row(Modifier.glass().clickable { settings = true }.padding(horizontal = 10.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.Shield, null, tint = Brand.Gold, modifier = Modifier.size(15.dp)); Spacer(Modifier.width(5.dp))
                    Text("Moderate", color = Brand.White, fontSize = 12.5.sp)
                }
            }
        }
        chat.pinned?.let { p ->
            Row(Modifier.padding(horizontal = 12.dp).fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Brush.horizontalGradient(listOf(Color(0xFF3A2C0A), Color(0xFF1A1813)))).border(1.dp, Color(0x55D4AF37), RoundedCornerShape(14.dp)).padding(10.dp), verticalAlignment = Alignment.Top) {
                Icon(Icons.Rounded.PushPin, "Pinned", tint = Brand.Gold, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(8.dp))
                Column(Modifier.weight(1f)) {
                    Text(p.displayName, color = Brand.GoldLight, fontWeight = FontWeight.SemiBold, fontSize = 12.5.sp)
                    Text(p.message, color = Brand.White, fontSize = 14.sp)
                }
                if (session.canModerate) Icon(Icons.Rounded.Close, "Unpin", tint = Brand.Text2, modifier = Modifier.size(18.dp).clickable { scope.launch { runCatching { LiveModeration.pin(p.id, false) } } })
            }
        }
        LazyColumn(state = list, modifier = Modifier.weight(1f).fillMaxWidth(), contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (chat.messages.isEmpty()) item { Text("Say hello to everyone watching 👋", style = Type.Meta, color = Brand.Muted, modifier = Modifier.padding(8.dp)) }
            items(chat.messages, key = { it.id }) { m -> LiveComment(m, session, scope) }
        }
        error?.let { Text(it, color = Color(0xFFFFB4AE), fontSize = 12.5.sp, modifier = Modifier.fillMaxWidth().background(Color(0x33E53935)).clickable { error = null }.padding(horizontal = 16.dp, vertical = 8.dp)) }
        if (me == null) {
            Box(Modifier.padding(12.dp)) { GoldButton("Sign in to comment", onClick = openProfile) }
        } else {
            Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Avatar(me.name, me.name, 34.dp)
                Spacer(Modifier.width(8.dp))
                Box(Modifier.weight(1f).heightIn(min = 46.dp).glass(RoundedCornerShape(23.dp), 0.9f).padding(horizontal = 16.dp, vertical = 12.dp)) {
                    if (draft.isEmpty()) Text("Say something…", style = Type.Body, color = Brand.Muted)
                    BasicTextField(draft, { draft = it.take(500) }, textStyle = Type.Body.copy(color = Brand.White), cursorBrush = SolidColor(Brand.Gold), maxLines = 3, modifier = Modifier.fillMaxWidth())
                }
                Spacer(Modifier.width(8.dp))
                Box(Modifier.size(46.dp).clip(CircleShape).background(if (draft.isBlank()) SolidColor(Color(0x33D4AF37)) else Brand.GoldGradient).clickable(enabled = draft.isNotBlank()) { send() }, contentAlignment = Alignment.Center) {
                    Icon(Icons.AutoMirrored.Rounded.Send, "Send", tint = if (draft.isBlank()) Brand.Muted else Brand.Black, modifier = Modifier.size(20.dp))
                }
            }
        }
    }
    if (settings) ModeratorSettings { settings = false }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun LiveComment(m: ChatMessage, session: Session, scope: kotlinx.coroutines.CoroutineScope) {
    var menu by remember { mutableStateOf(false) }
    Box {
        Row(Modifier.fillMaxWidth().combinedClickable(onClick = {}, onLongClick = { if (session.canModerate && !m.sending) menu = true }), verticalAlignment = Alignment.Top) {
            Avatar(m.displayName, m.displayName, 30.dp)
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(m.displayName, color = if (m.badge.isNotBlank()) Brand.GoldLight else Brand.Text2, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                    if (m.badge.isNotBlank()) {
                        Spacer(Modifier.width(6.dp))
                        Text(if (m.badge == "host") "HOST" else "MODERATOR", color = Brand.Black, fontWeight = FontWeight.Bold, fontSize = 9.5.sp, letterSpacing = 0.6.sp,
                            modifier = Modifier.clip(RoundedCornerShape(4.dp)).background(if (m.badge == "host") SolidColor(Brand.Red) else Brand.GoldGradient).padding(horizontal = 5.dp, vertical = 1.dp))
                    }
                }
                Text(m.message, color = if (m.sending) Brand.Text2 else Brand.White, fontSize = 14.5.sp, lineHeight = 20.sp)
            }
        }
        DropdownMenu(menu, { menu = false }, containerColor = Brand.Surface2) {
            DropdownMenuItem(text = { Text("Pin comment", color = Brand.White) }, leadingIcon = { Icon(Icons.Rounded.PushPin, null, tint = Brand.Gold) }, onClick = { menu = false; scope.launch { runCatching { LiveModeration.pin(m.id, true) } } })
            DropdownMenuItem(text = { Text("Remove comment", color = Brand.White) }, leadingIcon = { Icon(Icons.Rounded.VisibilityOff, null, tint = Brand.Gold) }, onClick = { menu = false; scope.launch { runCatching { LiveModeration.hide(m.id) } } })
            if (m.badge.isBlank()) DropdownMenuItem(text = { Text("Block ${m.displayName.split(" ").first()} from chat", color = Color(0xFFFF8A80)) }, leadingIcon = { Icon(Icons.Rounded.Block, null, tint = Color(0xFFFF8A80)) }, onClick = { menu = false; scope.launch { runCatching { LiveModeration.block(m.userId) } } })
        }
    }
}

@Serializable
private data class ChatRules(val slowModeSeconds: Int = 0, val bannedWords: List<String> = emptyList())

@Composable
private fun ModeratorSettings(close: () -> Unit) {
    val scope = rememberCoroutineScope()
    var slow by remember { mutableIntStateOf(0) }
    var words by remember { mutableStateOf("") }
    LaunchedEffect(Unit) {
        runCatching { Api.decode<ChatRules>(Api.get("/live/chat/settings")["settings"]) }.onSuccess { slow = it.slowModeSeconds; words = it.bannedWords.joinToString(", ") }
    }
    AlertDialog(
        onDismissRequest = close, containerColor = Color(0xFF1C1C20),
        icon = { Icon(Icons.Rounded.Tune, null, tint = Brand.Gold) },
        title = { Text("Chat controls", color = Brand.White) },
        text = {
            Column {
                Text("Slow mode", color = Brand.GoldLight, fontWeight = FontWeight.SemiBold)
                Row(Modifier.padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf(0 to "Off", 10 to "10s", 30 to "30s", 60 to "1 min").forEach { (v, label) ->
                        Text(label, color = if (slow == v) Brand.Black else Brand.White, fontSize = 13.sp,
                            modifier = (if (slow == v) Modifier.clip(RoundedCornerShape(50)).background(Brand.GoldGradient) else Modifier.glass()).clickable { slow = v }.padding(horizontal = 12.dp, vertical = 6.dp))
                    }
                }
                Field("WORDS TO BLOCK (COMMA SEPARATED)", words, { words = it }, minHeight = 80.dp, singleLine = false)
                Text("Comments with these words aren't posted. Long-press any comment to pin, remove it, or block the person.", style = Type.Meta, color = Brand.Text2, modifier = Modifier.padding(top = 8.dp))
            }
        },
        confirmButton = {
            TextButton({
                scope.launch {
                    runCatching { Api.put("/live/chat/settings", mapOf("slowModeSeconds" to slow, "bannedWords" to words.split(",").map { it.trim() }.filter { it.isNotEmpty() })) }
                    close()
                }
            }) { Text("Save", color = Brand.Gold) }
        },
        dismissButton = { TextButton(close) { Text("Cancel", color = Brand.Text2) } },
    )
}

// ---------------- Broadcasting ----------------

// The pastor's side: camera preview, then Go Live streams it to the church's
// live server. Comments float over the picture while live.
@Composable
fun GoLiveScreen(session: Session, onClose: () -> Unit) {
    val context = LocalContext.current
    val activity = context as Activity
    val scope = rememberCoroutineScope()
    var granted by remember {
        mutableStateOf(listOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO).all { ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED })
    }
    val ask = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { r -> granted = r.values.all { it } }
    LaunchedEffect(Unit) { if (!granted) ask.launch(arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO)) }

    var title by remember { mutableStateOf("Sunday Service") }
    var status by remember { mutableStateOf("ready") } // ready, connecting, live, error
    var error by remember { mutableStateOf<String?>(null) }
    var muted by remember { mutableStateOf(false) }
    var hd by remember { mutableStateOf(true) }
    var confirmEnd by remember { mutableStateOf(false) }
    var startedAt by remember { mutableLongStateOf(0L) }
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    var viewers by remember { mutableIntStateOf(0) }
    val chat = remember { LiveChat() }
    var camera by remember { mutableStateOf<RtmpCamera2?>(null) }

    // Keep the screen awake while broadcasting.
    DisposableEffect(Unit) {
        activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        onDispose {
            activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        }
    }
    LaunchedEffect(status) {
        if (status == "live") {
            chat.start()
            while (status == "live") {
                now = System.currentTimeMillis()
                if ((now / 1000) % 5 == 0L) runCatching { viewers = Api.decode<LiveSession?>(Api.get("/live/current")["session"])?.viewers ?: viewers }
                delay(1000)
            }
        }
    }
    DisposableEffect(Unit) { onDispose { chat.stop() } }

    fun stop() {
        camera?.let { if (it.isStreaming) it.stopStream() }
        status = "ready"
        scope.launch { runCatching { Api.post("/live/stop") } }
    }
    BackHandler { if (status == "live" || status == "connecting") confirmEnd = true else onClose() }

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        if (granted) {
            AndroidView(
                factory = { ctx ->
                    OpenGlView(ctx).also { view ->
                        val checker = object : ConnectChecker {
                            override fun onConnectionStarted(url: String) {}
                            override fun onConnectionSuccess() { activity.runOnUiThread { status = "live"; startedAt = System.currentTimeMillis() } }
                            override fun onConnectionFailed(reason: String) {
                                activity.runOnUiThread {
                                    camera?.stopStream()
                                    status = "error"; error = "Couldn't reach the live server ($reason). Check your connection and try again."
                                    scope.launch { runCatching { Api.post("/live/stop") } }
                                }
                            }
                            override fun onDisconnect() {}
                            override fun onAuthError() { activity.runOnUiThread { status = "error"; error = "The live server refused this broadcast." } }
                            override fun onAuthSuccess() {}
                        }
                        camera = RtmpCamera2(view, checker)
                        view.holder.addCallback(object : android.view.SurfaceHolder.Callback {
                            override fun surfaceCreated(holder: android.view.SurfaceHolder) {}
                            override fun surfaceChanged(holder: android.view.SurfaceHolder, format: Int, width: Int, height: Int) {
                                camera?.let { if (!it.isOnPreview) it.startPreview(CameraHelper.Facing.BACK, 1280, 720, CameraHelper.getCameraOrientation(ctx)) }
                            }
                            override fun surfaceDestroyed(holder: android.view.SurfaceHolder) {
                                camera?.let { if (it.isStreaming) it.stopStream(); if (it.isOnPreview) it.stopPreview() }
                            }
                        })
                    }
                },
                modifier = Modifier.fillMaxSize(),
            )
        } else {
            Column(Modifier.align(Alignment.Center).padding(30.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Camera and microphone are needed to go live.", color = Brand.White, textAlign = TextAlign.Center)
                Spacer(Modifier.height(14.dp))
                GoldButton("Allow") { ask.launch(arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO)) }
            }
        }

        // Top bar: close / status / timer / viewers.
        Row(Modifier.fillMaxWidth().statusBarsPadding().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Rounded.Close, "Close", tint = Color.White, modifier = Modifier.size(42.dp).glass(CircleShape).clickable { if (status == "live") confirmEnd = true else onClose() }.padding(9.dp))
            Spacer(Modifier.width(10.dp))
            if (status == "live") {
                LiveBadgeRow(viewers)
                Spacer(Modifier.width(8.dp))
                val secs = ((now - startedAt) / 1000).coerceAtLeast(0)
                Text("%d:%02d:%02d".format(secs / 3600, secs / 60 % 60, secs % 60), color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                    modifier = Modifier.clip(RoundedCornerShape(6.dp)).background(Color(0x99000000)).padding(horizontal = 8.dp, vertical = 4.dp))
            }
            Spacer(Modifier.weight(1f))
            Icon(if (muted) Icons.Rounded.MicOff else Icons.Rounded.Mic, if (muted) "Unmute" else "Mute", tint = if (muted) Brand.Red else Color.White,
                modifier = Modifier.size(42.dp).glass(CircleShape).clickable {
                    muted = !muted
                    camera?.let { if (muted) it.disableAudio() else it.enableAudio() }
                }.padding(9.dp))
            Spacer(Modifier.width(8.dp))
            Icon(Icons.Rounded.Cameraswitch, "Switch camera", tint = Color.White, modifier = Modifier.size(42.dp).glass(CircleShape).clickable { runCatching { camera?.switchCamera() } }.padding(9.dp))
        }

        if (status == "live") {
            FloatingComments(chat, Modifier.align(Alignment.BottomStart).navigationBarsPadding().padding(start = 16.dp, bottom = 100.dp).widthIn(max = 330.dp))
            Box(Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(24.dp)) {
                Text("End live", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp,
                    modifier = Modifier.clip(RoundedCornerShape(50)).background(Color(0xE6D7263D)).clickable { confirmEnd = true }.padding(horizontal = 28.dp, vertical = 14.dp))
            }
        } else {
            // Before going live: title, quality and the big button.
            Column(
                Modifier.align(Alignment.BottomCenter).fillMaxWidth().navigationBarsPadding().imePadding()
                    .background(Brush.verticalGradient(listOf(Color.Transparent, Color(0xE6000000), Color(0xF5000000)))).padding(20.dp),
            ) {
                Field("TITLE", title, { title = it.take(120) }, hint = "What are we streaming?")
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(true to "HD 720p", false to "Data saver 480p").forEach { (v, label) ->
                        Text(label, color = if (hd == v) Brand.Black else Brand.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                            modifier = (if (hd == v) Modifier.clip(RoundedCornerShape(50)).background(Brand.GoldGradient) else Modifier.glass()).clickable(enabled = status != "connecting") { hd = v }.padding(horizontal = 14.dp, vertical = 7.dp))
                    }
                }
                error?.let { Text(it, color = Color(0xFFFFB4AE), fontSize = 13.sp, modifier = Modifier.padding(top = 10.dp)) }
                Spacer(Modifier.height(14.dp))
                Row(
                    Modifier.fillMaxWidth().height(60.dp).clip(RoundedCornerShape(50))
                        .background(Brush.horizontalGradient(listOf(Color(0xFFFF5A4E), Color(0xFFD7263D))))
                        .clickable(enabled = granted && status != "connecting") {
                            val cam = camera ?: return@clickable
                            status = "connecting"; error = null
                            scope.launch {
                                runCatching { Api.post("/live/start", mapOf("title" to title)) }
                                    .onSuccess { res ->
                                        val url = (res["publishUrl"] as kotlinx.serialization.json.JsonPrimitive).content
                                        // Lock to the way the phone is held now; the stream keeps that shape.
                                        activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LOCKED
                                        val rotation = CameraHelper.getCameraOrientation(context)
                                        val (w, h, bitrate) = if (hd) Triple(1280, 720, 2_500_000) else Triple(854, 480, 1_000_000)
                                        if (cam.prepareAudio(128_000, 44_100, true) && cam.prepareVideo(w, h, 30, bitrate, rotation)) {
                                            if (muted) cam.disableAudio()
                                            cam.startStream(url)
                                        } else { status = "error"; error = "This phone's camera couldn't start a broadcast." }
                                    }
                                    .onFailure { status = "error"; error = it.message }
                            }
                        },
                    horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (status == "connecting") CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
                    else { PulsingDot(Color.White, 9.dp); Spacer(Modifier.width(10.dp)); Text("Go Live", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp) }
                }
                Text("Everyone gets a notification as soon as the picture reaches them.", style = Type.Meta, color = Brand.Text2,
                    textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = 10.dp))
            }
        }
    }
    if (confirmEnd) {
        AlertDialog(
            onDismissRequest = { confirmEnd = false }, containerColor = Color(0xFF1C1C20),
            title = { Text("End the live?", color = Brand.White) },
            text = { Text("Everyone watching will see that the service has ended.", color = Brand.Text2) },
            confirmButton = { TextButton({ confirmEnd = false; stop(); onClose() }) { Text("End live", color = Brand.Red) } },
            dismissButton = { TextButton({ confirmEnd = false }) { Text("Keep going", color = Brand.Text2) } },
        )
    }
}
