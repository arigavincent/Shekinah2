package com.shekinahsons.globalapp.ui

import androidx.compose.runtime.mutableStateListOf
import com.shekinahsons.globalapp.data.Devotion
import com.shekinahsons.globalapp.data.Sermon

enum class Tab(val label: String) { Home("Home"), Sermons("Sermons"), Bible("Bible"), Devotions("Devotions"), Live("Live") }

sealed interface Route {
    data class Root(val tab: Tab) : Route
    data class Video(val sermon: Sermon, val queue: List<Sermon>) : Route
    data class Audio(val sermon: Sermon, val queue: List<Sermon>) : Route
    data class DevotionRead(val devotion: Devotion) : Route
    data class Page(val page: String) : Route
}

// A tiny back stack: tabs replace the root, details push on top.
class Navigator {
    val stack = mutableStateListOf<Route>(Route.Root(Tab.Home))
    val current get() = stack.last()
    val tab get() = stack.filterIsInstance<Route.Root>().last().tab

    fun select(tab: Tab) { stack.clear(); stack.add(Route.Root(tab)) }
    fun push(route: Route) { stack.add(route) }
    fun back(): Boolean {
        if (stack.size > 1) { stack.removeAt(stack.lastIndex); return true }
        if (tab != Tab.Home) { select(Tab.Home); return true }
        return false
    }
}
