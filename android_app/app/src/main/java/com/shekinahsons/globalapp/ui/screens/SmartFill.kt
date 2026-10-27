package com.shekinahsons.globalapp.ui.screens

import android.graphics.Bitmap
import android.os.Handler
import android.os.Looper
import android.view.PixelCopy
import android.view.SurfaceView
import android.view.View
import androidx.media3.common.Player
import androidx.media3.ui.PlayerView
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.math.abs

// Full screen without a "screen inside a screen", and without cutting the
// verse banners the media team lays across the bottom of the picture.
//
// The picture is zoomed to fill the display. About twice a second a tiny
// copy of the frame is checked for a banner in the lower part: a sharp
// straight edge running across most of the width, or a strong orange or
// white stripe. While a banner shows, the picture eases back, anchored at
// the bottom, so the whole banner is visible; when it goes, it fills again.
object SmartFill {
    private const val W = 128
    private const val H = 72

    suspend fun run(view: PlayerView, player: Player, enabled: Boolean) {
        val frame = view.findViewById<View>(androidx.media3.ui.R.id.exo_content_frame) ?: return
        if (!enabled) { animate(frame, 1f); return }
        var banner = false
        var hits = 0
        var misses = 0
        var shown = -1f
        val sample = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888)
        try {
            while (true) {
                val size = player.videoSize
                val vw = view.width.toFloat()
                val vh = view.height.toFloat()
                if (size.width > 0 && size.height > 0 && vw > 0 && vh > 0) {
                    val video = size.width * size.pixelWidthHeightRatio / size.height
                    val screen = vw / vh
                    val fillZoom = if (screen > video) screen / video else video / screen

                    val surface = view.videoSurfaceView as? SurfaceView
                    if (player.isPlaying && surface != null && surface.holder.surface.isValid && copy(surface, sample)) {
                        if (hasBanner(sample)) { hits++; misses = 0 } else { misses++; hits = 0 }
                        if (!banner && hits >= 2) banner = true
                        if (banner && misses >= 5) banner = false
                    }
                    // With a banner: keep the bottom edge in place and only
                    // zoom part way, so the banner shows and the bars stay slim.
                    val target = if (banner) 1f + (fillZoom - 1f) * 0.35f else fillZoom
                    if (abs(target - shown) > 0.005f) {
                        frame.pivotX = frame.width / 2f
                        frame.pivotY = if (banner) frame.height.toFloat() else frame.height / 2f
                        animate(frame, target)
                        shown = target
                    }
                }
                delay(450)
            }
        } finally {
            sample.recycle()
        }
    }

    private fun animate(frame: View, zoom: Float) {
        frame.animate().scaleX(zoom).scaleY(zoom).setDuration(450).start()
    }

    private suspend fun copy(surface: SurfaceView, into: Bitmap): Boolean = suspendCancellableCoroutine { done ->
        runCatching {
            PixelCopy.request(surface, into, { result -> if (done.isActive) done.resume(result == PixelCopy.SUCCESS) }, Handler(Looper.getMainLooper()))
        }.onFailure { if (done.isActive) done.resume(false) }
    }

    private fun luma(p: Int) = (((p shr 16) and 0xFF) * 3 + ((p shr 8) and 0xFF) * 6 + (p and 0xFF)) / 10

    private fun hasBanner(b: Bitmap): Boolean {
        val px = IntArray(W * H)
        b.getPixels(px, 0, W, 0, 0, W, H)
        val from = (H * 0.62f).toInt()
        for (y in from until H - 1) {
            var edge = 0
            var orange = 0
            var white = 0
            for (x in 0 until W) {
                val p = px[y * W + x]
                val q = px[(y + 1) * W + x]
                if (abs(luma(p) - luma(q)) > 38) edge++
                val r = (p shr 16) and 0xFF
                val g = (p shr 8) and 0xFF
                val bl = p and 0xFF
                if (r > 190 && g in 70..175 && bl < 90) orange++
                if (r > 225 && g > 225 && bl > 225) white++
            }
            // A banner's border is a straight line across most of the frame.
            if (edge > W * 0.62f || orange > W * 0.55f || white > W * 0.7f) return true
        }
        return false
    }
}
