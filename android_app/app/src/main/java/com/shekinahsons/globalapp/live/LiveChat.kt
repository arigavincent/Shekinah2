package com.shekinahsons.globalapp.live

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.shekinahsons.globalapp.BuildConfig
import com.shekinahsons.globalapp.data.Api
import com.shekinahsons.globalapp.ui.screens.ChatMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener

@Serializable
private data class LiveEvent(val type: String = "", val active: Boolean = false, val message: ChatMessage? = null, val id: String = "")

// A quiet chat sends nothing for a while, so the socket must not time out on
// silence; a ping every 20 s keeps it (and any proxy on the way) awake.
private val socketClient = Api.http.newBuilder()
    .readTimeout(0, java.util.concurrent.TimeUnit.MILLISECONDS)
    .pingInterval(20, java.util.concurrent.TimeUnit.SECONDS)
    .build()

// The live comments, kept in step with the server over a socket (new
// comments, removals and pins arrive instantly), with a poll as backup.
class LiveChat {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var socket: WebSocket? = null
    private var poller: Job? = null

    val messages = mutableStateListOf<ChatMessage>()
    var pinned by mutableStateOf<ChatMessage?>(null); private set
    var active by mutableStateOf(true); private set
    // Set by the host: only the host and moderators can comment.
    var chatOff by mutableStateOf(false); private set

    fun start() {
        scope.launch { runCatching { load() } }
        connect()
        poller = scope.launch {
            while (isActive) {
                delay(8_000)
                runCatching { load() }
            }
        }
    }

    private suspend fun load() {
        val res = Api.get("/community/messages?channel=live&order=desc")
        active = (res["active"] as? kotlinx.serialization.json.JsonPrimitive)?.content != "false"
        val list = Api.decode<List<ChatMessage>>(res["messages"]).reversed()
        val local = messages.filter { it.sending }
        messages.clear(); messages.addAll(list); messages.addAll(local)
        pinned = list.lastOrNull { it.pinned }
        runCatching { chatOff = (Api.get("/live/chat/status")["chatOff"] as? kotlinx.serialization.json.JsonPrimitive)?.content == "true" }
    }

    // Refreshes now (after the host changes the chat rules).
    fun refresh() { scope.launch { runCatching { load() } } }

    private fun connect() {
        val url = BuildConfig.API_BASE.replaceFirst("http", "ws") + "/api/v1/community/live/stream"
        // The server's socket library expects an Origin header.
        val request = Request.Builder().url(url).header("Origin", BuildConfig.API_BASE).build()
        socket = socketClient.newWebSocket(request, object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                val e = runCatching { Api.json.decodeFromString<LiveEvent>(text) }.getOrNull() ?: return
                scope.launch {
                    when (e.type) {
                        "message" -> e.message?.let { m -> if (messages.none { it.id == m.id }) { messages.removeAll { it.sending && it.message == m.message }; messages.add(m) } }
                        "hide" -> { messages.removeAll { it.id == e.id }; if (pinned?.id == e.id) pinned = null }
                        "pin" -> pinned = e.message
                        "unpin" -> pinned = null
                        "inactive" -> active = false
                    }
                }
            }
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                // Try again shortly; the poll keeps things fresh meanwhile.
                scope.launch { delay(4_000); if (isActive && active) connect() }
            }
        })
    }

    fun addLocal(m: ChatMessage) { messages.add(m) }
    fun replace(localId: String, saved: ChatMessage) {
        val i = messages.indexOfFirst { it.id == localId }
        if (i >= 0 && messages.none { it.id == saved.id }) messages[i] = saved else messages.removeAll { it.id == localId }
    }
    fun remove(localId: String) { messages.removeAll { it.id == localId } }

    fun stop() {
        socket?.close(1000, null)
        poller?.cancel()
        scope.cancel()
    }
}

// Moderator actions on live comments.
object LiveModeration {
    suspend fun hide(id: String) = withContext(Dispatchers.IO) { Api.post("/live/chat/messages/$id/hide") }
    suspend fun pin(id: String, pinned: Boolean) = withContext(Dispatchers.IO) { Api.post("/live/chat/messages/$id/pin", mapOf("pinned" to pinned)) }
    suspend fun block(userId: String) = withContext(Dispatchers.IO) { Api.post("/live/chat/bans", mapOf("userId" to userId, "reason" to "Blocked during live")) }
}
