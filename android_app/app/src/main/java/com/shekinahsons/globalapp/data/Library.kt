package com.shekinahsons.globalapp.data

import android.content.Context
import android.os.Environment
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateSetOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.launch

// The listener's own shelf: saved (hearted) sermons and offline downloads.
// Both live on the device only.
class Library(private val context: Context) {
    private val prefs = context.getSharedPreferences("library", Context.MODE_PRIVATE)

    val saved = mutableStateSetOf<String>().apply { addAll(prefs.getStringSet("saved", emptySet()).orEmpty()) }

    fun isSaved(id: String) = id in saved

    fun toggleSaved(id: String) {
        if (!saved.remove(id)) saved.add(id)
        prefs.edit().putStringSet("saved", saved.toSet()).apply()
    }

    // Downloads are encrypted into the app's private storage (see Vault
    // files below): they play inside the app and nowhere else.
    val downloading = androidx.compose.runtime.mutableStateMapOf<String, Float>()
    private val scope = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.SupervisorJob() + kotlinx.coroutines.Dispatchers.IO)

    fun isDownloaded(s: Sermon) = s.id !in downloading && VaultFiles.has(context, s.id)

    // Plays from the encrypted copy when there is one, otherwise streams.
    fun playableUri(s: Sermon): String = if (isDownloaded(s)) VaultFiles.uri(s.id) else s.mediaUrl

    fun download(s: Sermon) {
        if (s.mediaUrl.isBlank() || isDownloaded(s) || s.id in downloading) return
        downloading[s.id] = 0f
        scope.launch {
            val ok = runCatching { VaultFiles.save(context, s.id, s.mediaUrl) { downloading[s.id] = it } }.isSuccess
            downloading.remove(s.id)
            if (ok) version++
        }
    }

    fun delete(s: Sermon) { VaultFiles.delete(context, s.id); downloading.remove(s.id); version++ }

    // Bumped when a download finishes or is removed.
    var version by androidx.compose.runtime.mutableIntStateOf(0)
        private set

    init {
        // Earlier builds saved plain copies in shared storage; remove them.
        listOf(Environment.DIRECTORY_MUSIC, Environment.DIRECTORY_MOVIES).forEach { dir ->
            context.getExternalFilesDir(dir)?.listFiles()?.forEach { it.delete() }
        }
    }

    // Every sermon opened (the watch history), with where it was left so it
    // resumes instead of starting over.
    data class Progress(val position: Long, val duration: Long, val at: Long, val finished: Boolean = false) {
        val fraction get() = if (finished) 1f else if (duration > 0) (position.toFloat() / duration).coerceIn(0f, 1f) else 0f
        val leftMs get() = (duration - position).coerceAtLeast(0)
    }
    private val progress = context.getSharedPreferences("progress2", Context.MODE_PRIVATE)
    // Bumped on every save so screens showing progress redraw.
    var progressVersion by androidx.compose.runtime.mutableIntStateOf(0)
        private set

    // Recorded as soon as a sermon is opened, even for a moment.
    fun opened(id: String) {
        val p = progressOf(id)
        progress.edit().putString(id, "${p?.position ?: 0},${p?.duration ?: 0},${System.currentTimeMillis()},${if (p?.finished == true) 1 else 0}").apply()
        progressVersion++
    }

    fun savePosition(id: String, positionMs: Long, durationMs: Long) {
        // Near the end counts as finished: it stays in the history and starts from the top next time.
        val finished = durationMs > 0 && positionMs >= durationMs - 20_000
        val resume = if (positionMs > 10_000 && !finished) positionMs else 0
        val wasFinished = progressOf(id)?.finished == true
        progress.edit().putString(id, "$resume,$durationMs,${System.currentTimeMillis()},${if (finished || (wasFinished && resume == 0L)) 1 else 0}").apply()
        progressVersion++
    }

    fun progressOf(id: String): Progress? = progress.getString(id, null)?.split(',')?.let { p ->
        val pos = p.getOrNull(0)?.toLongOrNull() ?: return null
        Progress(pos, p.getOrNull(1)?.toLongOrNull() ?: 0, p.getOrNull(2)?.toLongOrNull() ?: 0, p.getOrNull(3) == "1")
    }

    fun position(id: String): Long = progressOf(id)?.position ?: 0L

    // Everything opened, most recent first.
    fun history(all: List<Sermon>): List<Pair<Sermon, Progress>> =
        all.mapNotNull { s -> progressOf(s.id)?.let { s to it } }.sortedByDescending { it.second.at }

    fun forget(id: String) { progress.edit().remove(id).apply(); progressVersion++ }
    fun clearHistory() { progress.edit().clear().apply(); progressVersion++ }
}
