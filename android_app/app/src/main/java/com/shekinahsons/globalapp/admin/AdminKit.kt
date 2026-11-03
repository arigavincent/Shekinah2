package com.shekinahsons.globalapp.admin

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.ui.components.personColor
import com.shekinahsons.globalapp.ui.components.initials
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Type

// Shared look for the admin tool pages: a stats strip, a search bar, filter
// pills, list rows, badges, section cards and empty states.

internal val KitGreen = Color(0xFF4ADE80)
internal val KitRed = Color(0xFFFF6B6B)
internal val KitBlue = Color(0xFF6EA8FF)
internal val KitViolet = Color(0xFFB79CFF)

internal data class Stat(val value: String, val label: String, val tint: Color = Brand.Gold)

@Composable
internal fun StatStrip(stats: List<Stat>) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        stats.forEach { s ->
            Column(
                Modifier.weight(1f).clip(RoundedCornerShape(16.dp))
                    .background(Brush.verticalGradient(listOf(s.tint.copy(alpha = 0.14f), Color(0x0AFFFFFF))))
                    .border(1.dp, s.tint.copy(alpha = 0.25f), RoundedCornerShape(16.dp))
                    .padding(horizontal = 12.dp, vertical = 10.dp),
            ) {
                Text(s.value, color = Brand.White, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 20.sp, maxLines = 1)
                Text(s.label, style = Type.Meta.copy(fontSize = 11.sp), color = Brand.Text2, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

@Composable
internal fun SearchBar(value: String, onChange: (String) -> Unit, hint: String) {
    Row(
        Modifier.fillMaxWidth().height(48.dp).clip(RoundedCornerShape(50)).background(Color(0x14FFFFFF))
            .border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(50)).padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Rounded.Search, null, tint = Brand.Text2, modifier = Modifier.size(20.dp))
        Spacer(Modifier.width(10.dp))
        Box(Modifier.weight(1f)) {
            if (value.isEmpty()) Text(hint, color = Brand.Muted, fontSize = 14.5.sp, fontFamily = Inter)
            BasicTextField(value, onChange, singleLine = true, cursorBrush = SolidColor(Brand.Gold),
                textStyle = TextStyle(color = Brand.White, fontSize = 14.5.sp, fontFamily = Inter), modifier = Modifier.fillMaxWidth())
        }
        if (value.isNotEmpty()) Icon(Icons.Rounded.Close, "Clear", tint = Brand.Text2, modifier = Modifier.size(28.dp).clip(CircleShape).clickable { onChange("") }.padding(4.dp))
    }
}

@Composable
internal fun FilterPills(options: List<Pair<String, String>>, current: String, select: (String) -> Unit) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(options) { (key, label) ->
            val on = key == current
            Text(label, color = if (on) Brand.Black else Brand.White, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                modifier = Modifier.clip(RoundedCornerShape(50))
                    .background(if (on) Brand.GoldGradient else SolidColor(Color(0x14FFFFFF)))
                    .clickable { select(key) }.padding(horizontal = 14.dp, vertical = 8.dp))
        }
    }
}

@Composable
internal fun Badge(text: String, tint: Color) {
    Text(text, color = tint, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 10.5.sp, letterSpacing = 0.6.sp, maxLines = 1,
        modifier = Modifier.clip(RoundedCornerShape(50)).background(tint.copy(alpha = 0.14f)).padding(horizontal = 8.dp, vertical = 3.dp))
}

@Composable
internal fun PersonAvatar(name: String, key: String, size: Int = 44) {
    val c = personColor(key)
    Box(Modifier.size(size.dp).clip(CircleShape).background(Brush.linearGradient(listOf(c, c.copy(alpha = 0.6f)))), contentAlignment = Alignment.Center) {
        Text(initials(name), color = Color.White, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = (size * 0.36f).sp)
    }
}

// One row in a list: leading (avatar or icon), title, up to two lines, trailing.
@Composable
internal fun KitRow(title: String, line1: String = "", line2: String = "", leading: @Composable () -> Unit, trailing: @Composable () -> Unit = {}, onClick: (() -> Unit)? = null) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Brush.linearGradient(listOf(Color(0xFF1B1A1F), Color(0xFF131316))))
            .border(1.dp, Color(0x14FFFFFF), RoundedCornerShape(18.dp))
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier).padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        leading()
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, color = Brand.White, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (line1.isNotBlank()) Text(line1, style = Type.Meta, color = Brand.Text2, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (line2.isNotBlank()) Text(line2, style = Type.Meta.copy(fontSize = 11.5.sp), color = Brand.Muted, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Spacer(Modifier.width(8.dp))
        trailing()
    }
}

@Composable
internal fun IconTile(icon: ImageVector, tint: Color, size: Int = 44) {
    Box(Modifier.size(size.dp).clip(RoundedCornerShape(14.dp)).background(tint.copy(alpha = 0.15f)), contentAlignment = Alignment.Center) {
        Icon(icon, null, tint = tint, modifier = Modifier.size((size * 0.5f).dp))
    }
}

// A titled card grouping related settings or actions.
@Composable
internal fun KitSection(title: String, subtitle: String = "", content: @Composable ColumnScope.() -> Unit) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Color(0xFF17171B))
            .border(1.dp, Color(0x14FFFFFF), RoundedCornerShape(20.dp)).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Column {
            Text(title.uppercase(), style = Type.Label.copy(fontSize = 10.5.sp), color = Brand.Gold)
            if (subtitle.isNotBlank()) Text(subtitle, style = Type.Meta, color = Brand.Text2)
        }
        content()
    }
}

@Composable
internal fun SectionHeading(title: String, action: String? = null, onAction: () -> Unit = {}) {
    Row(Modifier.fillMaxWidth().padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(title, style = Type.Title.copy(fontSize = 17.sp), color = Brand.White, modifier = Modifier.weight(1f))
        if (action != null) Text(action, color = Brand.Black, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 13.sp,
            modifier = Modifier.clip(RoundedCornerShape(50)).background(Brand.GoldGradient).clickable(onClick = onAction).padding(horizontal = 14.dp, vertical = 8.dp))
    }
}

@Composable
internal fun EmptyState(icon: ImageVector, title: String, sub: String) {
    Column(Modifier.fillMaxWidth().padding(vertical = 30.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        IconTile(icon, Brand.Gold, 56)
        Spacer(Modifier.height(12.dp))
        Text(title, style = Type.CardTitle, color = Brand.White)
        Text(sub, style = Type.Meta, color = Brand.Text2)
    }
}

@Composable
internal fun Loading() {
    Box(Modifier.fillMaxWidth().padding(28.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Brand.Gold) }
}

@Composable
internal fun ActionPill(label: String, icon: ImageVector, tint: Color = Brand.White, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Row(
        modifier.clip(RoundedCornerShape(50)).background(tint.copy(alpha = 0.12f)).border(1.dp, tint.copy(alpha = 0.25f), RoundedCornerShape(50))
            .clickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center,
    ) {
        Icon(icon, null, tint = tint, modifier = Modifier.size(17.dp))
        Spacer(Modifier.width(6.dp))
        Text(label, color = tint, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, maxLines = 1)
    }
}
