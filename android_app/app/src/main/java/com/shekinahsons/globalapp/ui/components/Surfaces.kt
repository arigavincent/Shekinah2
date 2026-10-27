package com.shekinahsons.globalapp.ui.components

import android.graphics.Bitmap
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.size.Size
import coil3.transform.Transformation
import com.shekinahsons.globalapp.data.Clip
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Inter

// Frosted glass: a faint white wash lit from the top, with a rim of light
// that fades down the edge. Reads as a pane over whatever sits behind it.
fun Modifier.glass(shape: Shape = RoundedCornerShape(50), strength: Float = 1f): Modifier = this
    .clip(shape)
    .background(Brush.verticalGradient(listOf(Color.White.copy(alpha = 0.13f * strength), Color.White.copy(alpha = 0.05f * strength))))
    .border(1.dp, Brush.verticalGradient(listOf(Color.White.copy(alpha = 0.28f * strength), Color.White.copy(alpha = 0.04f * strength))), shape)

// A soft drop shadow, optionally tinted (a gold card casts warm light).
fun Modifier.lifted(shape: Shape, elevation: Dp = 14.dp, tint: Color = Color.Black): Modifier =
    shadow(elevation, shape, clip = false, ambientColor = tint, spotColor = tint)

// Many thumbnails come from videos with black bars baked into the picture.
// This trims those bars off so a card never shows a black band.
object TrimBlackBars : Transformation() {
    override val cacheKey = "trim-black-bars-v1"

    override suspend fun transform(input: Bitmap, size: Size): Bitmap {
        val w = input.width
        val h = input.height
        if (w < 32 || h < 32) return input
        fun rowDark(y: Int): Boolean {
            var dark = 0
            var n = 0
            var x = 0
            while (x < w) {
                val p = input.getPixel(x, y)
                val l = (((p shr 16) and 0xFF) * 3 + ((p shr 8) and 0xFF) * 6 + (p and 0xFF)) / 10
                if (l < 22) dark++
                n++; x += 8
            }
            return dark >= n * 0.97
        }
        fun colDark(x: Int, top: Int, bottom: Int): Boolean {
            var dark = 0
            var n = 0
            var y = top
            while (y < bottom) {
                val p = input.getPixel(x, y)
                val l = (((p shr 16) and 0xFF) * 3 + ((p shr 8) and 0xFF) * 6 + (p and 0xFF)) / 10
                if (l < 22) dark++
                n++; y += 8
            }
            return dark >= n * 0.97
        }
        var top = 0
        while (top < h / 3 && rowDark(top)) top += 2
        var bottom = h - 1
        while (bottom > h * 2 / 3 && rowDark(bottom)) bottom -= 2
        var left = 0
        while (left < w / 3 && colDark(left, top, bottom)) left += 2
        var right = w - 1
        while (right > w * 2 / 3 && colDark(right, top, bottom)) right -= 2
        // Only trim real bars, not a dark scene: each bar must be a clear strip.
        val trimTop = if (top > h * 0.04) top else 0
        val trimBottom = if (h - 1 - bottom > h * 0.04) bottom else h - 1
        val trimLeft = if (left > w * 0.04) left else 0
        val trimRight = if (w - 1 - right > w * 0.04) right else w - 1
        if (trimTop == 0 && trimBottom == h - 1 && trimLeft == 0 && trimRight == w - 1) return input
        return Bitmap.createBitmap(input, trimLeft, trimTop, trimRight - trimLeft + 1, trimBottom - trimTop + 1)
    }
}

// A recap: portrait card, picture edge to edge, title and length set on a
// dark fade at the bottom, a glass play button, and a soft shadow.
@Composable
fun RecapTile(c: Clip, modifier: Modifier = Modifier, onOpen: () -> Unit) {
    val shape = RoundedCornerShape(20.dp)
    Box(modifier.lifted(shape, 12.dp).clip(shape).pressable(onOpen)) {
        FadeImage(c.image, Modifier.fillMaxSize(), label = "RECAP")
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color(0x33000000), 0.35f to Color.Transparent, 0.55f to Color.Transparent, 1f to Color(0xF0000000))))
        Box(Modifier.fillMaxSize().border(1.dp, Brush.verticalGradient(listOf(Color(0x33FFFFFF), Color(0x08FFFFFF))), shape))
        if (c.duration.isNotBlank()) {
            Text(
                c.duration, color = Color.White, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 11.sp,
                modifier = Modifier.align(Alignment.TopStart).padding(10.dp).glass().padding(horizontal = 8.dp, vertical = 3.dp),
            )
        }
        Box(Modifier.align(Alignment.Center).size(46.dp).glass(CircleShape, 1.3f), contentAlignment = Alignment.Center) {
            Icon(Icons.Rounded.PlayArrow, "Play", tint = Color.White, modifier = Modifier.size(28.dp))
        }
        Column(Modifier.align(Alignment.BottomStart).padding(12.dp)) {
            Box(Modifier.width(22.dp).height(3.dp).background(Brand.GoldGradient, RoundedCornerShape(2.dp)))
            Spacer(Modifier.height(6.dp))
            Text(c.title, color = Color.White, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 13.5.sp, lineHeight = 17.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
    }
}
