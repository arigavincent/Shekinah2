package com.shekinahsons.globalapp.bible

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.shekinahsons.globalapp.data.Api
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

// The Berean Standard Bible read by Bob Souer (public domain, CC0). One small
// file per chapter; the verse timings ship inside the app so the reading
// highlights verse by verse, and chapters a reader downloads play offline.
object BsbAudio {
    const val ATTRIBUTION = "Read by Bob Souer · BSB audio, public domain (CC0)"
    private const val FALLBACK_BASE = "https://pub-2b8b5f3f73a14e80bf09b789a9f1b87c.r2.dev/bible-audio/bsb-souer"
    // About 6 KB per second of reading (48 kbps).
    private const val BYTES_PER_SECOND = 6_000

    data class Chapter(val seconds: Double, val verses: List<Pair<Int, Long>>)

    @Volatile private var timing: Map<String, Chapter>? = null

    fun key(book: Int, chapter: Int) = "%02d_%03d".format(book, chapter)

    private fun load(context: Context): Map<String, Chapter> = timing ?: synchronized(this) {
        timing ?: runCatching {
            val root = Json.parseToJsonElement(context.assets.open("bsb_timing.json").bufferedReader().readText()).jsonObject
            root.mapValues { (_, v) ->
                val o = v.jsonObject
                Chapter(o["d"]!!.jsonPrimitive.double, o["v"]!!.jsonArray.map { p -> p.jsonArray.let { it[0].jsonPrimitive.int to (it[1].jsonPrimitive.double * 1000).toLong() } })
            }
        }.getOrDefault(emptyMap()).also { timing = it }
    }

    fun has(context: Context, book: Int, chapter: Int) = load(context).containsKey(key(book, chapter))
    fun timings(context: Context, book: Int, chapter: Int) = load(context)[key(book, chapter)]?.verses.orEmpty()

    private fun dir(context: Context) = File(context.filesDir, "bsb-audio").apply { mkdirs() }
    fun file(context: Context, book: Int, chapter: Int) = File(dir(context), key(book, chapter) + ".mp3")

    private fun prefs(context: Context) = context.getSharedPreferences("bsb-audio", Context.MODE_PRIVATE)
    fun base(context: Context): String = prefs(context).getString("base", null) ?: FALLBACK_BASE
    fun rememberBase(context: Context, base: String) { if (base.startsWith("https://")) prefs(context).edit().putString("base", base.trimEnd('/')).apply() }

    // Where to play a chapter from: the phone if downloaded, else the church's storage.
    fun source(context: Context, book: Int, chapter: Int): String =
        file(context, book, chapter).takeIf { it.exists() }?.toURI()?.toString() ?: "${base(context)}/${key(book, chapter)}.mp3"

    fun chapters(context: Context, book: Int) = load(context).keys.filter { it.startsWith("%02d_".format(book)) }.sorted()
    fun downloadedIn(context: Context, book: Int) = chapters(context, book).count { File(dir(context), "$it.mp3").exists() }
    fun bytesFor(context: Context, book: Int?) = load(context).filterKeys { book == null || it.startsWith("%02d_".format(book)) }.values.sumOf { it.seconds } * BYTES_PER_SECOND
    fun downloadedBytes(context: Context) = dir(context).listFiles().orEmpty().filter { it.extension == "mp3" }.sumOf { it.length() }
    fun downloadedChapters(context: Context) = dir(context).listFiles().orEmpty().count { it.extension == "mp3" }
    fun totalChapters(context: Context) = load(context).size

    fun downloading(context: Context) = prefs(context).getString("queue", "").orEmpty().isNotBlank()

    // Book ids to fetch (empty list = the whole Bible). Runs in the background
    // and survives leaving the screen; files already on the phone are skipped.
    fun download(context: Context, books: List<Int>) {
        val queue = (prefs(context).getString("queue", "").orEmpty().split(",").mapNotNull { it.toIntOrNull() } + (books.ifEmpty { (1..66).toList() })).distinct()
        prefs(context).edit().putString("queue", queue.joinToString(",")).apply()
        val work = OneTimeWorkRequestBuilder<BsbAudioWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork("bsb-audio", ExistingWorkPolicy.KEEP, work)
    }

    fun cancel(context: Context) {
        prefs(context).edit().remove("queue").apply()
        WorkManager.getInstance(context).cancelUniqueWork("bsb-audio")
    }

    fun remove(context: Context, book: Int?) {
        dir(context).listFiles().orEmpty().filter { book == null || it.name.startsWith("%02d_".format(book)) }.forEach { it.delete() }
    }

    internal suspend fun runQueue(context: Context, stopped: () -> Boolean) = withContext(Dispatchers.IO) {
        // Ask the server where the recordings live now (it may move to the church's own server).
        runCatching { Api.get("/bible/audio/eng_bsb/GEN/1")["base"]?.jsonPrimitive?.content }.getOrNull()?.let { rememberBase(context, it) }
        while (!stopped()) {
            val queue = prefs(context).getString("queue", "").orEmpty().split(",").mapNotNull { it.toIntOrNull() }
            val book = queue.firstOrNull() ?: break
            for (k in chapters(context, book)) {
                if (stopped()) return@withContext
                val out = File(dir(context), "$k.mp3")
                if (out.exists()) continue
                val part = File(dir(context), "$k.part")
                val conn = URL("${base(context)}/$k.mp3").openConnection() as HttpURLConnection
                conn.connectTimeout = 20_000; conn.readTimeout = 60_000
                try {
                    if (conn.responseCode != 200) throw java.io.IOException("HTTP ${conn.responseCode}")
                    conn.inputStream.use { input -> part.outputStream().use { input.copyTo(it) } }
                    part.renameTo(out)
                } finally { conn.disconnect(); part.delete() }
            }
            prefs(context).edit().putString("queue", queue.drop(1).joinToString(",")).apply()
        }
    }
}

class BsbAudioWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result = try {
        BsbAudio.runQueue(applicationContext) { isStopped }
        Result.success()
    } catch (e: Exception) {
        if (e is kotlinx.coroutines.CancellationException) throw e
        if (runAttemptCount < 10) Result.retry() else Result.failure(workDataOf("error" to (e.message ?: "Download failed")))
    }
}
