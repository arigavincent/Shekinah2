package com.shekinahsons.globalapp.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ListAlt
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material.icons.outlined.AdminPanelSettings
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.QrCodeScanner
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Campaign
import androidx.compose.material.icons.outlined.Chat
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.LocalLibrary
import androidx.compose.material.icons.outlined.LocalFireDepartment
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Public
import androidx.compose.material.icons.outlined.QrCode2
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.VolunteerActivism
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.R
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Cinzel
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Type

data class MenuItem(val label: String, val page: String, val icon: ImageVector)

// Same grouping as the old app's menu. Bible lives in the bottom tabs.
val MenuGroups: List<Pair<String, List<MenuItem>>> = listOf(
    "QUICK ACCESS" to listOf(
        MenuItem("Profile", "Profile", Icons.Outlined.Person),
        MenuItem("Giving", "Giving", Icons.Outlined.FavoriteBorder),
        MenuItem("Updates", "Updates", Icons.Outlined.Campaign),
        MenuItem("Notifications", "Notifications", Icons.Outlined.Notifications),
    ),
    "MEDIA" to listOf(
        MenuItem("Downloads", "Downloads", Icons.Outlined.Download),
        MenuItem("Watch history", "History", Icons.Outlined.History),
        MenuItem("Books & Library", "Library", Icons.Outlined.LocalLibrary),
        MenuItem("Our Platforms", "Platforms", Icons.Outlined.Public),
    ),
    "CONNECT" to listOf(
        MenuItem("Prayer Request", "Prayer", Icons.Outlined.VolunteerActivism),
        MenuItem("Events", "Events", Icons.Outlined.CalendarMonth),
        MenuItem("Reading Plans", "ReadingPlans", Icons.AutoMirrored.Outlined.ListAlt),
        MenuItem("Chat", "Chat", Icons.Outlined.Chat),
        MenuItem("Testimonies", "Testimonies", Icons.Outlined.LocalFireDepartment),
        MenuItem("Serve", "Serve", Icons.Outlined.Groups),
        MenuItem("Branches", "Branches", Icons.Outlined.LocationOn),
        MenuItem("QR Check-In", "CheckIn", Icons.Outlined.QrCode2),
    ),
    "APP" to listOf(
        MenuItem("Share App", "Share", Icons.Outlined.Share),
        MenuItem("About & Contact", "About", Icons.Outlined.Info),
    ),
)

// Slide-in side menu. Drawn under the bottom bar, like Phaneroo's, so the
// tabs stay reachable while it is open.
@Composable
fun AppDrawer(open: Boolean, onClose: () -> Unit, onSelect: (MenuItem) -> Unit, version: String, admin: Boolean = false, scanner: Boolean = false) {
    AnimatedVisibility(open, enter = fadeIn(tween(220)), exit = fadeOut(tween(220))) {
        Box(Modifier.fillMaxSize().background(Color(0xB3000000)).clickable(remember { MutableInteractionSource() }, null, onClick = onClose))
    }
    val width = (LocalConfiguration.current.screenWidthDp * 0.78f).coerceAtMost(340f).dp
    AnimatedVisibility(
        open,
        enter = slideInHorizontally(tween(300)) { -it },
        exit = slideOutHorizontally(tween(260)) { -it },
    ) {
        Column(
            Modifier.width(width).fillMaxHeight()
                .background(Brush.verticalGradient(listOf(Color(0xFF17140C), Color(0xFF0A0A0B), Color(0xFF0A0A0B))))
                .clickable(remember { MutableInteractionSource() }, null) {},
        ) {
            Column(
                Modifier.fillMaxWidth().statusBarsPadding().padding(top = 26.dp, bottom = 22.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Image(painterResource(R.drawable.dove_mark), null, Modifier.size(72.dp))
                Spacer(Modifier.height(10.dp))
                Text("SHEKINAH", fontFamily = Cinzel, fontSize = 22.sp, color = Brand.Gold, letterSpacing = 3.sp)
                Text("SONS GLOBAL", fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 11.sp, color = Brand.Text2, letterSpacing = 4.sp)
            }
            HorizontalDivider(color = Brand.Line)
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(bottom = NavBarHeight + 40.dp)) {
                // Admins get a way back to the admin console.
                val staff = listOfNotNull(
                    if (admin) MenuItem("Admin console", "Admin", Icons.Outlined.AdminPanelSettings) else null,
                    if (admin || scanner) MenuItem("Gate check-in", "Gate", Icons.Outlined.QrCodeScanner) else null,
                )
                val groups = if (staff.isNotEmpty()) listOf((if (admin) "ADMIN" else "SERVING") to staff) + MenuGroups else MenuGroups
                groups.forEachIndexed { i, (title, items) ->
                    if (i > 0) HorizontalDivider(color = Brand.Line, modifier = Modifier.padding(top = 6.dp))
                    Text(title, style = Type.Label, color = Brand.Muted, modifier = Modifier.padding(start = 22.dp, top = 18.dp, bottom = 6.dp))
                    items.forEach { item ->
                        Row(
                            Modifier.fillMaxWidth().clickable { onSelect(item) }.padding(horizontal = 22.dp, vertical = 14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(item.icon, null, tint = Brand.GoldLight, modifier = Modifier.size(23.dp))
                            Spacer(Modifier.width(20.dp))
                            Text(item.label, style = Type.Body.copy(fontSize = 16.sp), color = Brand.White, modifier = Modifier.weight(1f))
                            if (item.page != "Share") Icon(Icons.AutoMirrored.Rounded.KeyboardArrowRight, null, tint = Brand.Muted)
                        }
                    }
                }
                Text("Version $version", style = Type.Meta, color = Brand.Muted, textAlign = androidx.compose.ui.text.style.TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = 18.dp))
            }
        }
    }
}
