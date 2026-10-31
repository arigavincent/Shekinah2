package com.shekinahsons.globalapp.data

import android.content.Context
import androidx.compose.runtime.mutableStateMapOf
import androidx.work.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withContext
import java.io.IOException
import java.util.concurrent.TimeUnit

/** WorkManager owns transfers, so leaving a screen or restarting the process does not lose them. */
object Downloads {
    data class Entry(val state: String, val progress: Float = 0f, val error: String = "")
    val entries = mutableStateMapOf<String, Entry>()
    private fun name(id: String) = "vault-$id"
    fun start(context: Context, id: String, url: String, token: String? = null): java.util.UUID {
        val work = OneTimeWorkRequestBuilder<VaultDownloadWorker>()
            .setInputData(workDataOf("id" to id, "url" to url, "auth" to token?.let(Vault::seal)))
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).setRequiresStorageNotLow(true).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS).addTag("vault-download").addTag("id:$id").addTag("started:${System.currentTimeMillis()}").build()
        context.getSharedPreferences("download-controls",0).edit().putBoolean(id, false).apply()
        WorkManager.getInstance(context).enqueueUniqueWork(name(id), ExistingWorkPolicy.REPLACE, work)
        return work.id
    }
    fun pause(context: Context, id: String) {
        context.getSharedPreferences("download-controls",0).edit().putBoolean(id,true).putFloat("$id-progress",entries[id]?.progress ?: 0f).commit()
        WorkManager.getInstance(context).cancelUniqueWork(name(id))
        entries[id] = Entry("Paused",entries[id]?.progress ?: 0f)
    }
    suspend fun cancel(context: Context, id: String) {
        val operation = WorkManager.getInstance(context).cancelUniqueWork(name(id))
        withContext(Dispatchers.IO) { operation.result.get(); VaultFiles.delete(context,id) }
        entries.remove(id)
    }
    suspend fun await(context: Context, id: java.util.UUID) {
        val work = WorkManager.getInstance(context).getWorkInfoByIdFlow(id).first { it?.state?.isFinished==true }!!
        check(work.state == WorkInfo.State.SUCCEEDED) { work.outputData.getString("error") ?: "Download paused. Tap Retry to continue." }
    }
    fun observe(context: Context) {
        WorkManager.getInstance(context).getWorkInfosByTagLiveData("vault-download").observeForever { works ->
            works.groupBy { it.tags.firstOrNull{tag->tag.startsWith("id:")} }.values.mapNotNull { group->group.maxByOrNull{it.tags.firstOrNull{tag->tag.startsWith("started:")}?.substringAfter(":")?.toLongOrNull()?:0L} }.forEach { info ->
                val id=info.tags.firstOrNull { it.startsWith("id:") }?.removePrefix("id:") ?: return@forEach
                val paused=context.getSharedPreferences("download-controls",0).getBoolean(id,false)
                entries[id]=Entry(when(info.state) {
                    WorkInfo.State.SUCCEEDED -> "Complete"
                    WorkInfo.State.FAILED -> "Failed"
                    WorkInfo.State.CANCELLED -> if(paused) "Paused" else "Cancelled"
                    WorkInfo.State.RUNNING -> "Downloading"
                    else -> "Waiting for connection"
                }, if(info.state==WorkInfo.State.SUCCEEDED) 1f else info.progress.getFloat("progress",context.getSharedPreferences("download-controls",0).getFloat("$id-progress",entries[id]?.progress ?: 0f)), info.outputData.getString("error").orEmpty())
            }
        }
    }
}

class VaultDownloadWorker(context: Context, params: WorkerParameters): CoroutineWorker(context,params) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val id=inputData.getString("id") ?: return@withContext Result.failure()
        val url=inputData.getString("url") ?: return@withContext Result.failure()
        try {
            val token=inputData.getString("auth")?.let(Vault::open)
            VaultFiles.save(applicationContext,id,url,token?.let { mapOf("Authorization" to "Bearer $it") } ?: emptyMap(), stopped={isStopped}) {
                setProgressAsync(workDataOf("progress" to it))
            }
            Result.success()
        } catch (e: Exception) {
            if(e is kotlinx.coroutines.CancellationException) throw e
            if((e is IOException || (e is ApiException && (e.status>=500 || e.status==429 || e.status==408))) && runAttemptCount < 8) Result.retry()
            else Result.failure(workDataOf("error" to (e.message ?: "Download failed")))
        }
    }
}
