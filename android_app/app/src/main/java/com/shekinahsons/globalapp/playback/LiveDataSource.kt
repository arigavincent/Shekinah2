package com.shekinahsons.globalapp.playback

import android.net.Uri
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.datasource.TransferListener
import com.shekinahsons.globalapp.BuildConfig
import com.shekinahsons.globalapp.data.Api

// Attach the login only to our API playlist/key requests. R2 receives only its
// scoped signed URL, never a member's bearer token (which also breaks S3 auth).
object LiveDataSource : DataSource.Factory {
    override fun createDataSource(): DataSource = object : DataSource {
        private val source = OkHttpDataSource.Factory(Api.http).createDataSource()
        override fun addTransferListener(listener: TransferListener) = source.addTransferListener(listener)
        override fun open(spec: DataSpec): Long {
            val base = Uri.parse(BuildConfig.API_BASE)
            val ours = spec.uri.scheme == base.scheme && spec.uri.authority == base.authority
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
