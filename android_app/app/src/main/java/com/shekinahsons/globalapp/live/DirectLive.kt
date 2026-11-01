package com.shekinahsons.globalapp.live

import android.content.Context
import android.os.SystemClock
import androidx.work.*
import com.shekinahsons.globalapp.data.*
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

@Serializable data class DirectJob(val session: String, val account: String, val auth: String)
@Serializable data class DirectChunk(val sequence: Int, val duration: Double, val size: Long, val sha256: String)
object DirectLive {
    // Segments are reserved in order but up to this many travel at once, so one
    // slow round trip to the API no longer holds back the whole broadcast.
    private const val IN_FLIGHT = 4
    // One drain at a time per phone, shared by the live loop and the fallback worker.
    private val serial = Mutex()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var loop: Job? = null
    private var wake = Channel<Unit>(Channel.CONFLATED)

    fun folder(c: Context, id: String) = File(c.filesDir, "live-outbox/$id")
    fun prepare(c: Context, id: String): File {
        require(Regex("live-[a-f0-9]{12}").matches(id))
        val dir = folder(c, id); dir.mkdirs()
        File(dir, "session.json").writeText(Api.json.encodeToString(DirectJob(id, Accounts.current, Vault.seal(Api.token ?: error("Sign in first")))))
        return dir
    }
    fun save(c: Context, id: String, file: File, duration: Double, key: String) {
        val root = File(c.filesDir, "live-outbox")
        val total = root.walkTopDown().filter { it.isFile }.sumOf { it.length() }
        check(total <= 128L * 1024 * 1024) { "Upload backlog is full. Reconnect before continuing." }
        val cipher = javax.crypto.Cipher.getInstance("AES/CBC/PKCS5Padding")
        val sequence = file.nameWithoutExtension.toInt()
        val iv = java.nio.ByteBuffer.allocate(16).putLong(0).putLong(sequence.toLong()+1).array()
        cipher.init(javax.crypto.Cipher.ENCRYPT_MODE,javax.crypto.spec.SecretKeySpec(android.util.Base64.decode(key,android.util.Base64.DEFAULT),"AES"),javax.crypto.spec.IvParameterSpec(iv))
        val sealed = File(file.path+".sealed")
        javax.crypto.CipherOutputStream(sealed.outputStream(),cipher).use { out -> file.inputStream().use { it.copyTo(out) } }
        check(sealed.renameTo(file))
        val hash = MessageDigest.getInstance("SHA-256"); file.inputStream().use { input -> val b = ByteArray(65536); while (true) { val n = input.read(b); if (n < 0) break; hash.update(b, 0, n) } }
        val chunk = DirectChunk(file.nameWithoutExtension.toInt(), duration, file.length(), hash.digest().joinToString("") { "%02x".format(it) })
        val meta = File(file.parentFile, file.nameWithoutExtension + ".json")
        val tmp = File(meta.path + ".tmp"); tmp.writeText(Api.json.encodeToString(chunk)); check(tmp.renameTo(meta))
        wake.trySend(Unit)
        // Safety net only: if the app is killed mid-service, the worker finishes the upload.
        // The final segment, sealed after End, goes straight away.
        if (File(file.parentFile, "ended").exists()) enqueue(c, id) else enqueue(c, id, ExistingWorkPolicy.KEEP, 30)
    }

    // Runs while broadcasting: uploads each segment the moment it is sealed.
    fun startUploading(c: Context, id: String) {
        loop?.cancel()
        wake = Channel(Channel.CONFLATED)
        val signal = wake
        loop = scope.launch {
            while (isActive) {
                runCatching { drain(c.applicationContext, id) { !isActive } }
                    .onFailure { if (it !is CancellationException) Broadcast.directInterrupted(id, it.message ?: "Recording upload interrupted") }
                // Woken by each new segment; the timeout retries after a dropped connection.
                withTimeoutOrNull(1_000) { signal.receive() }
            }
        }
    }
    fun stopUploading(c: Context, id: String) {
        loop?.cancel(); loop = null
        File(folder(c, id), "ended").writeText("1")
        enqueue(c, id, ExistingWorkPolicy.REPLACE, 0)
    }
    fun enqueue(c: Context, id: String, policy: ExistingWorkPolicy = ExistingWorkPolicy.APPEND_OR_REPLACE, delaySeconds: Long = 0) {
        val request = OneTimeWorkRequestBuilder<DirectLiveWorker>().setInputData(workDataOf("session" to id))
            .setInitialDelay(delaySeconds, TimeUnit.SECONDS)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS).build()
        WorkManager.getInstance(c).enqueueUniqueWork("direct-live-$id", policy, request)
    }

    // Uploads every sealed segment of a session. Returns true once an ended
    // session has nothing left to send and its folder has been removed.
    suspend fun drain(c: Context, id: String, stopped: () -> Boolean): Boolean = serial.withLock { coroutineScope {
        val dir = folder(c, id)
        val job = runCatching { Api.json.decodeFromString<DirectJob>(File(dir, "session.json").readText()) }.getOrNull() ?: return@coroutineScope true
        val transfer = PublishTransfer(c, Vault.open(job.auth), stopped)
        val base = "/live/direct/$id/segments"
        val running = ArrayDeque<Deferred<Unit>>()
        var failure: Throwable? = null
        for (meta in dir.listFiles().orEmpty().filter { it.name.matches(Regex("[0-9]{6}\\.json")) }.sortedBy { it.name }) {
            if (failure != null) break
            val chunk = Api.json.decodeFromString<DirectChunk>(meta.readText())
            val file = File(dir, "%06d.ts".format(chunk.sequence))
            val reservation = try {
                transfer.json("POST", base, mapOf("sequence" to JsonPrimitive(chunk.sequence), "size" to JsonPrimitive(chunk.size), "sha256" to JsonPrimitive(chunk.sha256), "duration" to JsonPrimitive(chunk.duration)))
            } catch (e: Exception) { failure = e; break }
            running.addLast(async {
                var putMs = 0L
                if (reservation["ready"]?.jsonPrimitive?.boolean != true) {
                    val request = Request.Builder().url(reservation["url"]!!.jsonPrimitive.content).put(file.asRequestBody())
                    reservation["headers"]?.jsonObject?.forEach { (name, value) -> request.header(name, value.jsonPrimitive.content) }
                    val sentAt = SystemClock.elapsedRealtime()
                    Api.http.newCall(request.build()).execute().use { response -> check(response.isSuccessful || response.code == 412) { "Video upload interrupted (${response.code})" } }
                    putMs = SystemClock.elapsedRealtime() - sentAt
                    transfer.request("POST", "$base/${chunk.sequence}/commit")
                }
                meta.delete(); file.delete()
                val waiting = dir.listFiles().orEmpty().count { it.name.endsWith(".json") && it.name != "session.json" }
                Broadcast.directSaved(id, chunk.size, chunk.duration, putMs, waiting)
            })
            if (running.size >= IN_FLIGHT) runCatching { running.removeFirst().await() }.onFailure { failure = failure ?: it }
        }
        while (running.isNotEmpty()) runCatching { running.removeFirst().await() }.onFailure { failure = failure ?: it }
        failure?.let { throw it }
        if (File(dir, "ended").exists() && dir.listFiles().orEmpty().none { it.name.endsWith(".json") && it.name != "session.json" }) {
            val status = transfer.request("GET", "/live/direct/$id/status")["status"]?.jsonPrimitive?.content
            if (status != "ended") transfer.json("POST", "/live/stop", mapOf("sessionId" to JsonPrimitive(id)))
            dir.deleteRecursively()
            return@coroutineScope true
        }
        false
    } }
}
class DirectLiveWorker(c: Context, p: WorkerParameters) : CoroutineWorker(c, p) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val id = inputData.getString("session") ?: return@withContext Result.failure()
        try {
            DirectLive.drain(applicationContext, id) { isStopped }
            Result.success()
        } catch (e: Exception) {
            Broadcast.directInterrupted(id, e.message ?: "Recording upload interrupted")
            if (e is ApiException && e.status in listOf(401,403,404,409,507)) Result.failure() else Result.retry()
        }
    }
}
