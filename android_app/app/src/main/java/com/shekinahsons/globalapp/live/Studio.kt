package com.shekinahsons.globalapp.live

import android.Manifest
import android.app.Activity
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.media.projection.MediaProjectionManager
import android.view.SurfaceHolder
import android.view.SurfaceView
import android.view.WindowManager
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Chat
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.Cameraswitch
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Coffee
import androidx.compose.material.icons.rounded.FlashlightOn
import androidx.compose.material.icons.rounded.Mic
import androidx.compose.material.icons.rounded.MicOff
import androidx.compose.material.icons.rounded.PresentToAll
import androidx.compose.material.icons.rounded.ScreenShare
import androidx.compose.material.icons.rounded.Slideshow
import androidx.compose.material.icons.rounded.Videocam
import androidx.compose.material.icons.rounded.VideocamOff
import androidx.compose.material.icons.rounded.MenuBook
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.pedro.encoder.input.video.CameraHelper
import com.shekinahsons.globalapp.bible.BibleDb
import com.shekinahsons.globalapp.bible.BibleLink
import com.shekinahsons.globalapp.data.Api
import com.shekinahsons.globalapp.data.Session
import com.shekinahsons.globalapp.ui.components.Field
import com.shekinahsons.globalapp.ui.components.GoldButton
import com.shekinahsons.globalapp.ui.components.PulsingDot
import com.shekinahsons.globalapp.ui.components.glass
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Type
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

// The host's studio: camera preview, then going live with the controls you'd
// expect from YouTube Live and Google Meet: mic and camera, flip, share the
// screen, present slides, show a verse, "be right back", name banner and logo,
// stream health, viewers, and the live chat with moderation.
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GoLiveScreen(session: Session, onClose: () -> Unit) {
    val context = LocalContext.current
    val activity = context as Activity
    val scope = rememberCoroutineScope()
    val needed = arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO)
    var granted by remember { mutableStateOf(needed.all { ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED }) }
    val ask = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { r -> granted = r.values.all { it } }
    LaunchedEffect(Unit) { if (!granted) ask.launch(needed) }

    var title by remember { mutableStateOf("Sunday Service") }
    var hd by remember { mutableStateOf(true) }
    var paid by remember { mutableStateOf(false) }
    var price by remember { mutableStateOf("") }
    var confirmEnd by remember { mutableStateOf(false) }
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    var viewers by remember { mutableIntStateOf(0) }
    var sheet by remember { mutableStateOf<String?>(null) } // present, effects, chat
    var verseAsk by remember { mutableStateOf(false) }
    var chatOpen by remember { mutableStateOf(false) }
    var moderate by remember { mutableStateOf(false) }
    var controlsVisible by remember { mutableStateOf(true) }
    val chat = remember { LiveChat() }
    val state = Broadcast.state
    val live = state == "live"
    val portrait = LocalConfiguration.current.orientation == Configuration.ORIENTATION_PORTRAIT
    if (Broadcast.bannerName.isBlank()) Broadcast.bannerName = session.member?.name.orEmpty()

    DisposableEffect(Unit) {
        activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        onDispose {
            activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            chat.stop()
        }
    }
    LaunchedEffect(live) {
        if (live) {
            chat.start()
            while (Broadcast.state == "live") {
                now = System.currentTimeMillis()
                if ((now / 1000) % 5 == 0L) runCatching { viewers = Api.decode<LiveSession?>(Api.get("/live/current")["session"])?.viewers ?: viewers }
                delay(1000)
            }
        }
    }

    // Screen sharing: Android asks the host first, then the service starts the capture.
    val screenAsk = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        if (r.resultCode == Activity.RESULT_OK && r.data != null) LiveService.start(context, screen = true, resultCode = r.resultCode, data = r.data)
    }
    val pickSlides = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) scope.launch {
            val file = withContext(Dispatchers.IO) {
                File(context.cacheDir, "slides-${System.currentTimeMillis()}.pdf").also { f -> context.contentResolver.openInputStream(uri)?.use { i -> f.outputStream().use { i.copyTo(it) } } }
            }
            if (!Broadcast.openSlides(file)) Broadcast.failed("That PDF couldn't be opened for presenting.")
        }
    }

    fun end() {
        Broadcast.stop(context)
        scope.launch { runCatching { Api.post("/live/stop") } }
        onClose()
    }
    BackHandler {
        when {
            sheet != null -> sheet = null
            chatOpen -> chatOpen = false
            live || state == "connecting" -> confirmEnd = true
            else -> { Broadcast.stop(context); onClose() }
        }
    }

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        if (granted) {
            AndroidView(
                factory = { ctx ->
                    val stream = Broadcast.get(ctx)
                    SurfaceView(ctx).also { view ->
                        Broadcast.preview = view
                        view.holder.addCallback(object : SurfaceHolder.Callback {
                            override fun surfaceCreated(holder: SurfaceHolder) {}
                            override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
                                if (!stream.isStreaming && !stream.isOnPreview) {
                                    Broadcast.prepare(hd, portrait, CameraHelper.getCameraOrientation(ctx))
                                }
                                if (!stream.isOnPreview) stream.startPreview(view)
                                stream.getGlInterface().setPreviewResolution(width, height)
                            }
                            // Leaving the screen only stops the preview; the broadcast carries on.
                            override fun surfaceDestroyed(holder: SurfaceHolder) { if (stream.isOnPreview) stream.stopPreview(); if (Broadcast.preview === view) Broadcast.preview = null }
                        })
                    }
                },
                modifier = Modifier.fillMaxSize().clickable(enabled = live) { controlsVisible = !controlsVisible },
            )
        } else {
            Column(Modifier.align(Alignment.Center).padding(30.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Camera and microphone are needed to go live.", color = Brand.White, textAlign = TextAlign.Center)
                Spacer(Modifier.height(14.dp))
                GoldButton("Allow") { ask.launch(needed) }
            }
        }

        // While sharing the screen, cover the preview (it would show itself
        // endlessly), like Meet's "You're presenting".
        if (live && Broadcast.showing == Showing.Screen) {
            Column(
                Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF0E1A3A), Color(0xFF050508)))),
                horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center,
            ) {
                Box(Modifier.size(84.dp).clip(CircleShape).background(Color(0x331A73E8)), contentAlignment = Alignment.Center) {
                    Icon(Icons.Rounded.ScreenShare, null, tint = Color(0xFF8AB4F8), modifier = Modifier.size(44.dp))
                }
                Spacer(Modifier.height(18.dp))
                Text("You're presenting your screen", style = Type.Title, color = Color.White)
                Text("Open any app. Everything on the screen, and its sound, goes to everyone watching.", style = Type.Meta, color = Brand.Text2,
                    textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 40.dp, vertical = 8.dp))
                Spacer(Modifier.height(10.dp))
                Text("Stop presenting", color = Color.White, fontWeight = FontWeight.Bold,
                    modifier = Modifier.clip(RoundedCornerShape(50)).background(Color(0xFF1A73E8)).clickable { Broadcast.showCamera(context) }.padding(horizontal = 22.dp, vertical = 12.dp))
            }
        }

        // Top bar: close, LIVE + viewers, timer, stream health.
        Row(Modifier.fillMaxWidth().statusBarsPadding().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Rounded.Close, "Close", tint = Color.White, modifier = Modifier.size(42.dp).glass(CircleShape).clickable { if (live) confirmEnd = true else { Broadcast.stop(context); onClose() } }.padding(9.dp))
            Spacer(Modifier.width(10.dp))
            if (live) {
                LiveBadgeRow(viewers)
                Spacer(Modifier.width(8.dp))
                val secs = ((now - Broadcast.startedAt) / 1000).coerceAtLeast(0)
                Text("%d:%02d:%02d".format(secs / 3600, secs / 60 % 60, secs % 60), color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                    modifier = Modifier.clip(RoundedCornerShape(6.dp)).background(Color(0x99000000)).padding(horizontal = 8.dp, vertical = 4.dp))
                Spacer(Modifier.width(8.dp))
                Health()
            }
            Spacer(Modifier.weight(1f))
        }

        // What viewers see, when it isn't the camera.
        if (live && Broadcast.showing != Showing.Camera) {
            Column(Modifier.align(Alignment.TopCenter).statusBarsPadding().padding(top = 64.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Row(Modifier.clip(RoundedCornerShape(50)).background(Color(0xE61A73E8)).padding(start = 14.dp, end = 6.dp, top = 6.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        when (Broadcast.showing) {
                            Showing.Screen -> "You're sharing your screen"
                            Showing.Slides -> "Presenting slide ${Broadcast.slide + 1} of ${Broadcast.slideCount}"
                            Showing.Verse -> "Showing a verse"
                            Showing.BeRightBack -> "Viewers see “Be right back”"
                            Showing.CameraOff -> "Your camera is off"
                            Showing.Camera -> ""
                        },
                        color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                    )
                    Spacer(Modifier.width(10.dp))
                    Text(if (Broadcast.showing == Showing.CameraOff) "Turn on" else "Stop", color = Color(0xFF1A73E8), fontWeight = FontWeight.Bold, fontSize = 13.sp,
                        modifier = Modifier.clip(RoundedCornerShape(50)).background(Color.White).clickable { Broadcast.showCamera(context) }.padding(horizontal = 12.dp, vertical = 5.dp))
                }
                if (Broadcast.showing == Showing.Slides) {
                    Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        Icon(Icons.AutoMirrored.Rounded.KeyboardArrowLeft, "Previous slide", tint = Color.White, modifier = Modifier.size(52.dp).glass(CircleShape).clickable { Broadcast.showSlide(Broadcast.slide - 1) }.padding(10.dp))
                        Icon(Icons.AutoMirrored.Rounded.KeyboardArrowRight, "Next slide", tint = Color.White, modifier = Modifier.size(52.dp).glass(CircleShape).clickable { Broadcast.showSlide(Broadcast.slide + 1) }.padding(10.dp))
                    }
                }
            }
        }

        if (live) {
            if (!chatOpen) FloatingComments(chat, Modifier.align(Alignment.BottomStart).navigationBarsPadding().padding(start = 16.dp, bottom = if (Broadcast.bannerOn) 230.dp else 110.dp).widthIn(max = 330.dp))
            AnimatedVisibility(controlsVisible, enter = fadeIn(), exit = fadeOut(), modifier = Modifier.align(Alignment.BottomCenter)) {
                ControlBar(
                    openPresent = { sheet = "present" }, openEffects = { sheet = "effects" }, openChat = { chatOpen = true },
                    toggleCamera = { if (Broadcast.showing == Showing.CameraOff) Broadcast.showCamera(context) else Broadcast.cameraOff(title) },
                    end = { confirmEnd = true }, unread = chat.messages.size,
                )
            }
            if (chatOpen) {
                Column(
                    Modifier.align(Alignment.BottomCenter).fillMaxWidth().fillMaxHeight(0.62f).clip(RoundedCornerShape(topStart = 26.dp, topEnd = 26.dp))
                        .background(Color(0xF2111113)).navigationBarsPadding().imePadding(),
                ) {
                    Row(Modifier.fillMaxWidth().padding(start = 16.dp, end = 8.dp, top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(if (chat.chatOff) "Chat is off for viewers" else "${chat.messages.size} comments", style = Type.Meta, color = Brand.Text2, modifier = Modifier.weight(1f))
                        Icon(Icons.Rounded.Close, "Close chat", tint = Color.White, modifier = Modifier.size(40.dp).clip(CircleShape).clickable { chatOpen = false }.padding(9.dp))
                    }
                    LiveChatPanel(chat, session, openProfile = {}, modifier = Modifier.weight(1f))
                }
            }
        } else {
            // Before going live: title, quality, banner and the big button.
            Column(
                Modifier.align(Alignment.BottomCenter).fillMaxWidth().navigationBarsPadding().imePadding()
                    .background(Brush.verticalGradient(listOf(Color.Transparent, Color(0xE6000000), Color(0xF5000000)))).padding(20.dp),
            ) {
                Field("TITLE", title, { title = it.take(120) }, hint = "What are we streaming?")
                Spacer(Modifier.height(10.dp))
                Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(true to "HD 720p", false to "Data saver 480p").forEach { (v, label) ->
                        Pill(label, hd == v, enabled = state != "connecting") { hd = v; Broadcast.stream?.let { if (!it.isStreaming) Broadcast.prepare(hd, portrait, CameraHelper.getCameraOrientation(context)) } }
                    }
                    Pill("Name banner", Broadcast.bannerOn) { Broadcast.setBanner(!Broadcast.bannerOn, title = title) }
                    Pill("Logo", Broadcast.logoOn) { Broadcast.setLogo(!Broadcast.logoOn) }
                }
                Spacer(Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Pill("Free for everyone", !paid) { paid = false }
                    Pill("Paid live", paid) { paid = true }
                }
                if (paid) {
                    Spacer(Modifier.height(8.dp))
                    Field("PRICE (KSH)", price, { price = it.filter(Char::isDigit).take(7) }, hint = "e.g. 200", keyboard = androidx.compose.ui.text.input.KeyboardType.Number)
                    Text("Viewers pay with M-Pesa, Airtel Money or bank; the picture unlocks for them once finance confirms. Hosts, moderators and admins watch free.",
                        style = Type.Meta, color = Brand.Text2, modifier = Modifier.padding(top = 4.dp))
                }
                Broadcast.error?.let { Text(it, color = Color(0xFFFFB4AE), fontSize = 13.sp, modifier = Modifier.padding(top = 10.dp)) }
                Spacer(Modifier.height(14.dp))
                Row(
                    Modifier.fillMaxWidth().height(60.dp).clip(RoundedCornerShape(50))
                        .background(Brush.horizontalGradient(listOf(Color(0xFFFF5A4E), Color(0xFFD7263D))))
                        .clickable(enabled = granted && state != "connecting" && (!paid || (price.toIntOrNull() ?: 0) > 0)) {
                            scope.launch {
                                runCatching { Api.post("/live/start", mapOf("title" to title, "price" to (if (paid) price.toIntOrNull() ?: 0 else 0))) }
                                    .onSuccess { res ->
                                        val url = (res["publishUrl"] as kotlinx.serialization.json.JsonPrimitive).content
                                        // The stream keeps the shape the phone is held in now.
                                        activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LOCKED
                                        Broadcast.bannerTitle = title
                                        Broadcast.start(context, url)
                                    }
                                    .onFailure { Broadcast.failed(it.message ?: "Couldn't start the live.") }
                            }
                        },
                    horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (state == "connecting") CircularProgressIndicator(color = Color.White, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
                    else { PulsingDot(Color.White, 9.dp); Spacer(Modifier.width(10.dp)); Text("Go Live", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp) }
                }
                Text("Everyone gets a notification as soon as the picture reaches them.", style = Type.Meta, color = Brand.Text2,
                    textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = 10.dp))
            }
        }
    }

    // Present: what viewers see.
    if (sheet == "present") {
        ModalBottomSheet(onDismissRequest = { sheet = null }, containerColor = Color(0xFF16161A), sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
            Column(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 18.dp).padding(bottom = 20.dp)) {
                Text("Present", style = Type.Title, color = Brand.White)
                Text("Choose what everyone watching sees.", style = Type.Meta, color = Brand.Text2)
                Spacer(Modifier.height(14.dp))
                SheetAction(Icons.Rounded.Videocam, "Camera", "Back to you", Broadcast.showing == Showing.Camera) { Broadcast.showCamera(context); sheet = null }
                SheetAction(Icons.Rounded.ScreenShare, "Share your screen", "Show anything on this phone, with its sound", Broadcast.showing == Showing.Screen) {
                    sheet = null
                    screenAsk.launch(context.getSystemService(MediaProjectionManager::class.java).createScreenCaptureIntent())
                }
                SheetAction(Icons.Rounded.Slideshow, "Present slides", "Pick a PDF and move through it slide by slide", Broadcast.showing == Showing.Slides) { sheet = null; pickSlides.launch(arrayOf("application/pdf")) }
                SheetAction(Icons.Rounded.MenuBook, "Show a verse", "Put scripture on screen, like the projector", Broadcast.showing == Showing.Verse) { sheet = null; verseAsk = true }
                SheetAction(Icons.Rounded.Coffee, "Be right back", "A card while you set up or take a break", Broadcast.showing == Showing.BeRightBack) { Broadcast.beRightBack(title); sheet = null }
            }
        }
    }
    // Effects: banner, logo, torch, zoom.
    if (sheet == "effects") {
        ModalBottomSheet(onDismissRequest = { sheet = null }, containerColor = Color(0xFF16161A)) {
            Column(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 18.dp).padding(bottom = 20.dp)) {
                Text("On-screen", style = Type.Title, color = Brand.White)
                Spacer(Modifier.height(10.dp))
                var name by remember { mutableStateOf(Broadcast.bannerName) }
                var line by remember { mutableStateOf(Broadcast.bannerTitle.ifBlank { title }) }
                SwitchRow("Name banner", "Shown across the bottom of the picture", Broadcast.bannerOn) { Broadcast.setBanner(it, name, line) }
                if (Broadcast.bannerOn) {
                    Field("NAME", name, { name = it.take(40); Broadcast.setBanner(true, name, line) })
                    Spacer(Modifier.height(8.dp))
                    Field("SECOND LINE", line, { line = it.take(60); Broadcast.setBanner(true, name, line) })
                    Spacer(Modifier.height(6.dp))
                }
                SwitchRow("Church logo", "In the top corner", Broadcast.logoOn) { Broadcast.setLogo(it) }
                if (Broadcast.showing == Showing.Camera) {
                    SwitchRow("Torch", "Light for dark rooms (back camera)", Broadcast.torch) { Broadcast.switchTorch(it) }
                    val range = Broadcast.zoomRange()
                    if (range.endInclusive > range.start) {
                        var z by remember { mutableFloatStateOf(range.start) }
                        Text("Zoom", color = Brand.White, fontSize = 15.sp, modifier = Modifier.padding(top = 10.dp))
                        Slider(z, { z = it; Broadcast.zoom(it) }, valueRange = range, colors = SliderDefaults.colors(thumbColor = Brand.Gold, activeTrackColor = Brand.Gold))
                    }
                }
            }
        }
    }
    if (verseAsk) {
        var reference by remember { mutableStateOf("") }
        var text by remember { mutableStateOf("") }
        // Fill in the verse text from the Bible as the reference is typed.
        LaunchedEffect(reference) {
            val bible = BibleDb.get(context)
            val found = withContext(Dispatchers.IO) { BibleLink.parse(bible, reference)?.let { (b, c, v) -> bible.verse(BibleDb.ENGLISH, b, c, v) } }
            if (found != null) text = found
        }
        AlertDialog(
            onDismissRequest = { verseAsk = false }, containerColor = Color(0xFF1C1C20),
            title = { Text("Show a verse", color = Brand.White) },
            text = {
                Column {
                    Field("REFERENCE", reference, { reference = it.take(40) }, hint = "e.g. John 3:16")
                    Spacer(Modifier.height(10.dp))
                    Field("TEXT", text, { text = it.take(600) }, minHeight = 110.dp, singleLine = false)
                }
            },
            confirmButton = { TextButton({ if (text.isNotBlank()) Broadcast.showVerse(reference, text.trim()); verseAsk = false }) { Text("Show", color = Brand.Gold) } },
            dismissButton = { TextButton({ verseAsk = false }) { Text("Cancel", color = Brand.Text2) } },
        )
    }
    if (moderate) ModeratorSettings { moderate = false; chat.refresh() }
    if (confirmEnd) {
        AlertDialog(
            onDismissRequest = { confirmEnd = false }, containerColor = Color(0xFF1C1C20),
            title = { Text("End the live?", color = Brand.White) },
            text = { Text("Everyone watching will see that the service has ended.", color = Brand.Text2) },
            confirmButton = { TextButton({ confirmEnd = false; end() }) { Text("End live", color = Brand.Red) } },
            dismissButton = { TextButton({ confirmEnd = false }) { Text("Keep going", color = Brand.Text2) } },
        )
    }
}

// Meet-style round controls along the bottom.
@Composable
private fun ControlBar(openPresent: () -> Unit, openEffects: () -> Unit, openChat: () -> Unit, toggleCamera: () -> Unit, end: () -> Unit, unread: Int) {
    Row(
        Modifier.navigationBarsPadding().padding(12.dp).clip(RoundedCornerShape(32.dp)).background(Color(0xE6151517))
            .border(1.dp, Color(0x22FFFFFF), RoundedCornerShape(32.dp)).padding(horizontal = 8.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically,
    ) {
        Round(if (Broadcast.micOn) Icons.Rounded.Mic else Icons.Rounded.MicOff, if (Broadcast.micOn) "Mute" else "Unmute", danger = !Broadcast.micOn) { Broadcast.setMic(!Broadcast.micOn) }
        val camOff = Broadcast.showing == Showing.CameraOff
        Round(if (camOff) Icons.Rounded.VideocamOff else Icons.Rounded.Videocam, if (camOff) "Turn camera on" else "Turn camera off", danger = camOff, onClick = toggleCamera)
        Round(Icons.Rounded.Cameraswitch, "Flip camera", enabled = Broadcast.showing == Showing.Camera) { Broadcast.flipCamera() }
        Round(Icons.Rounded.PresentToAll, "Present", active = Broadcast.showing !in setOf(Showing.Camera, Showing.CameraOff), onClick = openPresent)
        Round(Icons.Rounded.AutoAwesome, "On-screen", active = Broadcast.bannerOn, onClick = openEffects)
        Box {
            Round(Icons.AutoMirrored.Rounded.Chat, "Chat", onClick = openChat)
            if (unread > 0) Text(if (unread > 99) "99+" else "$unread", color = Brand.Black, fontSize = 9.5.sp, fontWeight = FontWeight.Bold,
                modifier = Modifier.align(Alignment.TopEnd).clip(RoundedCornerShape(50)).background(Brand.Gold).padding(horizontal = 4.dp, vertical = 1.dp))
        }
        Text("End", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp,
            modifier = Modifier.clip(RoundedCornerShape(50)).background(Color(0xFFD7263D)).clickable(onClick = end).padding(horizontal = 16.dp, vertical = 12.dp))
    }
}

@Composable
private fun Round(icon: ImageVector, label: String, danger: Boolean = false, active: Boolean = false, enabled: Boolean = true, onClick: () -> Unit) {
    Box(
        Modifier.size(44.dp).clip(CircleShape)
            .background(when { danger -> SolidColor(Color(0xFFD7263D)); active -> Brand.GoldGradient; else -> SolidColor(Color(0x26FFFFFF)) })
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, label, tint = when { active -> Brand.Black; !enabled -> Color(0x55FFFFFF); else -> Color.White }, modifier = Modifier.size(22.dp))
    }
}

// Stream health, like YouTube Studio's: is the picture getting out well?
@Composable
private fun Health() {
    val h = Broadcast.health
    val (color, label) = when {
        Broadcast.bitrate == 0L -> Color(0xFFB8B8BD) to "Starting"
        h > 0.6f -> Color(0xFF4ADE80) to "Excellent"
        h > 0.3f -> Color(0xFFFACC15) to "OK"
        else -> Color(0xFFF87171) to "Poor connection"
    }
    Row(Modifier.clip(RoundedCornerShape(6.dp)).background(Color(0x99000000)).padding(horizontal = 8.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(8.dp).clip(CircleShape).background(color))
        Spacer(Modifier.width(6.dp))
        Text(label, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun Pill(label: String, on: Boolean, enabled: Boolean = true, onClick: () -> Unit) {
    Text(label, color = if (on) Brand.Black else Brand.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
        modifier = (if (on) Modifier.clip(RoundedCornerShape(50)).background(Brand.GoldGradient) else Modifier.glass()).clickable(enabled = enabled, onClick = onClick).padding(horizontal = 14.dp, vertical = 7.dp))
}

@Composable
private fun SheetAction(icon: ImageVector, title: String, detail: String, current: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 4.dp).clip(RoundedCornerShape(18.dp))
            .background(if (current) Color(0x26D4AF37) else Color.Transparent).clickable(onClick = onClick).padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(42.dp).clip(RoundedCornerShape(13.dp)).background(if (current) Brand.GoldGradient else SolidColor(Color(0x1FFFFFFF))), contentAlignment = Alignment.Center) {
            Icon(icon, null, tint = if (current) Brand.Black else Brand.GoldLight, modifier = Modifier.size(22.dp))
        }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(title, color = Brand.White, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
            Text(detail, style = Type.Meta, color = Brand.Text2)
        }
        if (current) Text("ON", style = Type.Label, color = Brand.Gold)
    }
}

@Composable
private fun SwitchRow(title: String, detail: String, on: Boolean, change: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, color = Brand.White, fontSize = 15.sp, fontWeight = FontWeight.Medium)
            Text(detail, style = Type.Meta, color = Brand.Text2)
        }
        Switch(on, change, colors = SwitchDefaults.colors(checkedThumbColor = Brand.Black, checkedTrackColor = Brand.Gold, uncheckedTrackColor = Color(0x22FFFFFF)))
    }
}
