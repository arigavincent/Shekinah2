package com.shekinahsons.globalapp.ui.screens

import android.app.Activity
import android.content.pm.ActivityInfo
import android.view.ViewGroup
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.DownloadDone
import androidx.compose.material.icons.rounded.Shuffle
import androidx.compose.material.icons.rounded.Repeat
import androidx.compose.material.icons.rounded.RepeatOne
import androidx.compose.material.icons.rounded.Notes
import androidx.compose.material.icons.rounded.Close
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
import com.shekinahsons.globalapp.ui.components.glass
import com.shekinahsons.globalapp.ui.components.AudioCover
import com.shekinahsons.globalapp.ui.components.Breathing
import com.shekinahsons.globalapp.ui.components.ColorGlow
import com.shekinahsons.globalapp.ui.components.SermonPoster
import com.shekinahsons.globalapp.ui.components.TopBar
import com.shekinahsons.globalapp.ui.components.audioGlowColor
import com.shekinahsons.globalapp.ui.components.pressable
import com.shekinahsons.globalapp.ui.components.lifted
import androidx.compose.foundation.border
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
fun AudioPlayerScreen(sermon: Sermon, queue: List<Sermon>, audio: AudioController, openReference: (String) -> Unit = {}, library: com.shekinahsons.globalapp.data.Library? = null, onBack: () -> Unit) {
    LaunchedEffect(sermon.id) { audio.play(sermon, queue) }
    LaunchedEffect(Unit) { while (true) { audio.tick(); delay(500) } }
    val now = audio.current ?: sermon
    val glow = Breathing(if (audio.isPlaying) 2600 else 6000, 0.55f, 1f)
    var scrub by remember { mutableStateOf<Float?>(null) }

    Box(Modifier.fillMaxSize().background(Brand.Black)) {
        // The cover itself, blurred and glowing across the whole screen, so the
        // page takes on each sermon's colours; darker at the bottom for the controls.
        AmbientGlow(now.thumbnail, Modifier.fillMaxSize(), blur = 90.dp, alpha = 0.95f)
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color(0x33000000), 0.45f to Color(0x66000000), 1f to Color(0xF2000000))))
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(audioGlowColor(now).copy(alpha = 0.22f), Color.Transparent))))
        Column(Modifier.fillMaxSize().navigationBarsPadding(), horizontalAlignment = Alignment.CenterHorizontally) {
            TopBar(title = "Now Playing", onBack = onBack)
            Row(verticalAlignment = Alignment.CenterVertically) {
                androidx.compose.foundation.Image(androidx.compose.ui.res.painterResource(com.shekinahsons.globalapp.R.drawable.dove_mark), null, Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text("SHEKINAH SONS GLOBAL", color = Brand.GoldLight, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 11.sp, letterSpacing = 2.sp)
            }
            Spacer(Modifier.weight(0.6f))
            Box(Modifier.padding(horizontal = 40.dp), contentAlignment = Alignment.Center) {
                ColorGlow(audioGlowColor(now).copy(alpha = 0.85f * glow), Modifier.matchParentSize().padding(14.dp).graphicsLayer { scaleX = 0.94f + 0.08f * glow; scaleY = scaleX }, blur = 46.dp)
                AudioCover(now, Modifier.fillMaxWidth().aspectRatio(1f).clip(RoundedCornerShape(24.dp)))
            }
            Spacer(Modifier.weight(0.5f))
            Column(Modifier.padding(horizontal = 28.dp).fillMaxWidth()) {
                Text(now.title, style = Type.Display.copy(fontSize = 23.sp), color = Brand.White, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(now.speaker, color = Brand.GoldLight, fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                    // Download while listening, with progress.
                    if (library != null && now.youtubeId.isBlank()) {
                        val pct = library.downloading[now.id]
                        val done = pct == null && library.isDownloaded(now)
                        Row(
                            Modifier.clip(RoundedCornerShape(50)).background(if (done) Color(0x33D4AF37) else Color(0x26FFFFFF))
                                .clickable(enabled = pct == null && !done) { library.download(now) }
                                .padding(horizontal = 12.dp, vertical = 7.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(if (done) Icons.Rounded.DownloadDone else Icons.Rounded.Download, null, tint = if (done) Brand.Gold else Brand.White, modifier = Modifier.size(17.dp))
                            Spacer(Modifier.width(5.dp))
                            Text(when { done -> "Downloaded"; pct != null -> "${(pct * 100).toInt()}%"; else -> "Download" }, color = Brand.White, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 12.5.sp)
                        }
                    }
                }
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
                Spacer(Modifier.height(10.dp))
                // Shuffle, repeat, playlists and notes.
                var notesOpen by remember { mutableStateOf(false) }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.Shuffle, if (audio.shuffle) "Shuffle on" else "Shuffle off", tint = if (audio.shuffle) Brand.Gold else Brand.Text2,
                        modifier = Modifier.size(44.dp).clip(CircleShape).clickable { audio.toggleShuffle() }.padding(10.dp))
                    AddToPlaylistChip(now)
                    Row(Modifier.clip(RoundedCornerShape(50)).glass().clickable { notesOpen = true }.padding(horizontal = 14.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Rounded.Notes, null, tint = Brand.GoldLight, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp)); Text("Notes", color = Brand.White, fontSize = 13.sp)
                    }
                    Icon(if (audio.repeat == androidx.media3.common.Player.REPEAT_MODE_ONE) Icons.Rounded.RepeatOne else Icons.Rounded.Repeat,
                        when (audio.repeat) { androidx.media3.common.Player.REPEAT_MODE_ALL -> "Repeat all"; androidx.media3.common.Player.REPEAT_MODE_ONE -> "Repeat this sermon"; else -> "Repeat off" },
                        tint = if (audio.repeat != androidx.media3.common.Player.REPEAT_MODE_OFF) Brand.Gold else Brand.Text2,
                        modifier = Modifier.size(44.dp).clip(CircleShape).clickable { audio.cycleRepeat() }.padding(10.dp))
                }
                if (notesOpen) NotesSheet(now, openReference) { notesOpen = false }
            }
            Spacer(Modifier.weight(0.7f))
        }
    }
}

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
private fun NotesSheet(sermon: Sermon, openReference: (String) -> Unit, close: () -> Unit) {
    androidx.compose.material3.ModalBottomSheet(onDismissRequest = close, containerColor = Color(0xFF16161A)) {
        Column(Modifier.fillMaxWidth().navigationBarsPadding().verticalScroll(rememberScrollState()).padding(bottom = 20.dp)) {
            Text(sermon.title, style = Type.Title, color = Brand.White, modifier = Modifier.padding(horizontal = 20.dp))
            SermonNotesSection(sermon) { ref -> close(); openReference(ref) }
            if (sermon.description.isBlank()) Text("Notes appear here when the church adds them to this sermon.", style = Type.Body, color = Brand.Text2, modifier = Modifier.padding(20.dp))
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

// Shown above the tab bar while audio is loaded: a frosted pane with the
// cover, a thin progress line, play/pause and a close button.
@Composable
fun MiniPlayer(audio: AudioController, onOpen: () -> Unit, modifier: Modifier = Modifier) {
    val s = audio.current ?: return
    LaunchedEffect(s.id) { while (true) { audio.tick(); delay(1000) } }
    val shape = RoundedCornerShape(20.dp)
    Box(modifier.padding(horizontal = 12.dp, vertical = 8.dp).fillMaxWidth().lifted(shape, 18.dp)) {
        Column(
            Modifier.fillMaxWidth().clip(shape)
                .background(Brush.linearGradient(listOf(Color(0xF2272114), Color(0xF2141418))))
                .border(1.dp, Brush.verticalGradient(listOf(Color(0x40F0D27A), Color(0x0FFFFFFF))), shape),
        ) {
            Row(Modifier.pressable(onOpen).padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                AudioCover(s, Modifier.size(46.dp).clip(RoundedCornerShape(11.dp)))
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(s.title, style = Type.CardTitle.copy(fontSize = 14.sp), color = Brand.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(s.speaker, style = Type.Meta, color = Brand.GoldLight, maxLines = 1)
                }
                Box(Modifier.size(42.dp).clip(CircleShape).background(Brand.GoldGradient).pressable { audio.toggle() }, contentAlignment = Alignment.Center) {
                    if (audio.isBuffering) CircularProgressIndicator(color = Brand.Black, strokeWidth = 2.dp, modifier = Modifier.size(18.dp))
                    else Icon(if (audio.isPlaying) Icons.Rounded.Pause else Icons.Rounded.PlayArrow, if (audio.isPlaying) "Pause" else "Play", tint = Brand.Black)
                }
                Spacer(Modifier.width(4.dp))
                Box(Modifier.size(40.dp).clip(CircleShape).pressable { audio.close() }, contentAlignment = Alignment.Center) {
                    Icon(Icons.Rounded.Close, "Close player", tint = Brand.Text2, modifier = Modifier.size(22.dp))
                }
            }
            val progress = if (audio.duration > 0) (audio.position.toFloat() / audio.duration).coerceIn(0f, 1f) else 0f
            Box(Modifier.fillMaxWidth().height(2.dp).background(Color(0x22FFFFFF))) {
                Box(Modifier.fillMaxWidth(progress).height(2.dp).background(Brand.GoldGradient))
            }
        }
    }
}
