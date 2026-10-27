package com.shekinahsons.globalapp.ui.screens

import android.app.Activity
import android.content.pm.ActivityInfo
import android.view.ViewGroup
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Forward30
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Replay10
import androidx.compose.material.icons.rounded.SkipNext
import androidx.compose.material.icons.rounded.SkipPrevious
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import com.shekinahsons.globalapp.data.Sermon
import com.shekinahsons.globalapp.playback.AudioController
import com.shekinahsons.globalapp.ui.components.AmbientGlow
import com.shekinahsons.globalapp.ui.components.AudioCover
import com.shekinahsons.globalapp.ui.components.Breathing
import com.shekinahsons.globalapp.ui.components.ColorGlow
import com.shekinahsons.globalapp.ui.components.SermonPoster
import com.shekinahsons.globalapp.ui.components.TopBar
import com.shekinahsons.globalapp.ui.components.audioGlowColor
import com.shekinahsons.globalapp.ui.components.pressable
import com.shekinahsons.globalapp.ui.components.outset
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Type
import kotlinx.coroutines.delay

private fun clock(ms: Long): String {
    val s = (ms / 1000).coerceAtLeast(0)
    return if (s >= 3600) "%d:%02d:%02d".format(s / 3600, s / 60 % 60, s % 60) else "%d:%02d".format(s / 60, s % 60)
}

@Composable
fun AudioPlayerScreen(sermon: Sermon, queue: List<Sermon>, audio: AudioController, onBack: () -> Unit) {
    LaunchedEffect(sermon.id) { audio.play(sermon, queue) }
    LaunchedEffect(Unit) { while (true) { audio.tick(); delay(500) } }
    val now = audio.current ?: sermon
    val glow = Breathing(if (audio.isPlaying) 2600 else 6000, 0.55f, 1f)
    var scrub by remember { mutableStateOf<Float?>(null) }

    Box(Modifier.fillMaxSize().background(Brand.Black)) {
        // Whole-page wash in the cover's colour.
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(audioGlowColor(now).copy(alpha = 0.32f), Brand.Black, Brand.Black))))
        Column(Modifier.fillMaxSize().navigationBarsPadding(), horizontalAlignment = Alignment.CenterHorizontally) {
            TopBar(title = "Now Playing", onBack = onBack)
            Spacer(Modifier.weight(0.6f))
            Box(Modifier.padding(horizontal = 40.dp), contentAlignment = Alignment.Center) {
                ColorGlow(audioGlowColor(now).copy(alpha = 0.85f * glow), Modifier.matchParentSize().padding(14.dp).graphicsLayer { scaleX = 0.94f + 0.08f * glow; scaleY = scaleX }, blur = 46.dp)
                AudioCover(now, Modifier.fillMaxWidth().aspectRatio(1f).clip(RoundedCornerShape(24.dp)))
            }
            Spacer(Modifier.weight(0.5f))
            Column(Modifier.padding(horizontal = 28.dp).fillMaxWidth()) {
                Text(now.title, style = Type.Display.copy(fontSize = 23.sp), color = Brand.White, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(4.dp))
                Text(now.speaker, color = Brand.GoldLight, fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 15.sp)
                Spacer(Modifier.height(18.dp))
                val dur = audio.duration.coerceAtLeast(1)
                Slider(
                    value = scrub ?: (audio.position.toFloat() / dur).coerceIn(0f, 1f),
                    onValueChange = { scrub = it },
                    onValueChangeFinished = { scrub?.let { audio.seekTo((it * dur).toLong()) }; scrub = null },
                    colors = SliderDefaults.colors(thumbColor = Brand.Gold, activeTrackColor = Brand.Gold, inactiveTrackColor = Color(0x33FFFFFF)),
                )
                Row {
                    Text(clock(scrub?.let { (it * dur).toLong() } ?: audio.position), style = Type.Meta, color = Brand.Text2)
                    Spacer(Modifier.weight(1f))
                    Text(if (audio.duration > 0) clock(audio.duration) else now.duration, style = Type.Meta, color = Brand.Text2)
                }
                Spacer(Modifier.height(16.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) {
                    RoundIcon(Icons.Rounded.SkipPrevious, "Previous", 26) { audio.previous() }
                    RoundIcon(Icons.Rounded.Replay10, "Back 10 seconds", 30) { audio.back10() }
                    Box(
                        Modifier.size(76.dp).clip(CircleShape).background(Brand.GoldGradient).pressable { audio.toggle() },
                        contentAlignment = Alignment.Center,
                    ) {
                        if (audio.isBuffering) CircularProgressIndicator(color = Brand.Black, strokeWidth = 3.dp, modifier = Modifier.size(30.dp))
                        else Icon(if (audio.isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow, if (audio.isPlaying) "Pause" else "Play", tint = Brand.Black, modifier = Modifier.size(40.dp))
                    }
                    RoundIcon(Icons.Rounded.Forward30, "Forward 30 seconds", 30) { audio.forward30() }
                    RoundIcon(Icons.Rounded.SkipNext, "Next", 26) { audio.next() }
                }
            }
            Spacer(Modifier.weight(0.7f))
        }
    }
}

@Composable
private fun RoundIcon(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, size: Int, onClick: () -> Unit) {
    Box(Modifier.size(52.dp).clip(CircleShape).pressable(onClick), contentAlignment = Alignment.Center) {
        Icon(icon, label, tint = Brand.White, modifier = Modifier.size(size.dp))
    }
}

@Composable
fun VideoPlayerScreen(sermon: Sermon, queue: List<Sermon>, uriFor: (Sermon) -> String, onOpen: (Sermon) -> Unit, onBack: () -> Unit) {
    val context = LocalContext.current
    val activity = context as Activity
    var fullscreen by remember { mutableStateOf(false) }
    val player = remember {
        ExoPlayer.Builder(context).setSeekBackIncrementMs(10_000).setSeekForwardIncrementMs(10_000).build()
    }
    LaunchedEffect(sermon.id) {
        player.setMediaItem(MediaItem.fromUri(uriFor(sermon)))
        player.prepare()
        player.playWhenReady = true
    }
    DisposableEffect(Unit) {
        onDispose {
            player.release()
            activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            WindowInsetsControllerCompat(activity.window, activity.window.decorView).show(WindowInsetsCompat.Type.systemBars())
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
        onDispose {}
    }
    BackHandler { if (fullscreen) fullscreen = false else onBack() }

    val video: @Composable (Modifier) -> Unit = { m ->
        AndroidView(
            factory = {
                PlayerView(it).apply {
                    this.player = player
                    layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
                    setShowSubtitleButton(false)
                    setFullscreenButtonClickListener { full -> fullscreen = full }
                    setFullscreenButtonState(fullscreen)
                    setBackgroundColor(android.graphics.Color.BLACK)
                }
            },
            update = { it.setFullscreenButtonState(fullscreen) },
            modifier = m,
        )
    }

    if (fullscreen) {
        Box(Modifier.fillMaxSize().background(Color.Black)) { video(Modifier.fillMaxSize()) }
        return
    }

    val upNext = queue.filter { it.id != sermon.id }
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
                    video(Modifier.fillMaxWidth().aspectRatio(16 / 9f).clip(RoundedCornerShape(16.dp)))
                }
            }
            item {
                Column(Modifier.padding(20.dp)) {
                    if (sermon.category.isNotBlank()) Text(sermon.category.uppercase(), style = Type.Label, color = Brand.Gold)
                    Spacer(Modifier.height(6.dp))
                    Text(sermon.title, style = Type.Display.copy(fontSize = 22.sp), color = Brand.White)
                    Spacer(Modifier.height(6.dp))
                    Text(listOf(sermon.speaker, sermon.date, sermon.duration).filter { it.isNotBlank() }.joinToString(" · "), style = Type.Meta, color = Brand.Text2)
                    if (sermon.description.isNotBlank()) {
                        Spacer(Modifier.height(14.dp))
                        Text(sermon.description, style = Type.Body, color = Brand.Text2)
                    }
                }
            }
            if (upNext.isNotEmpty()) {
                item { Text("Up next", style = Type.Title, color = Brand.White, modifier = Modifier.padding(start = 20.dp, top = 8.dp, bottom = 10.dp)) }
                items(upNext, key = { it.id }) { s -> SermonRow(s) { onOpen(s) } }
            }
        }
    }
}

@Composable
fun SermonRow(s: Sermon, audio: Boolean = false, onOpen: () -> Unit) {
    Row(Modifier.fillMaxWidth().pressable(onOpen).padding(horizontal = 20.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        if (audio) AudioCover(s, Modifier.size(84.dp).clip(RoundedCornerShape(12.dp)))
        else SermonPoster(s, Modifier.width(150.dp).aspectRatio(16 / 9f).clip(RoundedCornerShape(12.dp)), compact = true)
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(s.title, style = Type.CardTitle, color = Brand.White, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.height(4.dp))
            Text(s.speaker, style = Type.Meta, color = Brand.GoldLight, maxLines = 1)
            Text(listOf(s.date, s.duration).filter { it.isNotBlank() }.joinToString(" · "), style = Type.Meta, color = Brand.Muted, maxLines = 1)
        }
    }
}

// Shown at the bottom of tab screens while audio is loaded.
@Composable
fun MiniPlayer(audio: AudioController, onOpen: () -> Unit, modifier: Modifier = Modifier) {
    val s = audio.current ?: return
    Row(
        modifier.padding(horizontal = 14.dp).fillMaxWidth().clip(RoundedCornerShape(18.dp))
            .background(Color(0xF21E1B12)).pressable(onOpen).padding(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        AudioCover(s, Modifier.size(46.dp).clip(RoundedCornerShape(10.dp)))
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(s.title, style = Type.CardTitle.copy(fontSize = 14.sp), color = Brand.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(s.speaker, style = Type.Meta, color = Brand.GoldLight, maxLines = 1)
        }
        Box(Modifier.size(44.dp).clip(CircleShape).background(Brand.Gold).pressable { audio.toggle() }, contentAlignment = Alignment.Center) {
            Icon(if (audio.isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow, if (audio.isPlaying) "Pause" else "Play", tint = Brand.Black)
        }
    }
}
