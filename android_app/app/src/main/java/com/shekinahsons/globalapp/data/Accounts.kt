package com.shekinahsons.globalapp.data

import android.content.Context
import android.content.SharedPreferences
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

// Personal marks and history belong to an account, not everyone using a phone.
object Accounts {
    var current by mutableStateOf("guest"); private set
    val changed = mutableListOf<() -> Unit>()
    fun prefs(context: Context, name: String): SharedPreferences = context.getSharedPreferences("$name-$current", Context.MODE_PRIVATE)

    fun activate(context: Context, id: String) {
        val next = id.ifBlank { "guest" }
        val migration = context.getSharedPreferences("personal-data-migration",Context.MODE_PRIVATE)
        if (next != "guest" && !migration.contains("owner")) {
            // Claim the pre-account-scoping data once, for the account already
            // signed in during the upgrade. Other accounts get their own shelf.
            listOf("library","progress2","bible-state","book-marks").forEach { name ->
                val old = context.getSharedPreferences(name,Context.MODE_PRIVATE)
                val target = context.getSharedPreferences("$name-$next",Context.MODE_PRIVATE).edit()
                old.all.forEach { (k,v) -> when(v) {
                    is String -> target.putString(k,v)
                    is Int -> target.putInt(k,v)
                    is Long -> target.putLong(k,v)
                    is Float -> target.putFloat(k,v)
                    is Boolean -> target.putBoolean(k,v)
                    is Set<*> -> target.putStringSet(k,v.filterIsInstance<String>().toSet())
                } }
                target.apply()
            }
            migration.edit().putString("owner",next).apply()
        }
        if (current != next) { current=next; changed.toList().forEach { it() }; com.shekinahsons.globalapp.readingplans.PlanReminder.restore(context) }
    }
}
