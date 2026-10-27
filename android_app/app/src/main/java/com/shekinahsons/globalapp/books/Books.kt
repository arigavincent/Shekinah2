package com.shekinahsons.globalapp.books

import android.content.Context
import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.shekinahsons.globalapp.BuildConfig
import com.shekinahsons.globalapp.data.Api
import com.shekinahsons.globalapp.data.ApiException
import com.shekinahsons.globalapp.data.VaultFiles
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.Request
import okhttp3.RequestBody
import okio.BufferedSink
import okio.source

@Serializable
data class Book(
    val id: String = "", val title: String = "", val description: String = "", val author: String = "",
    val category: String = "", val kind: String = "book", val coverUrl: String = "", val price: Int = 0,
    val fileSizeBytes: Long = 0, val publishedAt: String = "", val isPublished: Boolean = true,
    val owned: Boolean = false, val pending: Boolean = false, val canEdit: Boolean = false,
) {
    val free get() = price <= 0
    val readable get() = free || owned || canEdit
}

// The shelf, the reader's own copies (encrypted in the app's vault), and
// where each reader stopped.
object Books {
    private const val PREFIX = "book-"
    val downloading = mutableStateMapOf<String, Float>()
    var version by mutableStateOf(0); private set

    suspend fun list(): Pair<List<Book>, Boolean> = withContext(Dispatchers.IO) {
        val res = Api.get("/library")
        Api.decode<List<Book>>(res["items"]) to ((res["canPublish"] as? kotlinx.serialization.json.JsonPrimitive)?.content == "true")
    }

    fun has(context: Context, b: Book) = VaultFiles.has(context, PREFIX + b.id)
    fun vaultId(b: Book) = PREFIX + b.id

    // Downloads the book (the server only sends it to those allowed) straight into the vault.
    suspend fun fetch(context: Context, b: Book) = withContext(Dispatchers.IO) {
        downloading[b.id] = 0f
        try {
            val headers = Api.token?.let { mapOf("Authorization" to "Bearer $it") } ?: emptyMap()
            VaultFiles.save(context, PREFIX + b.id, "${BuildConfig.API_BASE}/api/v1/library/${b.id}/file", headers) { downloading[b.id] = it }
            version++
        } finally {
            downloading.remove(b.id)
        }
    }

    fun remove(context: Context, b: Book) { VaultFiles.delete(context, PREFIX + b.id); version++ }

    // Publishing: the PDF and cover go to the server, which encrypts and stores them.
    suspend fun publish(
        context: Context, title: String, author: String, description: String, category: String,
        kind: String, price: Int, pdf: Uri, cover: Uri?, progress: (Float) -> Unit,
    ): Book = withContext(Dispatchers.IO) {
        val resolver = context.contentResolver
        fun part(uri: Uri, type: String): RequestBody = object : RequestBody() {
            val size = runCatching { resolver.openAssetFileDescriptor(uri, "r")?.use { it.length } }.getOrNull() ?: -1L
            override fun contentType() = type.toMediaType()
            override fun contentLength() = size
            override fun writeTo(sink: BufferedSink) {
                resolver.openInputStream(uri)!!.source().use { src ->
                    var sent = 0L
                    val buffer = okio.Buffer()
                    while (true) {
                        val n = src.read(buffer, 64 * 1024)
                        if (n == -1L) break
                        sink.write(buffer, n)
                        sent += n
                        if (size > 0) progress((sent.toFloat() / size).coerceAtMost(1f))
                    }
                }
            }
        }
        val body = MultipartBody.Builder().setType(MultipartBody.FORM)
            .addFormDataPart("title", title).addFormDataPart("author", author).addFormDataPart("description", description)
            .addFormDataPart("category", category).addFormDataPart("kind", kind).addFormDataPart("price", price.toString())
            .addFormDataPart("file", "book.pdf", part(pdf, "application/pdf"))
            .apply { if (cover != null) addFormDataPart("cover", "cover.jpg", part(cover, resolver.getType(cover) ?: "image/jpeg")) }
            .build()
        val request = Request.Builder().url("${BuildConfig.API_BASE}/api/v1/library").post(body)
            .apply { Api.token?.let { header("Authorization", "Bearer $it") } }.build()
        Api.http.newBuilder().writeTimeout(5, java.util.concurrent.TimeUnit.MINUTES).readTimeout(5, java.util.concurrent.TimeUnit.MINUTES).build()
            .newCall(request).execute().use { res ->
                val text = res.body?.string().orEmpty()
                val json = runCatching { Json.parseToJsonElement(text) as kotlinx.serialization.json.JsonObject }.getOrNull()
                if (!res.isSuccessful) throw ApiException(res.code, (json?.get("message") as? kotlinx.serialization.json.JsonPrimitive)?.content ?: "Publishing failed (${res.code})")
                Api.decode<Book>(json?.get("item"))
            }
    }

    suspend fun update(id: String, changes: Map<String, Any?>) = withContext(Dispatchers.IO) { Api.patch("/library/$id", changes) }

    // Reading position and the reader's marks, per book.
    fun lastPage(context: Context, id: String) = context.getSharedPreferences("reading", Context.MODE_PRIVATE).getInt("page-$id", 0)
    fun saveLastPage(context: Context, id: String, page: Int, pages: Int) =
        context.getSharedPreferences("reading", Context.MODE_PRIVATE).edit().putInt("page-$id", page).putInt("pages-$id", pages).putLong("at-$id", System.currentTimeMillis()).apply()
    fun progress(context: Context, id: String): Float {
        val p = context.getSharedPreferences("reading", Context.MODE_PRIVATE)
        val pages = p.getInt("pages-$id", 0)
        return if (pages > 0) (p.getInt("page-$id", 0) + 1f) / pages else 0f
    }
    fun lastReadAt(context: Context, id: String) = context.getSharedPreferences("reading", Context.MODE_PRIVATE).getLong("at-$id", 0)
}
