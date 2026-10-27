package com.shekinahsons.globalapp.data

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import androidx.compose.runtime.mutableStateSetOf
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
}
