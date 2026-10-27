package com.shekinahsons.globalapp.playback

import android.content.ComponentName
import android.content.Context
import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.shekinahsons.globalapp.data.Sermon

// App-wide handle on the playback service, observable from Compose.
// uriFor lets a downloaded copy play instead of streaming.
class AudioController(private val context: Context, private val uriFor: (Sermon) -> String = { it.mediaUrl }) {
    private var controller: MediaController? = null
    private var pending: (() -> Unit)? = null

    var current by mutableStateOf<Sermon?>(null); private set
    var isPlaying by mutableStateOf(false); private set
    var isBuffering by mutableStateOf(false); private set
    var position by mutableLongStateOf(0L); private set
    var duration by mutableLongStateOf(0L); private set
    private var queue: List<Sermon> = emptyList()

    fun connect() {
        if (controller != null) return
        val token = SessionToken(context, ComponentName(context, PlaybackService::class.java))
        val future = MediaController.Builder(context, token).buildAsync()
        future.addListener({
            controller = future.get().also { c ->
                c.addListener(object : Player.Listener {
                    override fun onEvents(player: Player, events: Player.Events) = sync()
                })
            }
            pending?.invoke(); pending = null
            sync()
        }, ContextCompat.getMainExecutor(context))
    }

    private fun sync() {
        val c = controller ?: return
        isPlaying = c.isPlaying
        isBuffering = c.playbackState == Player.STATE_BUFFERING
        position = c.currentPosition.coerceAtLeast(0)
        duration = c.duration.takeIf { it > 0 } ?: 0
        if (queue.isNotEmpty()) current = queue.getOrNull(c.currentMediaItemIndex) ?: current
    }

    fun tick() = sync()

    fun play(sermon: Sermon, list: List<Sermon>) {
        if (current?.id == sermon.id && controller?.mediaItemCount != 0) { controller?.play(); return }
        val action = {
            val c = controller!!
            queue = list.ifEmpty { listOf(sermon) }
            current = sermon
            c.setMediaItems(queue.map { it.toMediaItem(uriFor(it)) }, queue.indexOfFirst { it.id == sermon.id }.coerceAtLeast(0), 0)
            c.prepare()
            c.play()
        }
        if (controller == null) { pending = action; connect() } else action()
    }

    // Stops playback and lets the mini player go away.
    fun close() {
        controller?.run { stop(); clearMediaItems() }
        queue = emptyList(); current = null; isPlaying = false; position = 0; duration = 0
    }

    fun toggle() { controller?.let { if (it.isPlaying) it.pause() else it.play() } }
    fun seekTo(ms: Long) { controller?.seekTo(ms); position = ms }
    fun back10() = controller?.seekBack()
    fun forward30() = controller?.seekForward()
    fun next() = controller?.seekToNextMediaItem()
    fun previous() = controller?.seekToPreviousMediaItem()
}

private fun Sermon.toMediaItem(uri: String) = MediaItem.Builder()
    .setMediaId(id)
    .setUri(uri)
    .setMediaMetadata(
        MediaMetadata.Builder()
            .setTitle(title)
            .setArtist(speaker)
            .setAlbumTitle("Shekinah Sons Global")
            .setArtworkUri(thumbnail.takeIf { it.isNotBlank() }?.let(Uri::parse))
            .build(),
    )
    .build()
