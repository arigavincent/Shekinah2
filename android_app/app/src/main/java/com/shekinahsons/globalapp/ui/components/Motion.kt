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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.BlurredEdgeTreatment
import androidx.compose.ui.draw.blur
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import coil3.compose.AsyncImagePainter
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
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !imageUrl.isNullOrBlank()) {
        AsyncImage(
            model = imageUrl,
            contentDescription = null,
            contentScale = ContentScale.Crop,
            colorFilter = saturation(1.8f),
            modifier = modifier
                .graphicsLayer { this.alpha = alpha }
                .blur(blur, BlurredEdgeTreatment.Unbounded),
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

// Image that fades in over a soft placeholder instead of popping in.
@Composable
fun FadeImage(url: String?, modifier: Modifier = Modifier, contentScale: ContentScale = ContentScale.Crop) {
    var loaded by remember(url) { mutableStateOf(false) }
    val alpha by animateFloatAsState(if (loaded) 1f else 0f, label = "fade")
    Box(modifier.background(Brand.Surface2)) {
        AsyncImage(
            model = url,
            contentDescription = null,
            contentScale = contentScale,
            onState = { if (it is AsyncImagePainter.State.Success) loaded = true },
            modifier = Modifier.fillMaxSize().graphicsLayer { this.alpha = alpha },
        )
    }
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
