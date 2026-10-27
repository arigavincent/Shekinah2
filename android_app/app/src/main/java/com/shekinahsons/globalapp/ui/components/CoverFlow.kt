package com.shekinahsons.globalapp.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.PageSize
import androidx.compose.foundation.pager.PagerState
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.util.lerp
import kotlin.math.abs

// Signed distance of a page from the snapped position: 0 = in focus,
// 1 = one card to the right, -1 = one card to the left.
fun PagerState.offsetOf(page: Int): Float = (currentPage - page) * -1f - currentPageOffsetFraction

// Phaneroo-style 3D rail: the focused card is full size; the next card
// waits smaller, dimmer and turned away, then swings forward as you swipe.
@Composable
fun <T> CoverFlowRail(
    items: List<T>,
    cardWidth: Dp,
    modifier: Modifier = Modifier,
    spacing: Dp = 14.dp,
    depth: Float = 1f,
    state: PagerState = rememberPagerState { items.size },
    // Focused card sits at the left edge (Phaneroo) instead of the centre.
    startAligned: Boolean = false,
    card: @Composable (item: T, offset: Float) -> Unit,
) {
    HorizontalPager(
        state = state,
        pageSize = PageSize.Fixed(cardWidth),
        pageSpacing = spacing,
        contentPadding = if (startAligned) PaddingValues(start = 16.dp, end = 16.dp) else PaddingValues(horizontal = 20.dp),
        beyondViewportPageCount = 2,
        modifier = modifier.fillMaxWidth(),
    ) { page ->
        val offset = state.offsetOf(page)
        val d = abs(offset).coerceAtMost(2f)
        Box(
            Modifier.graphicsLayer {
                val t = d.coerceAtMost(1f)
                val scale = lerp(1f, 0.86f, t) - (d - t) * 0.06f
                scaleX = scale
                scaleY = scale
                alpha = lerp(1f, 0.55f, t) - (d - t) * 0.25f
                rotationY = (if (offset > 0) -16f else 14f) * t * depth
                cameraDistance = 12f * density
                // Pull side cards toward the focused one so the rail feels stacked.
                translationX = -offset.coerceIn(-1f, 1f) * size.width * 0.06f
                transformOrigin = androidx.compose.ui.graphics.TransformOrigin(if (offset > 0) 0f else 1f, 0.5f)
            },
        ) { card(items[page], offset) }
    }
}
