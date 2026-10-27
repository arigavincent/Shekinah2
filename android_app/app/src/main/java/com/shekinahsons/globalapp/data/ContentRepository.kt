package com.shekinahsons.globalapp.data

import android.content.Context
import com.shekinahsons.globalapp.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.util.concurrent.TimeUnit

// Loads home content: the last good copy from disk first (instant start,
// works offline), then a fresh copy from the backend.
class ContentRepository(context: Context) {
    private val cacheFile = File(context.filesDir, "home.json")
    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true; explicitNulls = false }
    private val http = OkHttpClient.Builder().connectTimeout(10, TimeUnit.SECONDS).readTimeout(20, TimeUnit.SECONDS).build()

    private val _content = MutableStateFlow(readCache())
    val content: StateFlow<HomeContent?> = _content

    private val _refreshing = MutableStateFlow(false)
    val refreshing: StateFlow<Boolean> = _refreshing

    private fun readCache(): HomeContent? =
        runCatching { json.decodeFromString<HomeContent>(cacheFile.readText()) }.getOrNull()

    suspend fun refresh() = withContext(Dispatchers.IO) {
        _refreshing.value = true
        try {
            val request = Request.Builder().url("${BuildConfig.API_BASE}/api/v1/home").build()
            http.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@use
                val body = response.body?.string() ?: return@use
                _content.value = json.decodeFromString<HomeContent>(body)
                cacheFile.writeText(body)
            }
        } catch (_: Exception) {
            // Offline: keep showing the cached copy.
        } finally {
            _refreshing.value = false
        }
    }
}
