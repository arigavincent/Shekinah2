package com.shekinahsons.globalapp.live

import android.content.Context
import androidx.work.*
import com.shekinahsons.globalapp.data.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
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
        enqueue(c, id)
    }
    fun enqueue(c: Context, id: String) {
        val request = OneTimeWorkRequestBuilder<DirectLiveWorker>().setInputData(workDataOf("session" to id))
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS).build()
        WorkManager.getInstance(c).enqueueUniqueWork("direct-live-$id", ExistingWorkPolicy.APPEND_OR_REPLACE, request)
    }
}
class DirectLiveWorker(c: Context, p: WorkerParameters) : CoroutineWorker(c, p) {
    companion object { private val serial = Mutex() }
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) { serial.withLock {
        val id = inputData.getString("session") ?: return@withLock Result.failure()
        val dir = DirectLive.folder(applicationContext, id)
        val job = runCatching { Api.json.decodeFromString<DirectJob>(File(dir, "session.json").readText()) }.getOrNull() ?: return@withLock Result.failure()
        try {
            val transfer = PublishTransfer(applicationContext, Vault.open(job.auth)) { isStopped }
            for (meta in dir.listFiles().orEmpty().filter { it.name.matches(Regex("[0-9]{6}\\.json")) }.sortedBy { it.name }) {
                val chunk = Api.json.decodeFromString<DirectChunk>(meta.readText())
                val file = File(dir, "%06d.ts".format(chunk.sequence))
                val sentAt = android.os.SystemClock.elapsedRealtime()
                val base = "/live/direct/$id/segments"
                val reservation = transfer.json("POST", base, mapOf("sequence" to JsonPrimitive(chunk.sequence), "size" to JsonPrimitive(chunk.size), "sha256" to JsonPrimitive(chunk.sha256), "duration" to JsonPrimitive(chunk.duration)))
                if (reservation["ready"]?.jsonPrimitive?.boolean != true) {
                    val request = Request.Builder().url(reservation["url"]!!.jsonPrimitive.content).put(file.asRequestBody())
                    reservation["headers"]?.jsonObject?.forEach { (name, value) -> request.header(name, value.jsonPrimitive.content) }
                    Api.http.newCall(request.build()).execute().use { response -> check(response.isSuccessful || response.code == 412) { "Video upload interrupted (${response.code})" } }
                    transfer.request("POST", "$base/${chunk.sequence}/commit")
                }
                meta.delete(); file.delete()
                Broadcast.directSaved(id, chunk.size, chunk.duration, android.os.SystemClock.elapsedRealtime() - sentAt)
            }
            if (File(dir,"ended").exists()) {
                val status = transfer.request("GET","/live/direct/$id/status")["status"]?.jsonPrimitive?.content
                if (status != "ended") transfer.json("POST","/live/stop",mapOf("sessionId" to JsonPrimitive(id)))
                dir.deleteRecursively()
            }
            Result.success()
        } catch (e: Exception) {
            Broadcast.directInterrupted(id, e.message ?: "Recording upload interrupted")
            if (e is ApiException && e.status in listOf(401,403,404,409,507)) Result.failure() else Result.retry()
        }
    } }
}
