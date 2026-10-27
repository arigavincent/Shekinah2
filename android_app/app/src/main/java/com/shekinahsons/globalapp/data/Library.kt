package com.shekinahsons.globalapp.data

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateSetOf
import androidx.compose.runtime.setValue
import java.io.File

// The listener's own shelf: saved (hearted) sermons and offline downloads.
// Both live on the device only.
class Library(private val context: Context) {
    private val prefs = context.getSharedPreferences("library", Context.MODE_PRIVATE)

    val saved = mutableStateSetOf<String>().apply { addAll(prefs.getStringSet("saved", emptySet()).orEmpty()) }
    val downloading = mutableStateSetOf<String>()

    fun isSaved(id: String) = id in saved

    fun toggleSaved(id: String) {
        if (!saved.remove(id)) saved.add(id)
        prefs.edit().putStringSet("saved", saved.toSet()).apply()
    }

    private fun fileFor(s: Sermon): File {
        val ext = s.mediaUrl.substringAfterLast('.', "").substringBefore('?').takeIf { it.length in 2..4 } ?: "mp4"
        val dir = if (s.type == "audio") Environment.DIRECTORY_MUSIC else Environment.DIRECTORY_MOVIES
        return File(context.getExternalFilesDir(dir), "${s.id}.$ext")
    }

    fun isDownloaded(s: Sermon) = s.id !in downloading && fileFor(s).let { it.exists() && it.length() > 0 }

    // Plays from the phone when a copy is there, otherwise streams.
    fun playableUri(s: Sermon): String = if (isDownloaded(s)) Uri.fromFile(fileFor(s)).toString() else s.mediaUrl

    fun download(s: Sermon) {
        if (s.mediaUrl.isBlank() || isDownloaded(s) || s.id in downloading) return
        val target = fileFor(s)
        val request = DownloadManager.Request(Uri.parse(s.mediaUrl))
            .setTitle(s.title)
            .setDescription("Shekinah Sons Global")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationUri(Uri.fromFile(target))
        val manager = context.getSystemService(DownloadManager::class.java)
        val id = manager.enqueue(request)
        downloading.add(s.id)
        // Poll the download in the background and clear the spinner when done.
        Thread {
            while (true) {
                Thread.sleep(1000)
                manager.query(DownloadManager.Query().setFilterById(id)).use { c ->
                    if (!c.moveToFirst()) { downloading.remove(s.id); return@Thread }
                    when (c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))) {
                        DownloadManager.STATUS_SUCCESSFUL, DownloadManager.STATUS_FAILED -> { downloading.remove(s.id); return@Thread }
                    }
                }
            }
        }.start()
    }

    fun delete(s: Sermon) { fileFor(s).delete(); downloading.remove(s.id) }

    // Where each sermon was left (position, length, when), so it resumes
    // instead of starting over and can be offered under Continue.
    data class Progress(val position: Long, val duration: Long, val at: Long) {
        val fraction get() = if (duration > 0) (position.toFloat() / duration).coerceIn(0f, 1f) else 0f
        val leftMs get() = (duration - position).coerceAtLeast(0)
    }
    private val progress = context.getSharedPreferences("progress2", Context.MODE_PRIVATE)
    // Bumped on every save so screens showing progress redraw.
    var progressVersion by androidx.compose.runtime.mutableIntStateOf(0)
        private set

    fun savePosition(id: String, positionMs: Long, durationMs: Long) {
        // Near the end counts as finished: next time it starts from the top.
        val keep = positionMs > 10_000 && (durationMs <= 0 || positionMs < durationMs - 20_000)
        progress.edit().apply { if (keep) putString(id, "$positionMs,$durationMs,${System.currentTimeMillis()}") else remove(id) }.apply()
        progressVersion++
    }

    fun progressOf(id: String): Progress? = progress.getString(id, null)?.split(',')?.let { p ->
        val pos = p.getOrNull(0)?.toLongOrNull() ?: return null
        Progress(pos, p.getOrNull(1)?.toLongOrNull() ?: 0, p.getOrNull(2)?.toLongOrNull() ?: 0)
    }

    fun position(id: String): Long = progressOf(id)?.position ?: 0L

    // Started but not finished, most recent first.
    fun inProgress(all: List<Sermon>): List<Pair<Sermon, Progress>> =
        all.mapNotNull { s -> progressOf(s.id)?.let { s to it } }.sortedByDescending { it.second.at }
}
