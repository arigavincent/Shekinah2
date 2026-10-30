package com.shekinahsons.globalapp.live

import android.app.Activity
import android.app.Instrumentation
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.SurfaceTexture
import android.os.Bundle
import android.view.Surface
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import com.pedro.common.ConnectChecker
import com.pedro.encoder.input.sources.audio.SilenceAudioSource
import com.pedro.encoder.input.sources.video.BitmapSource
import com.pedro.library.base.recording.RecordController
import com.pedro.library.generic.GenericStream
import com.shekinahsons.globalapp.playback.LiveDataSource
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

// Explicit device acceptance, with synthetic video and silence: no camera,
// microphone, payments or notifications. Run only against a QA replay URL.
class DirectLiveAcceptance : Instrumentation() {
    private var replay = ""
    override fun onCreate(arguments: Bundle?) { super.onCreate(arguments); replay = arguments?.getString("replay").orEmpty(); start() }
    override fun onStart() {
        val result = Bundle()
        fun stage(value: String) { sendStatus(1,Bundle().apply { putString("stage",value) }) }
        stage("started")
        var encoder: GenericStream? = null
        var player: ExoPlayer? = null
        var surface: Surface? = null
        var texture: SurfaceTexture? = null
        try {
            startActivitySync(android.content.Intent().setClassName(targetContext.packageName,"com.shekinahsons.globalapp.MainActivity").addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK))
            val directory = File(targetContext.filesDir,"r2-codec-qa"); directory.deleteRecursively(); directory.mkdirs()
            val segments = java.util.Collections.synchronizedList(mutableListOf<Pair<File,Double>>())
            stage("preparing native encoder")
            runOnMainSync {
                val image = Bitmap.createBitmap(640,360,Bitmap.Config.ARGB_8888).apply { eraseColor(Color.rgb(30,80,140)) }
                val checker = object: ConnectChecker {
                    override fun onConnectionStarted(url: String) {}; override fun onConnectionSuccess() {}; override fun onConnectionFailed(reason: String) {}
                    override fun onDisconnect() {}; override fun onAuthError() {}; override fun onAuthSuccess() {}; override fun onNewBitrate(bitrate: Long) {}
                }
                encoder = GenericStream(targetContext,checker,BitmapSource(image),SilenceAudioSource()).apply {
                    setRecordController(SegmentRecorder(directory) { f,d -> segments.add(f to d) })
                    check(prepareVideo(640,360,500_000,iFrameInterval=1)) { "Video preparation failed" }
                    check(prepareAudio(44_100,true,96_000)) { "Audio preparation failed" }
                    startRecord(directory.path, RecordController.RecordTracks.ALL, object: RecordController.Listener { override fun onStatusChange(status: RecordController.Status) {} })
                }
            }
            stage("encoding synthetic video")
            Thread.sleep(8_000)
            stage("stopping native encoder")
            runOnMainSync { encoder?.stopRecord(); encoder?.release(); encoder=null }
            check(segments.size>=3) { "Encoder did not produce three segments" }
            check(segments.all { it.first.length()>376 && it.second>0 && it.second<10 }) { "Invalid native segment" }
            check(segments.dropLast(1).all { it.second < 3.2 }) { "Live encoder segments are too long" }
            result.putString("segments",segments.joinToString(",") { "${it.first.name}:${it.first.length()}:${it.second}" })
            if (replay.isNotBlank()) {
                stage("decoding R2 replay")
                val ready = CountDownLatch(1); val failure=AtomicReference<String>()
                runOnMainSync {
                    texture=SurfaceTexture(0);surface=Surface(texture)
                    player=ExoPlayer.Builder(targetContext).setMediaSourceFactory(DefaultMediaSourceFactory(LiveDataSource)).build().apply {
                        setVideoSurface(surface);volume=0f
                        addListener(object:Player.Listener {
                            override fun onRenderedFirstFrame() { ready.countDown() }
                            override fun onPlayerError(error: PlaybackException) { failure.set(error.errorCodeName);ready.countDown() }
                        })
                        setMediaItem(MediaItem.Builder().setUri(replay).setMimeType(MimeTypes.APPLICATION_M3U8).build());prepare();playWhenReady=true
                    }
                }
                check(ready.await(45,TimeUnit.SECONDS)) { "Timed out waiting for remote encrypted replay" }
                check(failure.get()==null) { "Replay failed: ${failure.get()}" }
                Thread.sleep(2500)
                runOnMainSync { result.putString("playback","first frame decoded; position=${player?.currentPosition}; video=${player?.videoFormat?.sampleMimeType}; audio=${player?.audioFormat?.sampleMimeType}") }
            }
            finish(Activity.RESULT_OK,result)
        } catch (e:Exception) {
            result.putString("failure",e.message ?: e.javaClass.simpleName);finish(Activity.RESULT_CANCELED,result)
        } finally { runOnMainSync { encoder?.release();player?.release();surface?.release();texture?.release() } }
    }
}
