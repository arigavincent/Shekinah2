package com.shekinahsons.globalapp.admin

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Type

// Admin tools as a grid of cards, grouped; a tool opens on its own page with
// a back arrow (and the phone's back gesture) to return to the cards.
internal data class AdminTool(val id: String, val label: String, val sub: String, val icon: ImageVector, val tint: Color = Brand.Gold)

internal fun LazyListScope.toolHub(groups: List<Pair<String, List<AdminTool>>>, pick: (String) -> Unit) {
    groups.forEach { (group, tools) ->
        item(key = "g-$group") {
            Text(group.uppercase(), style = Type.Label.copy(fontSize = 10.5.sp), color = Brand.Gold, modifier = Modifier.padding(top = 10.dp, bottom = 2.dp, start = 2.dp))
        }
        tools.chunked(2).forEachIndexed { i, row ->
            item(key = "r-$group-$i") {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    row.forEach { ToolCard(it, Modifier.weight(1f)) { pick(it.id) } }
                    if (row.size == 1) Spacer(Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun ToolCard(t: AdminTool, modifier: Modifier, onClick: () -> Unit) {
    val shape = RoundedCornerShape(20.dp)
    Column(
        modifier.height(112.dp).clip(shape)
            .background(Brush.linearGradient(listOf(Color(0xFF1C1B20), Color(0xFF121215))))
            .border(1.dp, Brush.linearGradient(listOf(t.tint.copy(alpha = 0.35f), Color(0x14FFFFFF))), shape)
            .clickable(onClick = onClick).padding(14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(36.dp).clip(RoundedCornerShape(11.dp)).background(t.tint.copy(alpha = 0.16f)), contentAlignment = Alignment.Center) {
                Icon(t.icon, null, tint = t.tint, modifier = Modifier.size(22.dp))
            }
            Spacer(Modifier.weight(1f))
            Icon(Icons.AutoMirrored.Rounded.KeyboardArrowRight, null, tint = Color(0x66FFFFFF), modifier = Modifier.size(20.dp))
        }
        Spacer(Modifier.weight(1f))
        Text(t.label, color = Brand.White, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(t.sub, style = Type.Meta.copy(fontSize = 11.5.sp, lineHeight = 15.sp), color = Brand.Text2, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
internal fun ToolHeader(t: AdminTool, back: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(bottom = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(42.dp).clip(CircleShape).background(Color(0x1AFFFFFF)).clickable(onClick = back), contentAlignment = Alignment.Center) {
            Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back to tools", tint = Brand.White, modifier = Modifier.size(22.dp))
        }
        Spacer(Modifier.width(12.dp))
        Box(Modifier.size(36.dp).clip(RoundedCornerShape(11.dp)).background(t.tint.copy(alpha = 0.16f)), contentAlignment = Alignment.Center) {
            Icon(t.icon, null, tint = t.tint, modifier = Modifier.size(20.dp))
        }
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(t.label, style = Type.Title, color = Brand.White, maxLines = 1)
            Text(t.sub, style = Type.Meta, color = Brand.Text2, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}
