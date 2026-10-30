package com.shekinahsons.globalapp.playback

import android.content.Context
import android.net.Uri
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.CacheWriter
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import androidx.media3.exoplayer.DefaultLoadControl
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.io.File

// Disk cache shared by every video player, plus "warming": the first couple
// of seconds of the sermon you are looking at are fetched in the background,
// so tapping it starts playback almost at once.
object VideoCache {
    private const val WARM_BYTES = 1_500_000L
    private var cache: SimpleCache? = null
    private lateinit var app: Context
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val warming = mutableMapOf<String, Job>()

    fun init(context: Context) {
        if (cache != null) return
        app = context.applicationContext
        cache = SimpleCache(File(app.cacheDir, "video"), LeastRecentlyUsedCacheEvictor(400L * 1024 * 1024), StandaloneDatabaseProvider(app))
    }

    // Encrypted downloads first, then the shared cache, then the network.
    fun dataSourceFactory(): androidx.media3.datasource.DataSource.Factory =
        com.shekinahsons.globalapp.data.VaultFiles.Router(app, androidx.media3.datasource.DataSource.Factory {
            object: androidx.media3.datasource.DataSource {
                private var active: androidx.media3.datasource.DataSource?=null
                override fun addTransferListener(l: androidx.media3.datasource.TransferListener) { }
                override fun open(spec:DataSpec):Long {
                    val base=android.net.Uri.parse(com.shekinahsons.globalapp.BuildConfig.API_BASE)
                    val protected=spec.uri.scheme==base.scheme && spec.uri.authority==base.authority && spec.uri.path.orEmpty().startsWith("/api/v1/live/")
                    active=if(protected) LiveDataSource.createDataSource() else cacheFactory().createDataSource()
                    return active!!.open(spec)
                }
                override fun read(b:ByteArray,o:Int,n:Int)=active!!.read(b,o,n)
                override fun getUri()=active?.uri
                override fun close(){active?.close();active=null}
            }
        })

    private fun cacheFactory(): CacheDataSource.Factory = CacheDataSource.Factory()
        .setCache(cache!!)
        .setUpstreamDataSourceFactory(DefaultDataSource.Factory(app, DefaultHttpDataSource.Factory().setAllowCrossProtocolRedirects(true)))
        .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)

    // Start as soon as ~0.7 s is buffered, then keep building a long buffer
    // for weak networks (AJStream's approach).
    fun loadControl(): DefaultLoadControl = DefaultLoadControl.Builder()
        .setBufferDurationsMs(30_000, 120_000, 700, 2_000)
        .setPrioritizeTimeOverSizeThresholds(true)
        .build()

    fun warm(url: String?) {
        if (url.isNullOrBlank() || !url.startsWith("http") || cache == null) return
        synchronized(warming) {
            if (warming[url]?.isActive == true) return
            warming[url] = scope.launch {
                runCatching {
                    val source = cacheFactory().createDataSource()
                    CacheWriter(source, DataSpec.Builder().setUri(Uri.parse(url)).setLength(WARM_BYTES).build(), null, null).cache()
                }
            }
        }
    }
}
