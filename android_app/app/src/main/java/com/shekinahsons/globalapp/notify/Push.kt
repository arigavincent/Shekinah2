package com.shekinahsons.globalapp.notify

import android.content.Context
import android.os.Build
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import com.shekinahsons.globalapp.BuildConfig
import com.shekinahsons.globalapp.data.Api
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import java.time.Instant
import java.util.concurrent.TimeUnit

// How church notifications reach the phone:
// - Firebase Cloud Messaging when the project is configured: instant pushes.
// - Otherwise a background check of the announcement feed every 15 minutes
//   (and whenever the app opens), shown as normal notifications.
object Push {
    private const val PREFS = "push"
    fun usingFirebase() = BuildConfig.FIREBASE_APP_ID.isNotBlank() && BuildConfig.FIREBASE_PROJECT_ID.isNotBlank()

    fun start(context: Context) {
        Notify.channels(context)
        if (usingFirebase()) {
            if (FirebaseApp.getApps(context).isEmpty()) {
                FirebaseApp.initializeApp(context, FirebaseOptions.Builder()
                    .setApplicationId(BuildConfig.FIREBASE_APP_ID)
                    .setApiKey(BuildConfig.FIREBASE_API_KEY)
                    .setProjectId(BuildConfig.FIREBASE_PROJECT_ID)
                    .setGcmSenderId(BuildConfig.FIREBASE_SENDER_ID)
                    .build())
            }
            FirebaseMessaging.getInstance().token.addOnSuccessListener { register(context, it) }
        }
        val network = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "feed", ExistingPeriodicWorkPolicy.KEEP,
            PeriodicWorkRequestBuilder<FeedWorker>(15, TimeUnit.MINUTES).setConstraints(network).build(),
        )
        WorkManager.getInstance(context).enqueue(OneTimeWorkRequestBuilder<FeedWorker>().setConstraints(network).build())
    }

    private fun preferences(context: Context): Map<String, Boolean> {
        val p = context.getSharedPreferences("notify", Context.MODE_PRIVATE)
        return listOf("live", "sermons", "devotion", "events").associateWith { p.getBoolean(it, true) }
    }

    fun register(context: Context, token: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("token", token).apply()
        CoroutineScope(Dispatchers.IO).launch {
            runCatching {
                Api.post("/notifications/register", mapOf(
                    "expoPushToken" to token, "provider" to "fcm", "platform" to "android",
                    "deviceName" to "${Build.MANUFACTURER} ${Build.MODEL}", "appVersion" to BuildConfig.VERSION_NAME,
                    "preferences" to preferences(context),
                ))
            }
        }
    }

    // Tell the server the switches changed, so pushes respect them too.
    fun preferencesChanged(context: Context) {
        val token = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("token", null) ?: return
        CoroutineScope(Dispatchers.IO).launch {
            runCatching { Api.patch("/notifications/preferences", mapOf("expoPushToken" to token, "preferences" to preferences(context))) }
        }
    }
}

@Serializable
private data class FeedItem(val id: String = "", val title: String = "", val body: String = "", val category: String = "general", val createdAt: String = "", val data: Map<String,kotlinx.serialization.json.JsonElement> = emptyMap())

class FeedWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val prefs = applicationContext.getSharedPreferences("push", Context.MODE_PRIVATE)
        val since = prefs.getString("since", null)
        return runCatching {
            val path = "/notifications/feed" + if (since != null) "?since=$since" else ""
            val items = Api.decode<List<FeedItem>>(Api.get(path)["messages"])
            // First run: just remember where we are, don't replay old news.
            // With Firebase on, pushes already showed these.
            if (since != null && !Push.usingFirebase()) {
                items.sortedBy { it.createdAt }.forEach { Notify.show(applicationContext, it.id.hashCode(), it.title, it.body, it.category, (it.data["open"] as? kotlinx.serialization.json.JsonPrimitive)?.content ?: it.category, (it.data["id"] as? kotlinx.serialization.json.JsonPrimitive)?.content.orEmpty()) }
            }
            val newest = items.maxOfOrNull { it.createdAt } ?: since ?: Instant.now().toString()
            prefs.edit().putString("since", newest).apply()
            Result.success()
        }.getOrElse { Result.retry() }
    }
}

class PushService : FirebaseMessagingService() {
    override fun onNewToken(token: String) = Push.register(applicationContext, token)

    override fun onMessageReceived(message: RemoteMessage) {
        val title = message.notification?.title ?: message.data["title"] ?: return
        val body = message.notification?.body ?: message.data["body"].orEmpty()
        Notify.show(applicationContext, (message.messageId ?: title).hashCode(), title, body, message.data["category"] ?: "general", message.data["open"] ?: message.data["category"] ?: "notifications", message.data["id"].orEmpty())
    }
}
