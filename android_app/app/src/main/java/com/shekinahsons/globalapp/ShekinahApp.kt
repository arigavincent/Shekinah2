package com.shekinahsons.globalapp

import android.app.Application
import coil3.ImageLoader
import coil3.PlatformContext
import coil3.SingletonImageLoader
import coil3.request.crossfade
import com.shekinahsons.globalapp.data.ContentRepository
import com.shekinahsons.globalapp.data.Library

class ShekinahApp : Application(), SingletonImageLoader.Factory {
    lateinit var content: ContentRepository
        private set
    lateinit var library: Library
        private set

    override fun onCreate() {
        super.onCreate()
        content = ContentRepository(this)
        library = Library(this)
        com.shekinahsons.globalapp.playback.VideoCache.init(this)
    }

    override fun newImageLoader(context: PlatformContext) =
        ImageLoader.Builder(context).crossfade(450).build()
}
