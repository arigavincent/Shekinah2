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
    private val prefs get() = Accounts.prefs(context,"library")

    val saved = mutableStateSetOf<String>().apply { addAll(prefs.getStringSet("saved", emptySet()).orEmpty()) }

    fun catalogue(): List<Sermon> = runCatching { Api.json.decodeFromString<List<Sermon>>(Accounts.prefs(context,"sermon-catalogue").getString("items","[]")!!) }.getOrDefault(emptyList())
    fun remember(s:Sermon) { val items=(listOf(s)+catalogue()).distinctBy{it.id}.take(500);Accounts.prefs(context,"sermon-catalogue").edit().putString("items",Api.json.encodeToString(kotlinx.serialization.builtins.ListSerializer(Sermon.serializer()),items)).apply();version++ }
    fun isSaved(id: String) = id in saved

    fun toggleSaved(id: String) {
        if (!saved.remove(id)) saved.add(id)
        prefs.edit().putStringSet("saved", saved.toSet()).apply()
    }

    // Downloads are encrypted into the app's private storage (see Vault
    // files below): they play inside the app and nowhere else.
    val downloading get() = transfers.filterValues { it.state in listOf("Downloading","Waiting for connection") }.mapKeys { it.key.removePrefix("sermon-${Accounts.current}-") }.mapValues { it.value.progress }
    val transfers get() = Downloads.entries.filterKeys { it.startsWith("sermon-${Accounts.current}-") }
    private fun vaultId(s: Sermon) = "sermon-${Accounts.current}-${s.id}"
    fun transfer(s: Sermon) = Downloads.entries[vaultId(s)]
    fun isDownloaded(s: Sermon) = VaultFiles.has(context,vaultId(s)) || VaultFiles.has(context,s.id)
    fun playableUri(s: Sermon): String = when {
        VaultFiles.has(context,vaultId(s)) -> VaultFiles.uri(vaultId(s))
        VaultFiles.has(context,s.id) -> VaultFiles.uri(s.id)
        else -> s.mediaUrl
    }
    fun download(s: Sermon) { remember(s); if(s.mediaUrl.isNotBlank() && !isDownloaded(s)) Downloads.start(context,vaultId(s),s.mediaUrl,if(s.id.startsWith("replay-")) Api.token else null) }
    fun pause(s: Sermon) = Downloads.pause(context,vaultId(s))
    fun cancel(s: Sermon) { scope.launch { Downloads.cancel(context,vaultId(s)) } }
    fun delete(s: Sermon) { scope.launch { Downloads.cancel(context,vaultId(s)); VaultFiles.delete(context,s.id); version++ } }
    private val scope=kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.SupervisorJob()+kotlinx.coroutines.Dispatchers.Main)

    // Bumped when a download finishes or is removed.
    var version by androidx.compose.runtime.mutableIntStateOf(0)
        private set

    init {
        Accounts.changed += { saved.clear(); saved.addAll(prefs.getStringSet("saved",emptySet()).orEmpty()); progressVersion++; version++ }
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
    private val progress get() = Accounts.prefs(context,"progress2")
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
