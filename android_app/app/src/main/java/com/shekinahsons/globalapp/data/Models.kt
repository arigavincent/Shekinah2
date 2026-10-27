package com.shekinahsons.globalapp.data

import kotlinx.serialization.Serializable

// Mirrors GET /api/v1/home. Every field has a default so a missing or new
// backend field never breaks parsing.

@Serializable
data class HomeContent(
    val scripture: Scripture = Scripture(),
    val live: Live = Live(),
    val devotions: List<Devotion> = emptyList(),
    val sermons: List<Sermon> = emptyList(),
    val categories: List<Category> = emptyList(),
    val clips: List<Clip> = emptyList(),
    val events: List<Event> = emptyList(),
    val branches: List<Branch> = emptyList(),
    val updates: List<Update> = emptyList(),
    val about: About = About(),
) {
    val videoSermons get() = sermons.filter { it.type != "audio" }
    val audioSermons get() = sermons.filter { it.type == "audio" }
}

@Serializable
data class Scripture(val title: String = "", val verse: String = "", val reference: String = "")

@Serializable
data class Live(
    val isLive: Boolean = false,
    val title: String = "",
    val viewers: String = "",
    val nextService: String = "",
    val provider: String = "",
    val playbackHlsUrl: String = "",
)

@Serializable
data class Devotion(
    val id: String = "",
    val title: String = "",
    val excerpt: String = "",
    val date: String = "",
    val imageUrl: String = "",
    val body: String = "",
)

@Serializable
data class Sermon(
    val id: String = "",
    val type: String = "video",
    val code: String = "",
    val title: String = "",
    val speaker: String = "",
    val date: String = "",
    val category: String = "",
    val thumbnail: String = "",
    val duration: String = "",
    val description: String = "",
    val mediaUrl: String = "",
)

@Serializable
data class Category(val id: String = "", val name: String = "", val count: Int = 0, val image: String = "")

@Serializable
data class Clip(
    val id: String = "",
    val title: String = "",
    val image: String = "",
    val mediaUrl: String = "",
    val duration: String = "",
)

@Serializable
data class Event(
    val id: String = "",
    val title: String = "",
    val date: String = "",
    val time: String = "",
    val location: String = "",
    val imageUrl: String = "",
    val description: String = "",
)

@Serializable
data class Branch(
    val id: String = "",
    val name: String = "",
    val address: String = "",
    val services: String = "",
    val phone: String = "",
    val imageUrl: String = "",
)

@Serializable
data class Update(val id: String = "", val title: String = "", val excerpt: String = "", val date: String = "", val image: String = "")

@Serializable
data class About(val vision: String = "", val description: String = "", val contactSummary: String = "")
