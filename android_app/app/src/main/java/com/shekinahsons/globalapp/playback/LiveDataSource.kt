package com.shekinahsons.globalapp.playback

import android.net.Uri
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.datasource.TransferListener
import com.shekinahsons.globalapp.BuildConfig
import com.shekinahsons.globalapp.data.Api

// Attach the login only to our own servers: the API (playlists, keys) and the
// church's live video server, which checks members-only and paid services.
// Storage receives only its scoped signed URL, never a member's bearer token
// (which also breaks S3 auth).
object LiveDataSource : DataSource.Factory {
    // The live video server's address, as the API reports it for the current service.
    @Volatile var videoServer: String? = null

    fun trustPlayback(url: String) {
        val uri = Uri.parse(url)
        if (uri.scheme == "https" && !url.contains("/live/direct/")) videoServer = uri.authority
    }

    override fun createDataSource(): DataSource = object : DataSource {
        private val source = OkHttpDataSource.Factory(Api.http).createDataSource()
        override fun addTransferListener(listener: TransferListener) = source.addTransferListener(listener)
        override fun open(spec: DataSpec): Long {
            val base = Uri.parse(BuildConfig.API_BASE)
            val ours = (spec.uri.scheme == base.scheme && spec.uri.authority == base.authority) ||
                (spec.uri.scheme == "https" && videoServer != null && spec.uri.authority == videoServer)
            val headers = spec.httpRequestHeaders.filterKeys { !it.equals("Authorization", true) }.toMutableMap()
            if (ours) Api.token?.let { headers["Authorization"] = "Bearer $it" }
            return source.open(spec.buildUpon().setHttpRequestHeaders(headers).build())
        }
        override fun read(buffer: ByteArray, offset: Int, length: Int) = source.read(buffer, offset, length)
        override fun getUri() = source.uri
        override fun getResponseHeaders() = source.responseHeaders
        override fun close() = source.close()
    }
}
