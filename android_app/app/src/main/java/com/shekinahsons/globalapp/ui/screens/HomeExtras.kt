package com.shekinahsons.globalapp.ui.screens

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.NotificationsNone
import androidx.compose.material.icons.rounded.Headphones
import androidx.compose.material.icons.rounded.NotificationsActive
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.R
import com.shekinahsons.globalapp.data.Library
import com.shekinahsons.globalapp.data.Sermon
import com.shekinahsons.globalapp.extras.ServiceReminder
import com.shekinahsons.globalapp.ui.components.AudioCover
import com.shekinahsons.globalapp.ui.components.SermonPoster
import com.shekinahsons.globalapp.ui.components.glass
import com.shekinahsons.globalapp.ui.components.lifted
import com.shekinahsons.globalapp.ui.components.pressable
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Type
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

// A greeting by name that changes with the time of day, with a short
// blessing from Scripture that rotates daily.
private val blessings = mapOf(
    "morning" to listOf(
        "His mercies are new every morning" to "Lamentations 3:23",
        "This is the day the Lord has made" to "Psalm 118:24",
        "Joy comes in the morning" to "Psalm 30:5",
        "Let the morning bring word of His unfailing love" to "Psalm 143:8",
        "Seek first the kingdom of God" to "Matthew 6:33",
    ),
    "afternoon" to listOf(
        "Grace and peace to you" to "Romans 1:7",
        "The Lord bless you and keep you" to "Numbers 6:24",
        "Be strong and courageous" to "Joshua 1:9",
        "Cast all your anxiety on Him" to "1 Peter 5:7",
        "Those who hope in the Lord will renew their strength" to "Isaiah 40:31",
    ),
    "evening" to listOf(
        "In peace I will lie down and sleep" to "Psalm 4:8",
        "Peace be with you" to "John 20:19",
        "Come to Me and I will give you rest" to "Matthew 11:28",
        "He who watches over you will not slumber" to "Psalm 121:3",
        "The Lord gives His beloved sleep" to "Psalm 127:2",
    ),
)

@Composable
fun Greeting(name: String, onProfile: () -> Unit) {
    val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
    val (part, hello) = when (hour) { in 4..11 -> "morning" to "Good morning"; in 12..16 -> "afternoon" to "Good afternoon"; else -> "evening" to "Good evening" }
    val day = Calendar.getInstance().get(Calendar.DAY_OF_YEAR)
    val (line, ref) = blessings.getValue(part).let { it[day % it.size] }
    Column(Modifier.padding(start = 18.dp, end = 18.dp, top = 2.dp, bottom = 12.dp)) {
        Text(if (name.isNotBlank()) "$hello, $name" else hello, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 24.sp, letterSpacing = (-0.4).sp, color = Brand.White)
        Text("$line · $ref", style = Type.Meta.copy(fontSize = 13.5.sp), color = Brand.GoldLight, maxLines = 2)
        if (name.isBlank()) {
            Text("Sign in so we can greet you by name", color = Brand.BlueText, fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 13.sp,
                modifier = Modifier.padding(top = 4.dp).clickable(onClick = onProfile))
        }
    }
}

// When nothing is live: a slim frosted strip counting down to the next
// service, with a one-tap reminder 15 minutes before it starts.
@Composable
fun ServiceStrip(nextService: String) {
    val context = LocalContext.current
    val start = remember(nextService) { ServiceReminder.nextStart(nextService) }
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) { while (true) { delay(30_000); now = System.currentTimeMillis() } }
    var reminded by remember(start) { mutableStateOf(start != null && ServiceReminder.isSet(context, start)) }
    val shape = RoundedCornerShape(18.dp)
    Row(
        Modifier.padding(horizontal = 16.dp).padding(top = 22.dp).fillMaxWidth().lifted(shape, 10.dp)
            .clip(shape).background(Brush.horizontalGradient(listOf(Color(0xE6241D0E), Color(0xE6101220))))
            .border(1.dp, Brush.horizontalGradient(listOf(Color(0x55D4AF37), Color(0x224A8BFF))), shape)
            .padding(start = 14.dp, end = 8.dp, top = 10.dp, bottom = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(38.dp).glass(CircleShape), contentAlignment = Alignment.Center) {
            Icon(Icons.Rounded.Schedule, null, tint = Brand.Gold, modifier = Modifier.size(20.dp))
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text("NEXT SERVICE", style = Type.Label.copy(fontSize = 10.sp), color = Brand.Gold)
            Text(nextService.ifBlank { "Sunday Service" }, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = Brand.White, maxLines = 1)
            if (start != null) Text(ServiceReminder.countdown(start, now), style = Type.Meta, color = Brand.Text2)
        }
        if (start != null) {
            Row(
                Modifier.clip(RoundedCornerShape(50))
                    .background(if (reminded) Color(0x33D4AF37) else Brand.Gold)
                    .clickable { reminded = ServiceReminder.toggle(context, start) }
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(if (reminded) Icons.Rounded.NotificationsActive else Icons.Outlined.NotificationsNone, null, tint = if (reminded) Brand.GoldLight else Brand.Black, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(5.dp))
                Text(if (reminded) "Reminder on" else "Remind me", color = if (reminded) Brand.GoldLight else Brand.Black, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 12.5.sp)
            }
        }
    }
}

// "12 min left", "Watched" or "Opened" for a history card.
fun progressLabel(p: Library.Progress) = when {
    p.finished -> "Watched \u2713"
    p.position > 0 && p.duration > 0 -> "${(p.leftMs / 60_000).coerceAtLeast(1)} min left"
    else -> "Opened"
}

// Every sermon opened, most recent first, with how far you got.
@Composable
fun ContinueRail(items: List<Pair<Sermon, Library.Progress>>, open: (Sermon) -> Unit) {
    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        items(items, key = { it.first.id }) { (s, p) ->
            val audio = s.type == "audio"
            val shape = RoundedCornerShape(16.dp)
            Column(Modifier.width(230.dp).padding(top = 12.dp, bottom = 16.dp).pressable { open(s) }) {
                Box(Modifier.fillMaxWidth().aspectRatio(16 / 9f).lifted(shape, 12.dp).clip(shape)) {
                    if (audio) {
                        Row(Modifier.fillMaxSize().background(Brush.horizontalGradient(listOf(Color(0xFF221B0C), Color(0xFF111216))))) {
                            AudioCover(s, Modifier.fillMaxHeight().aspectRatio(1f))
                            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                Icon(Icons.Rounded.Headphones, null, tint = Brand.GoldLight, modifier = Modifier.size(30.dp))
                            }
                        }
                    } else SermonPoster(s, Modifier.fillMaxSize())
                    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0.55f to Color.Transparent, 1f to Color(0xCC000000))))
                    Box(Modifier.align(Alignment.Center).size(42.dp).glass(CircleShape, 1.3f), contentAlignment = Alignment.Center) {
                        Icon(Icons.Rounded.PlayArrow, "Continue", tint = Color.White, modifier = Modifier.size(26.dp))
                    }
                    Text(progressLabel(p), color = Color.White, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 11.sp,
                        modifier = Modifier.align(Alignment.BottomEnd).padding(8.dp).glass().padding(horizontal = 8.dp, vertical = 3.dp))
                    Box(Modifier.align(Alignment.BottomStart).fillMaxWidth().height(3.dp).background(Color(0x40FFFFFF))) {
                        Box(Modifier.fillMaxWidth(p.fraction).fillMaxHeight().background(Brand.GoldGradient))
                    }
                }
                Spacer(Modifier.height(9.dp))
                Text(s.title, fontFamily = Inter, fontSize = 14.5.sp, lineHeight = 19.sp, color = Brand.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(if (audio) "Audio · ${s.speaker}" else s.speaker, style = Type.Meta, color = Brand.Text2, maxLines = 1)
            }
        }
    }
}

// Topic chips under the video rail; each opens Sermons filtered to it.
@Composable
fun CategoryChips(names: List<String>, open: (String) -> Unit) {
    LazyRow(contentPadding = PaddingValues(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(names) { name ->
            Text(
                name, color = Brand.White, fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 13.5.sp,
                modifier = Modifier.glass().clickable { open(name) }.padding(horizontal = 16.dp, vertical = 8.dp),
            )
        }
    }
}

// Pull-to-refresh: a frosted disc drops in with the dove, turning as you
// pull and spinning while new content loads.
@Composable
fun BoxScope.DoveRefreshIndicator(state: PullToRefreshState, refreshing: Boolean) {
    val spin by rememberInfiniteTransition(label = "spin").animateFloat(0f, 360f, infiniteRepeatable(tween(900, easing = LinearEasing)), label = "deg")
    val pull = if (refreshing) 1f else state.distanceFraction.coerceIn(0f, 1.4f)
    if (pull <= 0f) return
    Box(
        Modifier.align(Alignment.TopCenter).statusBarsPadding()
            .graphicsLayer { translationY = (pull * 70.dp.toPx()) - 20.dp.toPx(); alpha = pull.coerceAtMost(1f); scaleX = 0.6f + 0.4f * pull.coerceAtMost(1f); scaleY = scaleX }
            .size(52.dp).lifted(CircleShape, 16.dp).clip(CircleShape).background(Color(0xF21A1712)).border(1.dp, Color(0x55D4AF37), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Image(
            painterResource(R.drawable.dove_mark), "Refreshing",
            Modifier.size(32.dp).graphicsLayer { rotationZ = if (refreshing) spin else pull * 300f },
        )
    }
}
