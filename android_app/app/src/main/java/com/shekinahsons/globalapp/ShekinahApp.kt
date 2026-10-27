package com.shekinahsons.globalapp

import android.app.Application
import coil3.ImageLoader
import coil3.PlatformContext
import coil3.SingletonImageLoader
import coil3.request.crossfade
import com.shekinahsons.globalapp.data.ContentRepository

class ShekinahApp : Application(), SingletonImageLoader.Factory {
    lateinit var content: ContentRepository
        private set

    override fun onCreate() {
        super.onCreate()
        content = ContentRepository(this)
    }

    override fun newImageLoader(context: PlatformContext) =
        ImageLoader.Builder(context).crossfade(450).build()
}
