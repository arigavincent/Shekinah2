package com.shekinahsons.globalapp.ui.components

import android.os.Build
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.BlurredEdgeTreatment
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import coil3.compose.AsyncImagePainter
import coil3.request.transformations
import com.shekinahsons.globalapp.ui.theme.Brand

// Springy press: the card sinks slightly under the finger and bounces back.
fun Modifier.pressable(onClick: () -> Unit): Modifier = composed {
    val source = remember { MutableInteractionSource() }
    val pressed by source.collectIsPressedAsState()
    val scale by animateFloatAsState(
        if (pressed) 0.955f else 1f,
        spring(dampingRatio = 0.55f, stiffness = Spring.StiffnessMediumLow),
        label = "press",
    )
    val haptics = LocalHapticFeedback.current
    graphicsLayer { scaleX = scale; scaleY = scale }
        .clickable(interactionSource = source, indication = null) {
            haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
            onClick()
        }
}

// Lets a glow layer grow past the card it sits behind (and drop a little
// lower, like light falling on a surface) while the card keeps its size.
fun Modifier.outset(spread: Dp, drop: Dp = 0.dp): Modifier = layout { measurable, constraints ->
    val e = spread.roundToPx()
    val w = constraints.maxWidth
    val h = constraints.maxHeight
    val placeable = measurable.measure(androidx.compose.ui.unit.Constraints.fixed(w + 2 * e, h + 2 * e))
    layout(w, h) { placeable.place(-e, -e + drop.roundToPx()) }
}

private fun saturation(amount: Float) = ColorFilter.colorMatrix(ColorMatrix().apply { setToSaturation(amount) })

// "Ambient mode": a blurred, colour-boosted copy of the artwork glowing
// behind it like light spilling off a screen. Needs Android 12+ for the
// GPU blur; older phones get a soft gold wash instead.
@Composable
fun AmbientGlow(
    imageUrl: String?,
    modifier: Modifier = Modifier,
    blur: Dp = 38.dp,
    alpha: Float = 0.95f,
    fallback: Color = Brand.Gold,
) {
    // Alpha goes on the painter, not a layer: a layer with alpha would clip
    // the blur to the card's bounds and kill the spill.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !imageUrl.isNullOrBlank()) {
        AsyncImage(
            model = imageUrl,
            contentDescription = null,
            contentScale = ContentScale.Crop,
            alpha = alpha,
            colorFilter = saturation(1.9f),
            modifier = modifier.blur(blur, BlurredEdgeTreatment.Unbounded),
        )
    } else {
        ColorGlow(fallback.copy(alpha = 0.55f * alpha), modifier, blur)
    }
}

// Solid-colour glow (gold for audio, red for live).
@Composable
fun ColorGlow(color: Color, modifier: Modifier = Modifier, blur: Dp = 38.dp) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        Box(modifier.blur(blur, BlurredEdgeTreatment.Unbounded).background(color, androidx.compose.foundation.shape.RoundedCornerShape(24.dp)))
    } else {
        Box(modifier.background(Brush.radialGradient(listOf(color, Color.Transparent))))
    }
}

// Pictures already revealed in this session: coming back to them shows
// them at once instead of replaying the effect.
private val revealed = java.util.Collections.synchronizedSet(HashSet<String>())

// Phaneroo's loading effect (cached_network_image): the first time a
// picture is shown, a branded card holds the spot for a beat, then the real
// picture fades in over it while the card dissolves. Baked-in black bars
// are trimmed off the picture.
@Composable
fun FadeImage(url: String?, modifier: Modifier = Modifier, contentScale: ContentScale = ContentScale.Crop, label: String = "SERMON") {
    val context = coil3.compose.LocalPlatformContext.current
    val request = remember(url) {
        coil3.request.ImageRequest.Builder(context).data(url).transformations(TrimBlackBars).build()
    }
    val painter = coil3.compose.rememberAsyncImagePainter(request, contentScale = contentScale)
    val state by painter.state.collectAsState()
    val loaded = state is AsyncImagePainter.State.Success
    val firstSight = remember(url) { !url.isNullOrBlank() && url !in revealed }
    val shownAt = remember(url) { System.currentTimeMillis() }
    var show by remember(url) { mutableStateOf(false) }
    androidx.compose.runtime.LaunchedEffect(url, loaded) {
        if (!loaded) return@LaunchedEffect
        // Let the branded card be seen for a moment before the reveal.
        if (firstSight) kotlinx.coroutines.delay((650 - (System.currentTimeMillis() - shownAt)).coerceAtLeast(0))
        show = true
        url?.let { revealed += it }
    }
    val alpha by animateFloatAsState(
        if (show) 1f else 0f,
        if (firstSight) androidx.compose.animation.core.tween(700, easing = androidx.compose.animation.core.LinearOutSlowInEasing) else androidx.compose.animation.core.snap(),
        label = "fade",
    )
    Box(modifier.clipToBounds().background(Brand.Surface2)) {
        if (alpha < 1f && (firstSight || url.isNullOrBlank() || state is AsyncImagePainter.State.Error)) {
            BrandPlaceholder(label, Modifier.fillMaxSize().graphicsLayer { this.alpha = 1f - alpha * alpha })
        }
        androidx.compose.foundation.Image(
            painter = painter,
            contentDescription = null,
            contentScale = contentScale,
            modifier = Modifier.fillMaxSize().graphicsLayer {
                this.alpha = alpha
                // A gentle settle as it appears, like a print coming into focus.
                val s = 1.04f - 0.04f * alpha
                scaleX = s; scaleY = s
            },
        )
    }
}

// The stand-in card: dark, washed gold to blue from the corners, with the
// ministry name and what is loading in big letters, and the dove behind.
@Composable
fun BrandPlaceholder(label: String, modifier: Modifier = Modifier) {
    androidx.compose.foundation.layout.BoxWithConstraints(
        modifier.background(Brush.linearGradient(listOf(Color(0xFF4A3608), Color(0xFF17140D), Color(0xFF101114), Color(0xFF0D1E48)))),
        contentAlignment = androidx.compose.ui.Alignment.Center,
    ) {
        val w = maxWidth.value
        // Thumbnails are too small for words: show the dove clearly instead.
        if (w < 120f) {
            androidx.compose.foundation.Image(
                androidx.compose.ui.res.painterResource(com.shekinahsons.globalapp.R.drawable.dove_mark), null,
                Modifier.fillMaxSize(0.6f).graphicsLayer { alpha = 0.55f },
            )
            return@BoxWithConstraints
        }
        androidx.compose.foundation.Image(
            androidx.compose.ui.res.painterResource(com.shekinahsons.globalapp.R.drawable.dove_mark), null,
            Modifier.fillMaxSize(0.9f).graphicsLayer { alpha = 0.07f },
        )
        androidx.compose.foundation.layout.Column(horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally) {
            androidx.compose.material3.Text(
                "SHEKINAH SONS GLOBAL",
                color = Color.Black,
                fontFamily = com.shekinahsons.globalapp.ui.theme.Inter,
                fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
                fontSize = (w * 0.032f).coerceIn(6f, 12f).sp,
                letterSpacing = (w * 0.004f).coerceAtMost(1.5f).sp,
                modifier = Modifier.background(Brand.GoldGradient, androidx.compose.foundation.shape.RoundedCornerShape(50))
                    .padding(horizontal = (w * 0.03f).dp, vertical = (w * 0.008f).dp),
            )
            androidx.compose.material3.Text(
                label,
                color = Color.White,
                fontFamily = com.shekinahsons.globalapp.ui.theme.Poster,
                fontSize = (w * 0.12f).sp,
                letterSpacing = (w * 0.01f).sp,
            )
        }
    }
}

// Phaneroo's scroll entrance: a row rising into view from the bottom edge
// starts smaller and grows to full size as it settles on screen.
fun Modifier.scrollEntrance(state: androidx.compose.foundation.lazy.LazyListState, index: Int): Modifier = graphicsLayer {
    val info = state.layoutInfo
    val item = info.visibleItemsInfo.firstOrNull { it.index == index } ?: return@graphicsLayer
    val end = info.viewportEndOffset.toFloat()
    val zone = end * 0.3f
    val fromBottom = end - item.offset.toFloat()
    val t = (fromBottom / zone).coerceIn(0f, 1f)
    val eased = 1f - (1f - t) * (1f - t)
    val scale = 0.72f + 0.28f * eased
    scaleX = scale; scaleY = scale
    alpha = 0.35f + 0.65f * eased
    transformOrigin = androidx.compose.ui.graphics.TransformOrigin(0.5f, 0f)
}

@Composable
fun PulsingDot(color: Color = Color.White, size: Dp = 7.dp) {
    val t = androidx.compose.animation.core.rememberInfiniteTransition(label = "pulse")
    val p by t.animateFloat(
        0f, 1f,
        androidx.compose.animation.core.infiniteRepeatable(androidx.compose.animation.core.tween(1000)),
        label = "p",
    )
    Box(androidx.compose.ui.Modifier.size(size), contentAlignment = androidx.compose.ui.Alignment.Center) {
        Box(Modifier.size(size).graphicsLayer { scaleX = 1f + p * 1.6f; scaleY = scaleX; alpha = 0.7f * (1f - p) }.background(color, androidx.compose.foundation.shape.CircleShape))
        Box(Modifier.size(size).background(color, androidx.compose.foundation.shape.CircleShape))
    }
}

@Composable
fun Breathing(periodMs: Int = 3200, from: Float = 0.75f, to: Float = 1f): Float {
    val t = androidx.compose.animation.core.rememberInfiniteTransition(label = "breathe")
    val v by t.animateFloat(
        from, to,
        androidx.compose.animation.core.infiniteRepeatable(
            androidx.compose.animation.core.tween(periodMs, easing = androidx.compose.animation.core.FastOutSlowInEasing),
            androidx.compose.animation.core.RepeatMode.Reverse,
        ),
        label = "v",
    )
    return v
}
