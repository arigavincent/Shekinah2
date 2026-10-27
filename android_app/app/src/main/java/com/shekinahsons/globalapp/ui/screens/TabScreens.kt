package com.shekinahsons.globalapp.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.MenuBook
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.TextDecrease
import androidx.compose.material.icons.rounded.TextIncrease
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.data.Clip
import com.shekinahsons.globalapp.data.Devotion
import com.shekinahsons.globalapp.data.HomeContent
import com.shekinahsons.globalapp.data.Sermon
import com.shekinahsons.globalapp.ui.components.AmbientGlow
import com.shekinahsons.globalapp.ui.components.Breathing
import com.shekinahsons.globalapp.ui.components.ColorGlow
import com.shekinahsons.globalapp.ui.components.FadeImage
import com.shekinahsons.globalapp.ui.components.NavBarHeight
import com.shekinahsons.globalapp.ui.components.TopBar
import com.shekinahsons.globalapp.ui.components.pressable
import com.shekinahsons.globalapp.ui.components.outset
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Scripture
import com.shekinahsons.globalapp.ui.theme.Type

private val bottomGap = NavBarHeight + 110.dp

@Composable
private fun ScreenTitle(title: String, subtitle: String? = null) {
    Column(Modifier.padding(horizontal = 20.dp, vertical = 4.dp)) {
        Text(title, style = Type.Display, color = Brand.White)
        if (subtitle != null) Text(subtitle, style = Type.Meta.copy(fontSize = 13.5.sp), color = Brand.Text2)
    }
}

@Composable
fun DevotionsScreen(content: HomeContent, open: (Devotion) -> Unit) {
    LazyColumn(Modifier.fillMaxSize().background(Brand.Black), contentPadding = PaddingValues(bottom = bottomGap)) {
        item { TopBar() }
        item { ScreenTitle("Devotions", "A word for every day") }
        items(content.devotions, key = { it.id }) { d ->
            Column(Modifier.padding(horizontal = 20.dp, vertical = 10.dp).fillMaxWidth().pressable { open(d) }) {
                Box {
                    AmbientGlow(d.imageUrl, Modifier.matchParentSize().outset(4.dp, drop = 14.dp), blur = 26.dp, alpha = 0.7f)
                    FadeImage(d.imageUrl, Modifier.fillMaxWidth().aspectRatio(2f).clip(RoundedCornerShape(18.dp)))
                }
                Spacer(Modifier.height(12.dp))
                Text(d.date.uppercase(), style = Type.Label, color = Brand.Gold)
                Spacer(Modifier.height(4.dp))
                Text(d.title, style = Type.Title, color = Brand.White)
                Spacer(Modifier.height(4.dp))
                Text(d.excerpt, style = Type.Body.copy(fontSize = 14.sp, lineHeight = 21.sp), color = Brand.Text2, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

@Composable
fun DevotionReader(d: Devotion, onBack: () -> Unit) {
    var scale by rememberSaveable { mutableFloatStateOf(1f) }
    Box(Modifier.fillMaxSize().background(Brand.Black)) {
        Box(Modifier.fillMaxWidth().height(520.dp).clipToBounds()) {
            AmbientGlow(d.imageUrl, Modifier.fillMaxSize(), blur = 70.dp, alpha = 0.85f)
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color(0x44000000), 1f to Brand.Black)))
        }
        LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 60.dp)) {
            item {
                TopBar(title = "", onBack = onBack) {
                    Row {
                        Icon(Icons.Rounded.TextDecrease, "Smaller text", tint = Brand.White, modifier = Modifier.size(40.dp).clip(CircleShape).clickable { scale = (scale - 0.1f).coerceAtLeast(0.8f) }.padding(9.dp))
                        Icon(Icons.Rounded.TextIncrease, "Larger text", tint = Brand.White, modifier = Modifier.size(40.dp).clip(CircleShape).clickable { scale = (scale + 0.1f).coerceAtMost(1.6f) }.padding(9.dp))
                    }
                }
            }
            item {
                Box(Modifier.padding(horizontal = 20.dp)) {
                    AmbientGlow(d.imageUrl, Modifier.matchParentSize().outset(4.dp, drop = 16.dp), blur = 30.dp)
                    FadeImage(d.imageUrl, Modifier.fillMaxWidth().aspectRatio(1.5f).clip(RoundedCornerShape(22.dp)))
                }
            }
            item {
                Column(Modifier.padding(horizontal = 24.dp, vertical = 22.dp)) {
                    Text(d.date.uppercase(), style = Type.Label, color = Brand.Gold)
                    Spacer(Modifier.height(8.dp))
                    Text(d.title, style = Type.Display.copy(fontSize = (26 * scale).sp, lineHeight = (32 * scale).sp), color = Brand.White)
                    Spacer(Modifier.height(18.dp))
                    Text(d.body.ifBlank { d.excerpt }, style = Type.Body.copy(fontSize = (17 * scale).sp, lineHeight = (28 * scale).sp), color = Color(0xFFE6E6EA))
                }
            }
        }
    }
}

