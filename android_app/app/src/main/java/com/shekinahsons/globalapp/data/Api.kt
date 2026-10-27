package com.shekinahsons.globalapp.data

import com.shekinahsons.globalapp.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class ApiException(val status: Int, message: String) : Exception(message)

// Small JSON client for the church backend. Sends the member's token when
// signed in and turns error bodies ({"message": ...}) into readable errors.
object Api {
    val json = Json { ignoreUnknownKeys = true; coerceInputValues = true; explicitNulls = false; encodeDefaults = true }
    val http: OkHttpClient = OkHttpClient.Builder().connectTimeout(12, TimeUnit.SECONDS).readTimeout(25, TimeUnit.SECONDS).build()
    var token: String? = null

    suspend fun get(path: String): JsonObject = call("GET", path, null)
    suspend fun post(path: String, body: Map<String, Any?> = emptyMap()): JsonObject = call("POST", path, body)
    suspend fun put(path: String, body: Map<String, Any?> = emptyMap()): JsonObject = call("PUT", path, body)
    suspend fun patch(path: String, body: Map<String, Any?> = emptyMap()): JsonObject = call("PATCH", path, body)
    suspend fun delete(path: String): JsonObject = call("DELETE", path, null)

    inline fun <reified T> decode(element: JsonElement?): T = json.decodeFromJsonElement<T>(element ?: JsonObject(emptyMap()))

    private fun toJson(value: Any?): JsonElement = when (value) {
        null -> kotlinx.serialization.json.JsonNull
        is String -> JsonPrimitive(value)
        is Number -> JsonPrimitive(value)
        is Boolean -> JsonPrimitive(value)
        is Map<*, *> -> JsonObject(value.entries.associate { it.key.toString() to toJson(it.value) })
        is List<*> -> kotlinx.serialization.json.JsonArray(value.map { toJson(it) })
        else -> JsonPrimitive(value.toString())
    }

    private suspend fun call(method: String, path: String, body: Map<String, Any?>?): JsonObject = withContext(Dispatchers.IO) {
        val builder = Request.Builder().url("${BuildConfig.API_BASE}/api/v1$path").header("Accept", "application/json")
        token?.let { builder.header("Authorization", "Bearer $it") }
        val payload = body?.let { toJson(it).toString().toRequestBody("application/json".toMediaType()) }
        builder.method(method, if (method == "GET" || (method == "DELETE" && payload == null)) null else payload ?: "{}".toRequestBody("application/json".toMediaType()))
        val response = try {
            http.newCall(builder.build()).execute()
        } catch (e: Exception) {
            throw ApiException(0, "No connection. Check your internet and try again.")
        }
        response.use {
            val text = it.body?.string().orEmpty()
            val parsed = runCatching { json.parseToJsonElement(text).jsonObject }.getOrNull() ?: JsonObject(emptyMap())
            if (!it.isSuccessful) {
                val message = (parsed["message"] as? JsonPrimitive)?.content ?: "Something went wrong (${it.code})."
                throw ApiException(it.code, message)
            }
            parsed
        }
    }

    fun JsonObject.str(key: String) = (this[key] as? JsonPrimitive)?.content.orEmpty()
}
