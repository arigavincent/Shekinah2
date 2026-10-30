package com.shekinahsons.globalapp.ui.screens

import android.app.Activity
import android.app.PictureInPictureParams
import android.content.Intent
import android.content.pm.ActivityInfo
import android.os.Build
import android.util.Rational
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import android.view.ViewGroup
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.displayCutoutPadding
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.outlined.DownloadForOffline
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.DownloadDone
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.FitScreen
import androidx.compose.material.icons.rounded.Fullscreen
import androidx.compose.material.icons.rounded.FullscreenExit
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.LockOpen
import androidx.compose.material.icons.rounded.PictureInPictureAlt
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Replay
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material.icons.rounded.Speed
import androidx.compose.material.icons.rounded.ZoomOutMap
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
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
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.media3.common.AudioAttributes
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.upstream.DefaultLoadErrorHandlingPolicy
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.DefaultTimeBar
import androidx.media3.ui.PlayerView
import com.shekinahsons.globalapp.data.Library
import com.shekinahsons.globalapp.data.Sermon
import com.shekinahsons.globalapp.playback.PipState
import com.shekinahsons.globalapp.playback.VideoCache
import com.shekinahsons.globalapp.ui.components.AmbientGlow
import com.shekinahsons.globalapp.ui.components.FadeImage
import com.shekinahsons.globalapp.ui.components.TopBar
import com.shekinahsons.globalapp.ui.components.outset
import com.shekinahsons.globalapp.ui.components.glass
import com.shekinahsons.globalapp.ui.components.lifted
import androidx.compose.foundation.border
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Type
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private fun clockOf(ms: Long): String {
    val s = (ms / 1000).coerceAtLeast(0)
    return if (s >= 3600) "%d:%02d:%02d".format(s / 3600, s / 60 % 60, s % 60) else "%d:%02d".format(s / 60, s % 60)
}

// Our own sermon player (Media3), with the parts of AJStream's player that
// make it feel good: instant start from a warm cache, resume where you left
// off, double-tap to skip, swipe for brightness and volume, lock, speed,
// fill-the-screen, mini player, reconnecting on weak networks, and the next
// sermon counting down when one ends.
@Composable
fun VideoPlayerScreen(sermon: Sermon, queue: List<Sermon>, library: Library, onOpen: (Sermon) -> Unit, onBack: () -> Unit) {
    if (sermon.replayId.isNotBlank()) {
        com.shekinahsons.globalapp.live.ReplaySermon(sermon, library, onBack)
        return
    }
    val context = LocalContext.current
    val activity = context as Activity
    val scope = rememberCoroutineScope()
    var fullscreen by remember { mutableStateOf(false) }
    LaunchedEffect(sermon.id) { library.opened(sermon.id) }
    var controls by remember { mutableStateOf(true) }
    var locked by remember { mutableStateOf(false) }
    var unlockHint by remember { mutableStateOf(false) }
    // Full screen fills the display; SmartFill eases back whenever a verse
    // banner is on screen so it is never cut. Pinch or the button for the whole picture.
    var fill by remember { mutableStateOf(true) }
    var speed by remember { mutableFloatStateOf(1f) }
    var speedMenu by remember { mutableStateOf(false) }
    var flash by remember { mutableStateOf<String?>(null) }
    var notice by remember { mutableStateOf<String?>(null) }
    var firstFrame by remember { mutableStateOf(false) }
    var buffering by remember { mutableStateOf(true) }
    var ended by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var retries by remember { mutableIntStateOf(0) }
    var view by remember { mutableStateOf<PlayerView?>(null) }
    val pip = PipState.active

    val player = remember {
        ExoPlayer.Builder(context)
            .setLoadControl(VideoCache.loadControl())
            .setMediaSourceFactory(DefaultMediaSourceFactory(VideoCache.dataSourceFactory()).setLoadErrorHandlingPolicy(DefaultLoadErrorHandlingPolicy(8)))
            .setAudioAttributes(AudioAttributes.DEFAULT, true)
            .setHandleAudioBecomingNoisy(true)
            .setSeekBackIncrementMs(10_000).setSeekForwardIncrementMs(10_000)
            .build()
    }

    fun save() = library.savePosition(sermon.id, player.currentPosition, player.duration)

    LaunchedEffect(sermon.id) {
        library.remember(sermon)
        firstFrame = false; ended = false; error = null; retries = 0
        val resume = library.position(sermon.id)
        player.setMediaItem(MediaItem.fromUri(library.playableUri(sermon)), resume)
        player.prepare()
        player.playWhenReady = true
        if (resume > 0) notice = "Resuming at ${clockOf(resume)}"
        // Warm the next sermon while this one plays.
        queue.getOrNull(queue.indexOfFirst { it.id == sermon.id } + 1)?.let { VideoCache.warm(it.mediaUrl) }
    }
    LaunchedEffect(Unit) { while (true) { delay(5_000); if (player.isPlaying) save() } }
    LaunchedEffect(notice) { if (notice != null) { delay(2500); notice = null } }
    LaunchedEffect(flash) { if (flash != null) { delay(650); flash = null } }
    LaunchedEffect(unlockHint) { if (unlockHint) { delay(3000); unlockHint = false } }

    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onRenderedFirstFrame() { firstFrame = true }
            override fun onPlaybackStateChanged(state: Int) {
                buffering = state == Player.STATE_BUFFERING
                if (state == Player.STATE_READY) retries = 0
                if (state == Player.STATE_ENDED) { ended = true; library.savePosition(sermon.id, player.duration, player.duration) }
            }
            override fun onPlayerError(e: PlaybackException) {
                // A dropped connection: pick up where it stopped (a few times) before asking.
                val network = e.errorCode in PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED..PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT ||
                    e.errorCode == PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS
                if (network && retries < 3) {
                    retries++; notice = "Reconnecting…"
                    scope.launch { delay(2_500L * retries); player.prepare(); player.play() }
                } else error = "Playback stopped. Check your connection and try again."
            }
        }
        player.addListener(listener)
        onDispose { player.removeListener(listener) }
    }

    // Pause when the app goes to the background, unless it is floating as a mini player.
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    DisposableEffect(lifecycle) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_STOP) { save(); if (!PipState.active) player.pause() }
        }
        lifecycle.addObserver(observer)
        onDispose {
            lifecycle.removeObserver(observer)
            save()
            player.release()
            setAutoPip(activity, false)
            activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            WindowInsetsControllerCompat(activity.window, activity.window.decorView).show(WindowInsetsCompat.Type.systemBars())
        }
    }
    // Leaving the app while a sermon plays shrinks it to a floating window.
    LaunchedEffect(player.isPlaying, buffering) { setAutoPip(activity, player.playWhenReady) }

    DisposableEffect(fullscreen) {
        val insets = WindowInsetsControllerCompat(activity.window, activity.window.decorView)
        if (fullscreen) {
            activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
            insets.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            insets.hide(WindowInsetsCompat.Type.systemBars())
        } else {
            activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            insets.show(WindowInsetsCompat.Type.systemBars())
            locked = false
        }
        onDispose {}
    }
    LaunchedEffect(fullscreen, fill, view, pip) {
        val v = view ?: return@LaunchedEffect
        v.resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
        SmartFill.run(v, player, enabled = fullscreen && fill && !pip)
    }
    BackHandler { if (fullscreen) fullscreen = false else onBack() }

    val next = queue.getOrNull(queue.indexOfFirst { it.id == sermon.id } + 1)

    // The picture itself, with AJStream-style gestures.
    val video: @Composable (Modifier) -> Unit = { m ->
        Box(m.background(Color.Black)) {
            AndroidView(
                factory = { ctx ->
                    PlayerView(ctx).apply {
                        this.player = player
                        layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
                        keepScreenOn = true
                        setShowSubtitleButton(false); setShowNextButton(false); setShowPreviousButton(false)
                        setShowBuffering(PlayerView.SHOW_BUFFERING_NEVER)
                        findViewById<View>(androidx.media3.ui.R.id.exo_settings)?.visibility = View.GONE
                        findViewById<DefaultTimeBar>(androidx.media3.ui.R.id.exo_progress)?.apply {
                            setPlayedColor(0xFFD4AF37.toInt()); setScrubberColor(0xFFF0D27A.toInt()); setBufferedColor(0x66FFFFFF)
                        }
                        setFullscreenButtonClickListener { fullscreen = it }
                        setControllerVisibilityListener(PlayerView.ControllerVisibilityListener { v -> controls = v == View.VISIBLE })
                        setBackgroundColor(android.graphics.Color.BLACK)
                        view = this

                        var volumeLevel = -1f
                        val gestures = GestureDetector(ctx, object : GestureDetector.SimpleOnGestureListener() {
                            override fun onDown(e: MotionEvent) = true
                            override fun onSingleTapConfirmed(e: MotionEvent): Boolean {
                                if (locked) { unlockHint = true; return true }
                                if (isControllerFullyVisible) hideController() else showController(); return true
                            }
                            override fun onDoubleTap(e: MotionEvent): Boolean {
                                if (locked) return true
                                val back = e.x < width / 2f
                                player.seekTo((player.currentPosition + if (back) -10_000 else 10_000).coerceIn(0, player.duration.coerceAtLeast(0)))
                                flash = if (back) "« 10s" else "10s »"; return true
                            }
                            // Full screen only: left half brightness, right half volume.
                            override fun onScroll(e1: MotionEvent?, e2: MotionEvent, dx: Float, dy: Float): Boolean {
                                if (!fullscreen || locked || e1 == null || kotlin.math.abs(dy) < kotlin.math.abs(dx)) return false
                                val step = dy / height.coerceAtLeast(1)
                                if (e1.x < width / 2f) {
                                    val attrs = activity.window.attributes
                                    attrs.screenBrightness = ((if (attrs.screenBrightness < 0) 0.5f else attrs.screenBrightness) + step * 1.6f).coerceIn(0.02f, 1f)
                                    activity.window.attributes = attrs
                                    flash = "☀ ${(attrs.screenBrightness * 100).toInt()}%"
                                } else {
                                    // Keep a running total for the whole swipe: each move is a fraction of
                                    // a step, and rounding every move on its own would never change anything.
                                    val audio = activity.getSystemService(android.media.AudioManager::class.java)
                                    val max = audio.getStreamMaxVolume(android.media.AudioManager.STREAM_MUSIC)
                                    if (volumeLevel < 0) volumeLevel = audio.getStreamVolume(android.media.AudioManager.STREAM_MUSIC).toFloat()
                                    volumeLevel = (volumeLevel + step * max * 1.6f).coerceIn(0f, max.toFloat())
                                    audio.setStreamVolume(android.media.AudioManager.STREAM_MUSIC, kotlin.math.round(volumeLevel).toInt(), 0)
                                    flash = "🔊 ${(volumeLevel / max * 100).toInt()}%"
                                }
                                return true
                            }
                        })
                        // Pinch out to fill the screen, pinch in to see the whole picture.
                        var pinched = 1f
                        val pinch = ScaleGestureDetector(ctx, object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
                            override fun onScaleBegin(d: ScaleGestureDetector): Boolean { pinched = 1f; return fullscreen && !locked }
                            override fun onScale(d: ScaleGestureDetector): Boolean { pinched *= d.scaleFactor; return true }
                            override fun onScaleEnd(d: ScaleGestureDetector) {
                                if (pinched > 1.1f) { fill = true; flash = "Filling the screen" } else if (pinched < 0.9f) { fill = false; flash = "Whole picture" }
                            }
                        })
                        @Suppress("ClickableViewAccessibility")
                        setOnTouchListener { _, event ->
                            pinch.onTouchEvent(event)
                            if (!pinch.isInProgress && event.pointerCount == 1) gestures.onTouchEvent(event)
                            if (event.action == MotionEvent.ACTION_UP || event.action == MotionEvent.ACTION_CANCEL) volumeLevel = -1f
                            true
                        }
                    }
                },
                update = {
                    it.setFullscreenButtonState(fullscreen)
                    it.useController = !locked && !pip
                },
                modifier = Modifier.fillMaxSize(),
            )

            // The thumbnail holds the frame until the first picture is drawn.
            val poster by animateFloatAsState(if (firstFrame) 0f else 1f, tween(350), label = "poster")
            if (poster > 0f) {
                Box(Modifier.fillMaxSize().graphicsLayer { alpha = poster }) {
                    FadeImage(sermon.thumbnail, Modifier.fillMaxSize())
                    Box(Modifier.fillMaxSize().background(Color(0x55000000)))
                }
            }
            if ((buffering || !firstFrame) && error == null && !ended) {
                CircularProgressIndicator(color = Brand.Gold, strokeWidth = 3.dp, modifier = Modifier.align(Alignment.Center).size(44.dp))
            }
            flash?.let {
                Text(
                    it, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold,
                    modifier = Modifier.align(if (it.startsWith("«") || it.startsWith("☀")) Alignment.CenterStart else if (it.endsWith("»") || it.startsWith("\uD83D")) Alignment.CenterEnd else Alignment.Center)
                        .padding(horizontal = 40.dp).clip(RoundedCornerShape(30.dp)).background(Color(0x99000000)).padding(horizontal = 18.dp, vertical = 10.dp),
                )
            }
            notice?.let {
                Text(it, color = Color.White, fontSize = 13.sp, modifier = Modifier.align(Alignment.TopCenter).padding(top = 14.dp).clip(RoundedCornerShape(20.dp)).background(Color(0xCC000000)).padding(horizontal = 14.dp, vertical = 6.dp))
            }
            if (locked && unlockHint) {
                Row(
                    Modifier.align(Alignment.Center).clip(RoundedCornerShape(50)).background(Color(0xEEFFFFFF)).clickable { locked = false; unlockHint = false; view?.showController() }.padding(horizontal = 20.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) { Icon(Icons.Rounded.LockOpen, null, tint = Color.Black); Spacer(Modifier.width(8.dp)); Text("Unlock", color = Color.Black, fontWeight = FontWeight.Bold) }
            }
            if (ended && !pip) EndCard(next, Modifier.align(Alignment.Center), replay = { ended = false; player.seekTo(0); player.play() }, playNext = { onOpen(it) })
            error?.let { message ->
                Column(Modifier.align(Alignment.Center).clip(RoundedCornerShape(16.dp)).background(Color(0xEE16161A)).padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(message, color = Color.White, fontSize = 14.sp)
                    Spacer(Modifier.height(12.dp))
                    Text("Retry", color = Brand.Black, fontWeight = FontWeight.Bold, modifier = Modifier.clip(RoundedCornerShape(50)).background(Brand.Gold)
                        .clickable { error = null; retries = 0; player.prepare(); player.play() }.padding(horizontal = 22.dp, vertical = 9.dp))
                }
            }
            // Full-screen top bar (AJStream): back, title, speed, lock, fill, mini player.
            if (fullscreen && !pip && !locked) {
                AnimatedVisibility(controls, enter = fadeIn(), exit = fadeOut(), modifier = Modifier.align(Alignment.TopCenter)) {
                    Row(
                        // Kept clear of the top edge: in full screen the system takes touches there.
                        Modifier.fillMaxWidth().background(Brush.verticalGradient(listOf(Color(0xAA000000), Color.Transparent))).displayCutoutPadding().padding(start = 8.dp, end = 16.dp, top = 22.dp, bottom = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        OverlayIcon(Icons.AutoMirrored.Rounded.ArrowBack, "Exit full screen") { fullscreen = false }
                        Column(Modifier.weight(1f).padding(horizontal = 6.dp)) {
                            Text(sermon.title, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            if (sermon.speaker.isNotBlank()) Text(sermon.speaker, color = Brand.GoldLight, fontSize = 12.sp, maxLines = 1)
                        }
                        OverlayIcon(Icons.Rounded.Speed, "Speed") { speedMenu = true }
                        OverlayIcon(Icons.Rounded.Lock, "Lock") { locked = true; unlockHint = true; view?.hideController() }
                        OverlayIcon(if (fill) Icons.Rounded.FitScreen else Icons.Rounded.ZoomOutMap, if (fill) "Show whole picture" else "Fill screen") { fill = !fill; flash = if (fill) "Filling the screen" else "Whole picture" }
                        OverlayIcon(Icons.Rounded.PictureInPictureAlt, "Mini player") { enterPip(activity) }
                    }
                }
            }
            if (speedMenu) SpeedSheet(speed, { speed = it; player.setPlaybackSpeed(it); flash = if (it == 1f) "Normal speed" else "${it}x" }) { speedMenu = false }
        }
    }

    if (fullscreen || pip) {
        video(Modifier.fillMaxSize())
        return
    }

    val upNext = queue.filter { it.id != sermon.id }
    val saved = library.isSaved(sermon.id)
    val busy = sermon.id in library.downloading
    val done = !busy && library.isDownloaded(sermon)
    Box(Modifier.fillMaxSize().background(Brand.Black)) {
        Box(Modifier.fillMaxWidth().height(560.dp).clipToBounds()) {
            AmbientGlow(sermon.thumbnail, Modifier.fillMaxSize(), blur = 70.dp, alpha = 0.85f)
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color(0x55000000), 1f to Brand.Black)))
        }
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 40.dp)) {
            item { TopBar(title = "", onBack = onBack) }
            item {
                Box(Modifier.padding(horizontal = 12.dp)) {
                    AmbientGlow(sermon.thumbnail, Modifier.matchParentSize().outset(4.dp, drop = 14.dp), blur = 30.dp)
                    video(Modifier.fillMaxWidth().aspectRatio(16 / 9f).lifted(RoundedCornerShape(16.dp), 20.dp).clip(RoundedCornerShape(16.dp)))
                }
            }
            item {
                Column(Modifier.padding(start = 20.dp, end = 20.dp, top = 18.dp)) {
                    if (sermon.category.isNotBlank()) Text(sermon.category.uppercase(), style = Type.Label, color = Brand.Gold)
                    Spacer(Modifier.height(6.dp))
                    Text(sermon.title, style = Type.Display.copy(fontSize = 22.sp), color = Brand.White)
                    Spacer(Modifier.height(6.dp))
                    Text(listOf(sermon.speaker, sermon.date, sermon.duration).filter { it.isNotBlank() }.joinToString(" · "), style = Type.Meta, color = Brand.Text2)
                }
            }
            // AJStream's action row, as chips under the picture.
            item {
                Row(
                    Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 14.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    ActionChip(Icons.Rounded.Speed, if (speed == 1f) "Speed" else "${speed}x", speed != 1f) { speedMenu = true }
                    ActionChip(Icons.Rounded.PictureInPictureAlt, "Mini player") { enterPip(activity) }
                    ActionChip(Icons.Rounded.Fullscreen, "Full screen") { fullscreen = true }
                    ActionChip(if (saved) Icons.Rounded.Favorite else Icons.Outlined.FavoriteBorder, if (saved) "Saved" else "Save", saved) { library.toggleSaved(sermon.id) }
                    ActionChip(if (done) Icons.Rounded.DownloadDone else Icons.Outlined.DownloadForOffline, if (busy) "Downloading ${((library.downloading[sermon.id] ?: 0f) * 100).toInt()}%" else if (done) "Downloaded" else "Download", done) {
                        if (!busy && !done) library.download(sermon)
                    }
                    ActionChip(Icons.Rounded.Share, "Share") {
                        val send = Intent(Intent.ACTION_SEND).setType("text/plain")
                            .putExtra(Intent.EXTRA_TEXT, "${sermon.title} — ${sermon.speaker}\n${sermon.mediaUrl}\n\nShekinah Sons Global")
                        context.startActivity(Intent.createChooser(send, "Share sermon"))
                    }
                }
            }
            if (sermon.description.isNotBlank()) {
                item { Text(sermon.description, style = Type.Body, color = Brand.Text2, modifier = Modifier.padding(horizontal = 20.dp)) }
            }
            if (upNext.isNotEmpty()) {
                item { Text("Up next", style = Type.Title, color = Brand.White, modifier = Modifier.padding(start = 20.dp, top = 20.dp, bottom = 10.dp)) }
                items(upNext, key = { it.id }) { s -> SermonRow(s) { onOpen(s) } }
            }
        }
    }
}

@Composable
private fun OverlayIcon(icon: ImageVector, label: String, onClick: () -> Unit) {
    Box(Modifier.size(44.dp).clip(CircleShape).clickable(onClick = onClick), contentAlignment = Alignment.Center) {
        Icon(icon, label, tint = Color.White, modifier = Modifier.size(24.dp))
    }
}

@Composable
private fun ActionChip(icon: ImageVector, label: String, on: Boolean = false, onClick: () -> Unit) {
    Row(
        (if (on) Modifier.clip(RoundedCornerShape(50)).background(Color(0x33D4AF37)).border(1.dp, Color(0x55D4AF37), RoundedCornerShape(50)) else Modifier.glass())
            .clickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = if (on) Brand.Gold else Brand.White, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(7.dp))
        Text(label, color = if (on) Brand.GoldLight else Brand.White, fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 13.5.sp)
    }
}

@Composable
private fun SpeedSheet(speed: Float, pick: (Float) -> Unit, close: () -> Unit) {
    Box(Modifier.fillMaxSize().background(Color(0x99000000)).clickable(onClick = close), contentAlignment = Alignment.Center) {
        Column(Modifier.width(240.dp).clip(RoundedCornerShape(18.dp)).background(Color(0xFF1A1A1D)).clickable(enabled = false) {}.padding(vertical = 10.dp)) {
            Text("Playback speed", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp, modifier = Modifier.padding(horizontal = 18.dp, vertical = 8.dp))
            listOf(0.75f, 1f, 1.25f, 1.5f, 2f).forEach { v ->
                Row(Modifier.fillMaxWidth().clickable { pick(v); close() }.padding(horizontal = 18.dp, vertical = 11.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(if (v == 1f) "Normal" else "${v}x", color = if (v == speed) Brand.Gold else Color.White, modifier = Modifier.weight(1f))
                    if (v == speed) Icon(Icons.Rounded.Check, null, tint = Brand.Gold)
                }
            }
        }
    }
}

// When a sermon ends: the next one counts down and starts by itself.
@Composable
private fun EndCard(next: Sermon?, modifier: Modifier, replay: () -> Unit, playNext: (Sermon) -> Unit) {
    var left by remember(next?.id) { mutableIntStateOf(6) }
    LaunchedEffect(next?.id) { if (next != null) { while (left > 0) { delay(1000); left-- }; playNext(next) } }
    Row(modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(
            Modifier.clip(CircleShape).background(Color(0xCC000000)).clickable(onClick = replay).padding(14.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) { Icon(Icons.Rounded.Replay, "Replay", tint = Color.White, modifier = Modifier.size(28.dp)) }
        if (next != null) {
            Row(
                Modifier.clip(RoundedCornerShape(50)).background(Brand.Gold).clickable { playNext(next) }.padding(start = 12.dp, end = 18.dp, top = 10.dp, bottom = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Rounded.PlayArrow, null, tint = Brand.Black)
                Spacer(Modifier.width(4.dp))
                Text("Next in $left", color = Brand.Black, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            }
        }
    }
}

private fun pipParams(autoEnter: Boolean) = PictureInPictureParams.Builder().setAspectRatio(Rational(16, 9))
    .apply { if (Build.VERSION.SDK_INT >= 31) setAutoEnterEnabled(autoEnter) }.build()

private fun setAutoPip(activity: Activity, on: Boolean) {
    runCatching { activity.setPictureInPictureParams(pipParams(on)) }
}

private fun enterPip(activity: Activity) {
    runCatching { activity.enterPictureInPictureMode(pipParams(true)) }
}
