package com.shekinahsons.globalapp.live

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.graphics.pdf.PdfRenderer
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.ParcelFileDescriptor
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.pedro.common.ConnectChecker
import com.pedro.encoder.input.gl.render.filters.`object`.ImageObjectFilterRender
import com.pedro.encoder.input.sources.audio.MicrophoneSource
import com.pedro.encoder.input.sources.audio.MixAudioSource
import com.pedro.encoder.input.sources.video.BitmapSource
import com.pedro.encoder.input.sources.video.Camera2Source
import com.pedro.encoder.input.sources.video.ScreenSource
import com.pedro.encoder.utils.gl.TranslateTo
import com.pedro.library.generic.GenericStream
import com.shekinahsons.globalapp.MainActivity
import com.shekinahsons.globalapp.R
import java.io.File

// What viewers see right now.
enum class Showing { Camera, CameraOff, Screen, Slides, Verse, BeRightBack }

// The live broadcast, kept outside the screen so it carries on while the
// host shares their screen or switches apps. Sources can change mid-stream:
// camera, the phone's screen, PDF slides, a verse card or "be right back".
object Broadcast {
    private val main = Handler(Looper.getMainLooper())
    private var app: Context? = null
    var stream: GenericStream? = null; private set

    var state by mutableStateOf("idle"); private set // idle, connecting, live, error
    var error by mutableStateOf<String?>(null); private set
    var startedAt by mutableLongStateOf(0L); private set
    var bitrate by mutableLongStateOf(0L); private set
    var target = 2_500_000; private set
    var micOn by mutableStateOf(true); private set
    var showing by mutableStateOf(Showing.Camera); private set
    var torch by mutableStateOf(false); private set

    // Slides (a PDF the host presents).
    var slideCount by mutableIntStateOf(0); private set
    var slide by mutableIntStateOf(0); private set
    private var slideFile: File? = null

    // On-screen graphics.
    var bannerOn by mutableStateOf(false); private set
    var logoOn by mutableStateOf(true); private set
    var bannerName = ""; var bannerTitle = ""
    private val bannerFilter = ImageObjectFilterRender()
    private val logoFilter = ImageObjectFilterRender()
    private var filtersAdded = false

    var width = 1280; private set
    var height = 720; private set
    private var projection: MediaProjection? = null

    // 0 when the picture isn't getting out, up to 1 for full quality.
    val health: Float get() = if (state != "live") 0f else (bitrate.toFloat() / target).coerceIn(0f, 1f)

    private val checker = object : ConnectChecker {
        override fun onConnectionStarted(url: String) {}
        override fun onConnectionSuccess() = main.post { state = "live"; startedAt = System.currentTimeMillis(); error = null }.let {}
        override fun onConnectionFailed(reason: String) {
            main.post {
                val s = stream ?: return@post
                // Brief network drops: keep trying for a while before giving up.
                if (state == "live" && s.getStreamClient().reTry(3000, reason, null)) return@post
                s.stopStream()
                state = "error"; error = "The connection to the live server dropped ($reason)."
            }
        }
        override fun onDisconnect() {}
        override fun onAuthError() = main.post { state = "error"; error = "The live server refused this broadcast." }.let {}
        override fun onAuthSuccess() {}
        override fun onNewBitrate(bitrate: Long) {
            main.post {
                this@Broadcast.bitrate = bitrate
                // Adapt like YouTube: step down when the network struggles, back up when it clears.
                val s = stream ?: return@post
                val now = s.getStreamClient()
                if (now.hasCongestion()) s.setVideoBitrateOnFly((bitrate * 0.8).toInt().coerceAtLeast(300_000))
                else if (bitrate < target) s.setVideoBitrateOnFly((bitrate * 1.1).toInt().coerceAtMost(target))
            }
        }
    }

    fun get(context: Context): GenericStream {
        app = context.applicationContext
        return stream ?: GenericStream(context.applicationContext, checker).also {
            it.getGlInterface().autoHandleOrientation = true
            it.getStreamClient().setReTries(20)
            stream = it
        }
    }

    // Sets the size and quality; the shape follows how the phone is held.
    var preview: android.view.SurfaceView? = null

    fun prepare(hd: Boolean, portrait: Boolean, rotation: Int): Boolean {
        val s = stream ?: return false
        if (s.isStreaming || s.isRecording) return false
        // The size can only change with the preview stopped; restart it after.
        val wasPreviewing = s.isOnPreview
        if (wasPreviewing) s.stopPreview()
        val ok = prepareNow(s, hd, portrait, rotation)
        if (wasPreviewing) preview?.let { s.startPreview(it) }
        return ok
    }

    private fun prepareNow(s: GenericStream, hd: Boolean, portrait: Boolean, rotation: Int): Boolean {
        val (w, h, rate) = if (hd) Triple(1280, 720, 2_500_000) else Triple(854, 480, 1_000_000)
        width = if (portrait) h else w; height = if (portrait) w else h
        target = rate
        return s.prepareVideo(w, h, rate, iFrameInterval = 1, rotation = rotation) && s.prepareAudio(44_100, true, 96_000)
    }

    var directSession: String? = null; private set
    fun startDirect(context: Context, id: String, key: String) {
        val s = stream ?: return
        directSession = id
        state = "connecting"; error = null; bitrate = 0
        val dir = DirectLive.prepare(context, id)
        s.setRecordController(SegmentRecorder(dir) { file, duration ->
            runCatching { DirectLive.save(context, id, file, duration, key) }.onFailure { problem ->
                main.post { error = problem.message; state = "error"; if (s.isRecording) s.stopRecord() }
            }
        })
        LiveService.start(context, screen = false); addFilters()
        s.startRecord(dir.absolutePath, com.pedro.library.base.recording.RecordController.RecordTracks.ALL, object : com.pedro.library.base.recording.RecordController.Listener {
            override fun onStatusChange(status: com.pedro.library.base.recording.RecordController.Status) {}
            override fun onError(e: Exception?) { main.post { error = e?.message ?: "Could not record broadcast"; state = "error" } }
        })
    }
    fun directSaved(id: String, bytes: Long, duration: Double, transferMs: Long = 0) { main.post {
        if (directSession == id && transferMs > duration * 900 && target > 250_000) {
            val sustainable = (bytes * 8000L / transferMs * 0.65).toInt() - 96_000
            target = minOf((target * 0.8).toInt(), sustainable).coerceAtLeast(250_000)
            stream?.setVideoBitrateOnFly(target)
        }
        if (directSession == id) { if (state != "live") startedAt = System.currentTimeMillis(); state = "live"; error = null; bitrate = (bytes * 8 / duration).toLong() }
    } }
    fun directInterrupted(id: String, message: String) { main.post {
        if (directSession == id) error = "Connection interrupted. Recording saved on this phone; retrying. $message"
    } }
    fun start(context: Context, url: String) {
        val s = stream ?: return
        state = "connecting"; error = null; bitrate = 0
        LiveService.start(context, screen = false)
        addFilters()
        s.startStream(url)
    }

    fun stop(context: Context) {
        stream?.let { if (it.isStreaming) it.stopStream(); if (it.isRecording) it.stopRecord() }
        directSession?.let { id -> File(DirectLive.folder(context,id),"ended").writeText("1"); DirectLive.enqueue(context,id) }
        directSession = null
        state = "idle"; startedAt = 0; bitrate = 0
        if (showing != Showing.Camera) runCatching { stream?.changeVideoSource(Camera2Source(context.applicationContext)) }
        showing = Showing.Camera
        endProjection()
        closeSlides()
        LiveService.stop(context)
    }

    fun failed(message: String) { state = "error"; error = message }

    // ---- Microphone and camera ----

    fun setMic(on: Boolean) {
        micOn = on
        when (val a = stream?.audioSource) {
            is MicrophoneSource -> if (on) a.unMute() else a.mute()
            is MixAudioSource -> if (android.os.Build.VERSION.SDK_INT >= 29) { if (on) a.unMute() else a.mute() }
        }
    }

    fun flipCamera() { runCatching { (stream?.videoSource as? Camera2Source)?.switchCamera() } }

    fun switchTorch(on: Boolean) {
        val cam = stream?.videoSource as? Camera2Source ?: return
        runCatching { if (on) cam.enableLantern() else cam.disableLantern() }
        torch = on && cam.isLanternEnabled()
    }

    fun zoomRange(): ClosedFloatingPointRange<Float> = (stream?.videoSource as? Camera2Source)?.getZoomRange()?.let { it.lower..it.upper } ?: 1f..1f
    fun zoom(level: Float) { runCatching { (stream?.videoSource as? Camera2Source)?.setZoom(level) } }

    fun showCamera(context: Context) {
        val s = stream ?: return
        if (showing == Showing.Camera) return
        runCatching { s.changeVideoSource(Camera2Source(context.applicationContext)) }
        if (projection != null) { runCatching { s.changeAudioSource(MicrophoneSource()) }; endProjection(); LiveService.start(context, screen = false) }
        showing = Showing.Camera; torch = false
        setMic(micOn)
    }

    // Camera off: viewers see a card with the title instead of black.
    fun cameraOff(title: String) { showCard(Showing.CameraOff, card("CAMERA PAUSED", title, "We'll be right with you")) }
    fun beRightBack(title: String) { showCard(Showing.BeRightBack, card("BE RIGHT BACK", title, "Stay with us, the service continues shortly")) }
    fun showVerse(reference: String, text: String) { showCard(Showing.Verse, verseCard(reference, text)) }

    private fun showCard(kind: Showing, bitmap: Bitmap) {
        val s = stream ?: return
        if (projection != null) { runCatching { s.changeAudioSource(MicrophoneSource()) }; endProjection(); app?.let { LiveService.start(it, screen = false) } }
        runCatching { s.changeVideoSource(BitmapSource(bitmap)) }
        showing = kind
        setMic(micOn)
    }

    // ---- Screen sharing (with the phone's sound mixed in, like Meet) ----

    fun onProjection(context: Context, mp: MediaProjection) {
        val s = stream ?: return
        projection = mp
        val callback = object : MediaProjection.Callback() {
            override fun onStop() { main.post { if (showing == Showing.Screen) showCamera(context) } }
        }
        mp.registerCallback(callback, main)
        runCatching {
            s.changeVideoSource(ScreenSource(context.applicationContext, mp, callback))
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) s.changeAudioSource(MixAudioSource(mp, callback))
        }.onFailure { error = "Couldn't share the screen: ${it.message}"; return }
        showing = Showing.Screen
        setMic(micOn)
    }

    private fun endProjection() { runCatching { projection?.stop() }; projection = null }

    // ---- Slides ----

    fun openSlides(file: File): Boolean {
        closeSlides()
        val count = runCatching { PdfRenderer(ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)).use { it.pageCount } }.getOrDefault(0)
        if (count == 0) return false
        slideFile = file; slideCount = count; slide = 0
        showSlide(0)
        return true
    }

    fun showSlide(index: Int) {
        val file = slideFile ?: return
        val i = index.coerceIn(0, slideCount - 1)
        val bmp = runCatching {
            PdfRenderer(ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)).use { r ->
                r.openPage(i).use { page ->
                    val out = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                    val c = Canvas(out)
                    c.drawColor(android.graphics.Color.rgb(12, 12, 14))
                    // Fit the page inside the picture.
                    val scale = minOf(width.toFloat() / page.width, height.toFloat() / page.height)
                    val pw = (page.width * scale).toInt(); val ph = (page.height * scale).toInt()
                    val pageBmp = Bitmap.createBitmap(pw, ph, Bitmap.Config.ARGB_8888).apply { eraseColor(android.graphics.Color.WHITE) }
                    page.render(pageBmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                    c.drawBitmap(pageBmp, ((width - pw) / 2).toFloat(), ((height - ph) / 2).toFloat(), null)
                    out
                }
            }
        }.getOrNull() ?: return
        slide = i
        showCard(Showing.Slides, bmp)
    }

    private fun closeSlides() { slideFile?.delete(); slideFile = null; slideCount = 0; slide = 0 }

    // ---- Graphics over the picture ----

    private fun addFilters() {
        val s = stream ?: return
        if (!filtersAdded) {
            s.getGlInterface().addFilter(logoFilter)
            s.getGlInterface().addFilter(bannerFilter)
            filtersAdded = true
        }
        applyLogo(); applyBanner()
    }

    fun setLogo(on: Boolean) { logoOn = on; applyLogo() }
    fun setBanner(on: Boolean, name: String = bannerName, title: String = bannerTitle) { bannerOn = on; bannerName = name; bannerTitle = title; applyBanner() }

    private fun applyLogo() {
        val ctx = app ?: return
        val bmp = BitmapFactory.decodeResource(ctx.resources, R.drawable.dove_mark) ?: return
        logoFilter.setImage(bmp)
        val wPct = if (width > height) 7f else 12f
        logoFilter.setScale(wPct, wPct * width / height * bmp.height / bmp.width)
        logoFilter.setPosition(TranslateTo.TOP_RIGHT)
        logoFilter.alpha = if (logoOn) 0.85f else 0f
    }

    private fun applyBanner() {
        val bmp = bannerBitmap(bannerName, bannerTitle)
        bannerFilter.setImage(bmp)
        val wPct = if (width > height) 55f else 85f
        bannerFilter.setScale(wPct, wPct * width / height * bmp.height / bmp.width)
        bannerFilter.setPosition(4f, 100f - (wPct * width / height * bmp.height / bmp.width) - 5f)
        bannerFilter.alpha = if (bannerOn) 1f else 0f
    }

    // A lower third: gold bar, name, then the service title.
    private fun bannerBitmap(name: String, title: String): Bitmap {
        val w = 1100; val h = 220
        val b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val c = Canvas(b)
        val bg = Paint(Paint.ANTI_ALIAS_FLAG).apply { shader = LinearGradient(0f, 0f, w.toFloat(), 0f, intArrayOf(0xF0101012.toInt(), 0xD0101012.toInt(), 0x00101012), floatArrayOf(0f, 0.75f, 1f), Shader.TileMode.CLAMP) }
        c.drawRoundRect(RectF(0f, 0f, w.toFloat(), h.toFloat()), 24f, 24f, bg)
        val gold = Paint(Paint.ANTI_ALIAS_FLAG).apply { shader = LinearGradient(0f, 0f, 0f, h.toFloat(), 0xFFF0D27A.toInt(), 0xFFA8841F.toInt(), Shader.TileMode.CLAMP) }
        c.drawRoundRect(RectF(0f, 0f, 16f, h.toFloat()), 8f, 8f, gold)
        val namePaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { color = android.graphics.Color.WHITE; textSize = 78f; typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD) }
        val titlePaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFF0D27A.toInt(); textSize = 52f; typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL) }
        c.drawText(ellipsize(name.ifBlank { "Shekinah Sons Global" }, namePaint, w - 80f), 50f, 100f, namePaint)
        c.drawText(ellipsize(title, titlePaint, w - 80f), 50f, 175f, titlePaint)
        return b
    }

    private fun ellipsize(text: String, paint: TextPaint, max: Float) = android.text.TextUtils.ellipsize(text, paint, max, android.text.TextUtils.TruncateAt.END).toString()

    // Full-picture cards (camera paused, be right back).
    private fun card(label: String, title: String, line: String): Bitmap {
        val b = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val c = Canvas(b)
        c.drawPaint(Paint().apply { shader = LinearGradient(0f, 0f, width.toFloat(), height.toFloat(), 0xFF2A2006.toInt(), 0xFF07070A.toInt(), Shader.TileMode.CLAMP) })
        val unit = minOf(width, height) / 100f
        app?.let { ctx -> BitmapFactory.decodeResource(ctx.resources, R.drawable.dove_mark)?.let { logo ->
            val size = unit * 26; val left = (width - size) / 2; val top = height / 2f - unit * 40
            c.drawBitmap(logo, null, RectF(left, top, left + size, top + size), null)
        } }
        val center = Paint.Align.CENTER
        c.drawText(label, width / 2f, height / 2f + unit * 6, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFD4AF37.toInt(); textSize = unit * 5; textAlign = center; letterSpacing = 0.2f; typeface = Typeface.DEFAULT_BOLD })
        c.drawText(title, width / 2f, height / 2f + unit * 16, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = android.graphics.Color.WHITE; textSize = unit * 8; textAlign = center; typeface = Typeface.DEFAULT_BOLD })
        c.drawText(line, width / 2f, height / 2f + unit * 25, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFB8B8BD.toInt(); textSize = unit * 4.5f; textAlign = center })
        return b
    }

    // Scripture on screen, the way a projector shows it in church.
    private fun verseCard(reference: String, text: String): Bitmap {
        val b = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val c = Canvas(b)
        c.drawPaint(Paint().apply { shader = LinearGradient(0f, 0f, 0f, height.toFloat(), 0xFF0E1A3A.toInt(), 0xFF050508.toInt(), Shader.TileMode.CLAMP) })
        val unit = minOf(width, height) / 100f
        val margin = (width * 0.1f).toInt()
        val paint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { color = android.graphics.Color.WHITE; typeface = Typeface.create(Typeface.SERIF, Typeface.NORMAL) }
        var size = unit * 9
        var layout: StaticLayout
        do {
            paint.textSize = size
            layout = StaticLayout.Builder.obtain("“$text”", 0, text.length + 2, paint, width - margin * 2).setAlignment(Layout.Alignment.ALIGN_CENTER).setLineSpacing(0f, 1.2f).build()
            size *= 0.92f
        } while (layout.height > height * 0.62f && size > unit * 3)
        val top = (height - layout.height) / 2f - unit * 6
        c.save(); c.translate(margin.toFloat(), top); layout.draw(c); c.restore()
        c.drawText(reference.uppercase(), width / 2f, top + layout.height + unit * 12,
            Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFD4AF37.toInt(); textSize = unit * 5.5f; textAlign = Paint.Align.CENTER; letterSpacing = 0.15f; typeface = Typeface.DEFAULT_BOLD })
        return b
    }
}

// Keeps the broadcast (camera, microphone, screen) running while the host is
// in another app, e.g. sharing their screen. Android requires this.
class LiveService : Service() {
    companion object {
        private const val CHANNEL = "broadcast"
        private const val ID = 4401

        fun start(context: Context, screen: Boolean, resultCode: Int = 0, data: Intent? = null) {
            val i = Intent(context, LiveService::class.java).putExtra("screen", screen).putExtra("resultCode", resultCode)
            if (data != null) i.putExtra("data", data)
            androidx.core.content.ContextCompat.startForegroundService(context, i)
        }

        fun stop(context: Context) { context.stopService(Intent(context, LiveService::class.java)) }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "Broadcasting", NotificationManager.IMPORTANCE_LOW))
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE)
        val screen = intent?.getBooleanExtra("screen", false) == true
        val notification: Notification = NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.dove_mark)
            .setContentTitle(if (screen) "You're live · sharing your screen" else "You're live")
            .setContentText("Tap to return to the broadcast")
            .setOngoing(true).setContentIntent(open).build()
        var types = ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
        if (screen) types = types or ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
        runCatching { ServiceCompat.startForeground(this, ID, notification, types) }
            .onFailure { Broadcast.failed("Android didn't allow the broadcast to keep running: ${it.message}"); stopSelf(); return START_NOT_STICKY }

        // The screen capture can only begin once this service is running.
        val data = if (Build.VERSION.SDK_INT >= 33) intent?.getParcelableExtra("data", Intent::class.java) else @Suppress("DEPRECATION") intent?.getParcelableExtra("data")
        if (screen && data != null) {
            val mp = getSystemService(MediaProjectionManager::class.java).getMediaProjection(intent!!.getIntExtra("resultCode", 0), data)
            if (mp != null) Handler(Looper.getMainLooper()).post { Broadcast.onProjection(this, mp) }
        }
        return START_NOT_STICKY
    }
}
