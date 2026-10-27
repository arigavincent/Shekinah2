package com.shekinahsons.globalapp.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.MenuBook
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.PlayCircle
import androidx.compose.material.icons.outlined.Sensors
import androidx.compose.material.icons.rounded.AutoStories
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.Menu
import androidx.compose.material.icons.rounded.PlayCircle
import androidx.compose.material.icons.rounded.Sensors
import androidx.compose.material.icons.outlined.AutoStories
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.R
import com.shekinahsons.globalapp.ui.Tab
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Type

private fun Tab.icons(): Pair<ImageVector, ImageVector> = when (this) {
    Tab.Home -> Icons.Rounded.Home to Icons.Outlined.Home
    Tab.Sermons -> Icons.Rounded.PlayCircle to Icons.Outlined.PlayCircle
    Tab.Bible -> Icons.AutoMirrored.Rounded.MenuBook to Icons.AutoMirrored.Rounded.MenuBook
    Tab.Devotions -> Icons.Rounded.AutoStories to Icons.Outlined.AutoStories
    Tab.Live -> Icons.Rounded.Sensors to Icons.Outlined.Sensors
}

val NavBarHeight = 72.dp

// Floating pill bar. The active tab sits in a wide gold-tinted pill with
// its icon and label, as in Phaneroo.
@Composable
fun BottomBar(current: Tab, isLive: Boolean, onSelect: (Tab) -> Unit, modifier: Modifier = Modifier) {
    val haptics = LocalHapticFeedback.current
    Row(
        modifier
            .navigationBarsPadding()
            .padding(horizontal = 14.dp, vertical = 10.dp)
            .shadow(24.dp, RoundedCornerShape(34.dp), ambientColor = Color.Black, spotColor = Color.Black)
            .clip(RoundedCornerShape(34.dp))
            .background(Color(0xF5161618))
            .border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(34.dp))
            .fillMaxWidth()
            .height(NavBarHeight)
            .padding(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Tab.entries.forEach { tab ->
            val active = tab == current
            val tint by animateColorAsState(if (active) Brand.Gold else Brand.Muted, label = "tint")
            val pill by animateColorAsState(if (active) Color(0x2ED4AF37) else Color.Transparent, label = "pill")
            val (filled, outline) = tab.icons()
            Column(
                Modifier
                    .weight(1f)
                    .fillMaxHeight()
                    .clip(RoundedCornerShape(28.dp))
                    .background(pill)
                    .semantics { selected = active; contentDescription = if (tab == Tab.Live && isLive) "Live, on air now" else tab.label }
                    .clickable(remember { MutableInteractionSource() }, null, role = Role.Tab) {
                        if (!active) haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                        onSelect(tab)
                    },
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                Box {
                    Icon(if (active) filled else outline, null, tint = tint, modifier = Modifier.size(24.dp))
                    if (tab == Tab.Live && isLive) {
                        Box(Modifier.align(Alignment.TopEnd).size(8.dp).background(Brand.Red, CircleShape).border(1.5.dp, Color(0xFF161618), CircleShape))
                    }
                }
                Spacer(Modifier.height(3.dp))
                Text(tab.label, color = tint, fontFamily = Inter, fontWeight = if (active) FontWeight.SemiBold else FontWeight.Medium, fontSize = 11.sp, maxLines = 1)
            }
        }
    }
}

// Opens the side menu from any tab screen without threading a callback
// through every composable.
val LocalOpenMenu = staticCompositionLocalOf<() -> Unit> { {} }

// Tab screens: hamburger + dove on the left (Phaneroo). Pushed screens: a
// back arrow and an optional centred title.
@Composable
fun TopBar(title: String? = null, onBack: (() -> Unit)? = null, trailing: @Composable () -> Unit = {}) {
    if (onBack == null && title == null) {
        val openMenu = LocalOpenMenu.current
        Row(
            Modifier.fillMaxWidth().statusBarsPadding().height(60.dp).padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.size(48.dp).clip(CircleShape).clickable(onClick = openMenu), contentAlignment = Alignment.Center) {
                Icon(Icons.Rounded.Menu, "Menu", tint = Brand.White, modifier = Modifier.size(28.dp))
            }
            Spacer(Modifier.width(10.dp))
            Image(painterResource(R.drawable.dove_mark), "Shekinah Sons Global", Modifier.size(40.dp))
            Spacer(Modifier.weight(1f))
            trailing()
        }
        return
    }
    Row(
        Modifier.fillMaxWidth().statusBarsPadding().height(56.dp).padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(44.dp), contentAlignment = Alignment.Center) {
            if (onBack != null) {
                Box(
                    Modifier.size(40.dp).clip(CircleShape).background(Color(0x14FFFFFF)).clickable(onClick = onBack),
                    contentAlignment = Alignment.Center,
                ) { Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back", tint = Brand.White) }
            }
        }
        Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
            if (title != null) Text(title, style = Type.CardTitle.copy(fontSize = 17.sp), color = Brand.White, maxLines = 1)
        }
        Row(Modifier.width(88.dp), horizontalArrangement = Arrangement.End) { trailing() }
    }
}

@Composable
fun SectionHeader(title: String, action: String? = "See all", onAction: (() -> Unit)? = null) {
    Row(
        Modifier.fillMaxWidth().padding(start = 20.dp, end = 12.dp, top = 30.dp, bottom = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.width(4.dp).height(18.dp).background(Brand.GoldGradient, RoundedCornerShape(2.dp)))
        Spacer(Modifier.width(10.dp))
        Text(title, style = Type.Title, color = Brand.White, modifier = Modifier.weight(1f))
        if (onAction != null && action != null) {
            Text(
                action, color = Brand.BlueText, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 13.5.sp,
                modifier = Modifier.clip(RoundedCornerShape(8.dp)).clickable(onClick = onAction).padding(horizontal = 8.dp, vertical = 6.dp),
            )
        }
    }
}

@Composable
fun LiveBadge(modifier: Modifier = Modifier) {
    Row(
        modifier.background(Brand.Red, RoundedCornerShape(6.dp)).padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PulsingDot()
        Spacer(Modifier.width(6.dp))
        Text("LIVE", style = Type.Label, color = Color.White)
    }
}
