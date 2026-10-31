package com.shekinahsons.globalapp.notify

import android.content.Context
import com.shekinahsons.globalapp.data.Api
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.time.Instant

// The bell's dot: announcements newer than the last time Notifications was opened.
object Unread {
    private fun prefs(c: Context) = c.getSharedPreferences("notify", Context.MODE_PRIVATE)
    fun markSeen(c: Context) = prefs(c).edit().putLong("seen-at", System.currentTimeMillis()).apply()
    suspend fun count(c: Context): Int {
        val seen = prefs(c).getLong("seen-at", 0L)
        val messages = Api.get("/notifications/feed")["messages"]?.jsonArray ?: return 0
        return messages.count { m ->
            val at = m.jsonObject["createdAt"]?.jsonPrimitive?.content ?: return@count false
            runCatching { Instant.parse(at).toEpochMilli() > seen }.getOrDefault(false)
        }
    }
}
