package com.shekinahsons.globalapp.extras

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.shekinahsons.globalapp.MainActivity
import com.shekinahsons.globalapp.R
import java.util.Calendar

// The next service as the backend states it ("Sunday, 9:00 AM"), turned
// into a real time so Home can count down to it and remind you.
object ServiceReminder {
    private val days = listOf("sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday")
    private val pattern = Regex("""(sun|mon|tue|wed|thu|fri|sat)[a-z]*[ ,]+(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m""", RegexOption.IGNORE_CASE)
    private const val EARLY_MS = 15 * 60_000L

    // Several services can be listed, e.g. "Sunday, 7:00 AM; Sunday, 10:00 AM;
    // Wednesday, 6:00 PM". Times are Nairobi time, whatever the phone's zone.
    private val nairobi = java.time.ZoneId.of("Africa/Nairobi")

    fun nextStart(text: String, now: Long = System.currentTimeMillis()): Long? = next(text, now)?.first

    // The soonest upcoming service and how it was written ("Sunday, 10:00 AM").
    fun next(text: String, now: Long = System.currentTimeMillis()): Pair<Long, String>? =
        pattern.findAll(text).mapNotNull { m ->
            val day = days.indexOfFirst { it.startsWith(m.groupValues[1].lowercase()) }
            if (day < 0) return@mapNotNull null
            var hour = m.groupValues[2].toInt() % 12
            if (m.groupValues[4].equals("p", true)) hour += 12
            val minute = m.groupValues[3].toIntOrNull() ?: 0
            val dow = java.time.DayOfWeek.of(if (day == 0) 7 else day)
            val nowZ = java.time.Instant.ofEpochMilli(now).atZone(nairobi)
            var at = nowZ.with(java.time.temporal.TemporalAdjusters.nextOrSame(dow)).withHour(hour).withMinute(minute).withSecond(0).withNano(0)
            if (!at.isAfter(nowZ)) at = at.plusWeeks(1)
            val label = days[day].replaceFirstChar { it.uppercase() } + ", " + at.format(java.time.format.DateTimeFormatter.ofPattern("h:mm a", java.util.Locale.ENGLISH))
            at.toInstant().toEpochMilli() to label
        }.minByOrNull { it.first }

    // Days, hours, minutes and seconds left, for the ticking countdown.
    fun parts(start: Long, now: Long = System.currentTimeMillis()): List<Long> {
        val s = ((start - now) / 1000).coerceAtLeast(0)
        return listOf(s / 86_400, s / 3600 % 24, s / 60 % 60, s % 60)
    }

    fun countdown(start: Long, now: Long = System.currentTimeMillis()): String {
        val min = ((start - now) / 60_000).coerceAtLeast(0)
        val d = min / (24 * 60)
        val h = min / 60 % 24
        val m = min % 60
        return when {
            d > 0 -> "in $d day${if (d > 1) "s" else ""} $h h"
            h > 0 -> "in $h h $m min"
            else -> "in $m min"
        }
    }

    private fun prefs(context: Context) = context.getSharedPreferences("reminders", Context.MODE_PRIVATE)
    fun isSet(context: Context, start: Long) = prefs(context).getLong("service", 0L) == start

    fun toggle(context: Context, start: Long): Boolean {
        val alarms = context.getSystemService(AlarmManager::class.java)
        val pending = PendingIntent.getBroadcast(context, 7, Intent(context, ServiceReminderReceiver::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        return if (isSet(context, start)) {
            alarms.cancel(pending)
            prefs(context).edit().remove("service").apply()
            false
        } else {
            // Inexact is fine for a 15-minute heads-up and needs no extra permission.
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, start - EARLY_MS, pending)
            prefs(context).edit().putLong("service", start).apply()
            true
        }
    }
}

class ServiceReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel("services", "Service reminders", NotificationManager.IMPORTANCE_HIGH))
        val open = PendingIntent.getActivity(context, 0, Intent(context, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(context, "services")
            .setSmallIcon(R.drawable.dove_mark)
            .setContentTitle("Service starts in 15 minutes")
            .setContentText("Join Shekinah Sons Global live in the app.")
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        runCatching { manager.notify(7, notification) }
        context.getSharedPreferences("reminders", Context.MODE_PRIVATE).edit().remove("service").apply()
    }
}
