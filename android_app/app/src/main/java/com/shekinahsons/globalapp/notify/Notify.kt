package com.shekinahsons.globalapp.notify

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.shekinahsons.globalapp.MainActivity
import com.shekinahsons.globalapp.R

// Phone notifications from the church, one Android channel per kind so
// members can also tune them in the phone's own settings.
object Notify {
    val categories = listOf(
        "live" to "Live services",
        "sermons" to "New sermons",
        "devotion" to "Daily devotion",
        "events" to "Events",
        "general" to "Announcements",
    )

    fun channels(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java)
        categories.forEach { (id, name) ->
            val importance = if (id == "live") NotificationManager.IMPORTANCE_HIGH else NotificationManager.IMPORTANCE_DEFAULT
            manager.createNotificationChannel(NotificationChannel(id, name, importance))
        }
    }

    // The member's switches (Menu > Notifications). Announcements always come through.
    fun wanted(context: Context, category: String): Boolean {
        val key = when (category) { "live" -> "live"; "sermons" -> "sermons"; "devotion" -> "devotion"; "events" -> "events"; else -> return true }
        return context.getSharedPreferences("notify", Context.MODE_PRIVATE).getBoolean(key, true)
    }

    fun show(context: Context, id: Int, title: String, body: String, category: String) {
        if (!wanted(context, category)) return
        channels(context)
        val open = PendingIntent.getActivity(context, id, Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE)
        val channel = if (categories.any { it.first == category }) category else "general"
        val n = NotificationCompat.Builder(context, channel)
            .setSmallIcon(R.drawable.dove_mark)
            .setColor(0xFFD4AF37.toInt())
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        runCatching { context.getSystemService(NotificationManager::class.java).notify(id, n) }
    }
}
