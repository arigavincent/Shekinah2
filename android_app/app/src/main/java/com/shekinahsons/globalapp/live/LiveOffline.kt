package com.shekinahsons.globalapp.live

import android.content.Intent
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.NotificationsNone
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.R
import com.shekinahsons.globalapp.data.HomeContent
import com.shekinahsons.globalapp.data.Session
import com.shekinahsons.globalapp.extras.ServiceReminder
import com.shekinahsons.globalapp.ui.components.AmbientGlow
import com.shekinahsons.globalapp.ui.components.Breathing
import com.shekinahsons.globalapp.ui.components.ColorGlow
import com.shekinahsons.globalapp.ui.components.FadeImage
import com.shekinahsons.globalapp.ui.components.PulsingDot
import com.shekinahsons.globalapp.ui.components.TopBar
import com.shekinahsons.globalapp.ui.components.lifted
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Poster
import com.shekinahsons.globalapp.ui.theme.Type
import kotlin.math.cos
import kotlin.math.sin

private val nairobi = java.time.ZoneId.of("Africa/Nairobi")
private val weekDays = listOf("MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY")

// The Live tab while nothing is on air: a glowing "sanctuary" stage counting
// down to the next service, the last service to catch up on, the week's
// gatherings, and what members get when the church goes live.
@Composable
internal fun LiveOffline(content: HomeContent, session: Session, openGoLive: () -> Unit, replays: () -> Unit) {
    val context = LocalContext.current
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) { while (true) { kotlinx.coroutines.delay(1000 - System.currentTimeMillis() % 1000); now = System.currentTimeMillis() } }
    val next = remember(content.live.nextService, now / 60_000) { ServiceReminder.next(content.live.nextService) }
    val start = next?.first
    var reminded by remember(start) { mutableStateOf(start != null && ServiceReminder.isSet(context, start)) }
    val last = remember(content.sermons) { content.videoSermons.firstOrNull { it.replayId.isNotBlank() } ?: content.videoSermons.firstOrNull() }

    LazyColumn(Modifier.fillMaxSize().background(Brand.Black), contentPadding = PaddingValues(bottom = 130.dp)) {
        item { Stage(next?.second ?: content.live.nextService.ifBlank { "Sunday Service" }, start, now, last?.thumbnail, reminded,
            onRemind = { if (start != null) reminded = ServiceReminder.toggle(context, start) },
            onShare = {
                val text = "Join Shekinah Sons Global live" + (next?.second?.let { " on $it" } ?: "") + " in the Shekinah app."
                context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), "Invite someone"))
            }) }

        if (session.canBroadcast) item { GoLiveBar(openGoLive) }

        if (last != null) {
            item { SectionTitle("CATCH UP", "The last service", action = "All replays", onAction = replays) }
            item { LastService(last.title, last.speaker, last.date, last.thumbnail, last.duration, replays) }
        }

        item { SectionTitle("EVERY WEEK", "Gather with us") }
        item { WeekStrip(content.live.nextService, next?.second, now) }

        item { SectionTitle("WHEN WE'RE LIVE", "Worship together from anywhere") }
        item {
            Row(Modifier.padding(horizontal = 20.dp).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Perk(Icons.Rounded.NotificationsActive, "Alert", "The moment we start", Modifier.weight(1f))
                Perk(Icons.Rounded.Forum, "Live chat", "Pray and greet", Modifier.weight(1f))
                Perk(Icons.Rounded.History, "Replay", "Watch it later", Modifier.weight(1f))
            }
        }
    }
}

// The stage: the last service's colours glowing behind slowly turning rays of
// light, the dove inside a ring that fills as the service draws near, and a
// flip countdown.
@Composable
private fun Stage(label: String, start: Long?, now: Long, backdrop: String?, reminded: Boolean, onRemind: () -> Unit, onShare: () -> Unit) {
    val spin = rememberInfiniteTransition(label = "rays")
    val angle by spin.animateFloat(0f, 360f, infiniteRepeatable(tween(90_000, easing = LinearEasing)), label = "angle")
    val shimmer by spin.animateFloat(0.55f, 1f, infiniteRepeatable(tween(3200), RepeatMode.Reverse), label = "shimmer")
    val glow = Breathing(3600, 0.5f, 1f)
    // How far through the week we are towards the service (the ring).
    val progress = if (start == null) 0f else (1f - ((start - now).toFloat() / (7 * 86_400_000f))).coerceIn(0.02f, 1f)
    val soon = start != null && start - now < 60 * 60_000

    Box(Modifier.fillMaxWidth().clipToBounds()) {
        // Background: the last service, blurred into colour, then the brand wash.
        AmbientGlow(backdrop, Modifier.matchParentSize(), blur = 80.dp, alpha = 0.55f)
        Box(Modifier.matchParentSize().background(Brush.verticalGradient(listOf(Color(0xCC14100A), Color(0xB30B0D18), Brand.Black))))
        Canvas(Modifier.matchParentSize()) {
            val c = Offset(size.width / 2, size.height * 0.36f)
            val r = size.maxDimension
            rotate(angle, c) {
                for (i in 0 until 18) {
                    val a = Math.toRadians(i * 20.0)
                    val a2 = Math.toRadians(i * 20.0 + 7)
                    val p = androidx.compose.ui.graphics.Path().apply {
                        moveTo(c.x, c.y)
                        lineTo(c.x + (r * cos(a)).toFloat(), c.y + (r * sin(a)).toFloat())
                        lineTo(c.x + (r * cos(a2)).toFloat(), c.y + (r * sin(a2)).toFloat())
                        close()
                    }
                    drawPath(p, Brush.radialGradient(listOf(Color(0xFFD4AF37).copy(alpha = 0.16f * shimmer), Color.Transparent), c, r * 0.55f))
                }
            }
            drawCircle(Brush.radialGradient(listOf(Color(0x55D4AF37), Color.Transparent), c, size.width * 0.42f), size.width * 0.42f, c)
        }
        // Melt the stage into the page so there is no hard edge.
        Box(Modifier.matchParentSize().background(Brush.verticalGradient(0.55f to Color.Transparent, 0.97f to Brand.Black)))

        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            TopBar()
            // Off-air pill
            Row(
                Modifier.clip(RoundedCornerShape(50)).background(Color(0x66000000)).border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(50)).padding(horizontal = 12.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (soon) PulsingDot(Brand.Red, 7.dp) else Box(Modifier.size(7.dp).clip(CircleShape).background(Color(0xFF8A8A93)))
                Spacer(Modifier.width(7.dp))
                Text(if (soon) "STARTING SOON" else "OFF AIR · SHEKINAH LIVE", color = Color.White, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 11.sp, letterSpacing = 1.4.sp)
            }
            Spacer(Modifier.height(26.dp))
            // Dove in its countdown ring
            Box(Modifier.size(172.dp), contentAlignment = Alignment.Center) {
                ColorGlow(Brand.Gold.copy(alpha = 0.45f * glow), Modifier.size(120.dp), blur = 40.dp)
                Canvas(Modifier.fillMaxSize()) {
                    val w = 5.dp.toPx()
                    drawCircle(Color(0x22FFFFFF), size.minDimension / 2 - w, style = Stroke(w))
                    drawArc(
                        Brush.sweepGradient(listOf(Color(0xFFF5DE8A), Color(0xFFD4AF37), Color(0xFF9C7A16), Color(0xFFF5DE8A))),
                        -90f, 360f * progress, false,
                        topLeft = Offset(w, w), size = androidx.compose.ui.geometry.Size(size.width - 2 * w, size.height - 2 * w),
                        style = Stroke(w, cap = StrokeCap.Round),
                    )
                }
                Box(Modifier.size(132.dp).clip(CircleShape).background(Brush.radialGradient(listOf(Color(0xFF2C2410), Color(0xFF0C0C10)))).border(1.dp, Color(0x33D4AF37), CircleShape), contentAlignment = Alignment.Center) {
                    Image(painterResource(R.drawable.dove_mark), null, Modifier.size(78.dp).graphicsLayer { scaleX = 0.96f + 0.06f * glow; scaleY = scaleX })
                }
            }
            Spacer(Modifier.height(22.dp))
            Text("NEXT SERVICE", style = Type.Label, color = Brand.Gold)
            Spacer(Modifier.height(6.dp))
            Text(label.uppercase(), fontFamily = Poster, fontSize = 34.sp, lineHeight = 38.sp, letterSpacing = 0.5.sp, color = Color.White, textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 24.dp))
            Spacer(Modifier.height(18.dp))
            if (start != null) {
                val (d, h, m, s) = ServiceReminder.parts(start, now)
                Row(Modifier.padding(horizontal = 20.dp).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    listOf(d to "DAYS", h to "HOURS", m to "MINS", s to "SECS").forEachIndexed { i, (v, unit) ->
                        FlipTile(v, unit, Modifier.weight(1f), highlight = i == 3)
                    }
                }
            }
            Spacer(Modifier.height(18.dp))
            Row(Modifier.padding(horizontal = 20.dp).fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(
                    Modifier.weight(1f).height(50.dp).clip(RoundedCornerShape(50))
                        .background(if (reminded) Brush.horizontalGradient(listOf(Color(0x33D4AF37), Color(0x33D4AF37))) else Brand.GoldGradient)
                        .border(1.dp, if (reminded) Brand.Gold.copy(alpha = 0.6f) else Color.Transparent, RoundedCornerShape(50))
                        .clickable(enabled = start != null, onClick = onRemind),
                    horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(if (reminded) Icons.Rounded.NotificationsActive else Icons.Outlined.NotificationsNone, null, tint = if (reminded) Brand.GoldLight else Brand.Black, modifier = Modifier.size(19.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(if (reminded) "Reminder on · 15 min before" else "Remind me", color = if (reminded) Brand.GoldLight else Brand.Black, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 14.5.sp)
                }
                Box(
                    Modifier.size(50.dp).clip(CircleShape).background(Color(0x1FFFFFFF)).border(1.dp, Color(0x33FFFFFF), CircleShape).clickable(onClick = onShare),
                    contentAlignment = Alignment.Center,
                ) { Icon(Icons.Rounded.IosShare, "Invite someone", tint = Color.White, modifier = Modifier.size(20.dp)) }
            }
            Spacer(Modifier.height(10.dp))
            Text("We'll notify you the moment the service starts.", style = Type.Meta, color = Color(0xB3FFFFFF))
            Spacer(Modifier.height(26.dp))
        }
    }
}

@Composable
private fun FlipTile(value: Long, unit: String, modifier: Modifier, highlight: Boolean) {
    val shape = RoundedCornerShape(16.dp)
    Column(
        modifier.clip(shape)
            .background(Brush.verticalGradient(listOf(Color(0x2EFFFFFF), Color(0x0FFFFFFF))))
            .border(1.dp, Brush.verticalGradient(listOf(if (highlight) Brand.Gold.copy(alpha = 0.7f) else Color(0x40FFFFFF), Color(0x10FFFFFF))), shape)
            .padding(vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        AnimatedContent(value, transitionSpec = {
            (slideInVertically { -it } + fadeIn()) togetherWith (slideOutVertically { it } + fadeOut())
        }, label = "flip") { v ->
            Text("%02d".format(v), fontFamily = Poster, fontSize = 34.sp, color = if (highlight) Brand.GoldLight else Color.White)
        }
        Text(unit, style = Type.Label.copy(fontSize = 9.5.sp), color = Color(0x99FFFFFF))
    }
}

@Composable
private fun GoLiveBar(openGoLive: () -> Unit) {
    Row(
        Modifier.padding(horizontal = 20.dp, vertical = 6.dp).fillMaxWidth().clip(RoundedCornerShape(20.dp))
            .background(Brush.horizontalGradient(listOf(Color(0xFF3A0D12), Color(0xFF16090B))))
            .border(1.dp, Brand.Red.copy(alpha = 0.45f), RoundedCornerShape(20.dp)).padding(14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text("BROADCAST", style = Type.Label.copy(fontSize = 10.sp), color = Color(0xFFFF8A80))
            Text("You can take the church live", style = Type.CardTitle, color = Color.White)
            Text("Everyone is notified when you start.", style = Type.Meta, color = Brand.Text2)
        }
        Row(
            Modifier.lifted(RoundedCornerShape(50), 14.dp, Brand.Red).clip(RoundedCornerShape(50))
                .background(Brush.horizontalGradient(listOf(Color(0xFFFF5A4E), Color(0xFFD7263D)))).clickable(onClick = openGoLive)
                .padding(horizontal = 18.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PulsingDot(Color.White, 8.dp); Spacer(Modifier.width(8.dp))
            Text("Go Live", color = Color.White, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 15.sp)
        }
    }
}

@Composable
private fun SectionTitle(kicker: String, title: String, action: String? = null, onAction: () -> Unit = {}) {
    Row(Modifier.fillMaxWidth().padding(start = 20.dp, end = 20.dp, top = 28.dp, bottom = 12.dp), verticalAlignment = Alignment.Bottom) {
        Column(Modifier.weight(1f)) {
            Text(kicker, style = Type.Label.copy(fontSize = 10.5.sp), color = Brand.Gold)
            Text(title, style = Type.Title, color = Color.White)
        }
        if (action != null) Text(action, color = Brand.GoldLight, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 13.5.sp,
            modifier = Modifier.clip(RoundedCornerShape(50)).clickable(onClick = onAction).padding(horizontal = 8.dp, vertical = 4.dp))
    }
}

@Composable
private fun LastService(title: String, speaker: String, date: String, thumb: String, duration: String, open: () -> Unit) {
    val shape = RoundedCornerShape(22.dp)
    Box(Modifier.padding(horizontal = 20.dp).fillMaxWidth().aspectRatio(16 / 9f).lifted(shape, 16.dp).clip(shape).clickable(onClick = open)) {
        FadeImage(thumb, Modifier.fillMaxSize(), label = "REPLAY")
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0.35f to Color.Transparent, 1f to Color(0xE6000000))))
        Row(Modifier.align(Alignment.TopStart).padding(12.dp).clip(RoundedCornerShape(50)).background(Color(0x99000000)).padding(horizontal = 10.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Rounded.History, null, tint = Brand.GoldLight, modifier = Modifier.size(14.dp))
            Spacer(Modifier.width(5.dp))
            Text("REPLAY", color = Color.White, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 10.5.sp, letterSpacing = 1.sp)
        }
        if (duration.isNotBlank()) Text(duration, color = Color.White, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 12.sp,
            modifier = Modifier.align(Alignment.TopEnd).padding(12.dp).clip(RoundedCornerShape(8.dp)).background(Color(0x99000000)).padding(horizontal = 8.dp, vertical = 4.dp))
        Box(Modifier.align(Alignment.Center).size(62.dp).clip(CircleShape).background(Color(0x33FFFFFF)).border(1.dp, Color(0x66FFFFFF), CircleShape), contentAlignment = Alignment.Center) {
            Icon(Icons.Rounded.PlayArrow, "Play", tint = Color.White, modifier = Modifier.size(36.dp))
        }
        Column(Modifier.align(Alignment.BottomStart).padding(16.dp)) {
            Text(title, style = Type.CardTitle.copy(fontSize = 16.sp), color = Color.White, maxLines = 2, overflow = TextOverflow.Ellipsis)
            Text(listOf(speaker, date).filter { it.isNotBlank() }.joinToString(" · "), style = Type.Meta, color = Color(0xCCFFFFFF), maxLines = 1)
        }
    }
}

// Mon–Sun, with service days lit and the next one marked, then the times.
@Composable
private fun WeekStrip(nextService: String, nextLabel: String?, now: Long) {
    val services = remember(nextService) {
        nextService.split(";").map { it.trim() }.filter { it.contains(",") }
            .groupBy({ it.substringBefore(",").trim().uppercase() }, { it.substringAfter(",").trim() })
    }
    val today = java.time.Instant.ofEpochMilli(now).atZone(nairobi).dayOfWeek.value - 1
    val nextDay = nextLabel?.substringBefore(",")?.trim()?.uppercase()
    Column(Modifier.padding(horizontal = 20.dp).fillMaxWidth().clip(RoundedCornerShape(22.dp))
        .background(Brush.linearGradient(listOf(Color(0xFF18171C), Color(0xFF0F0F12)))).border(1.dp, Color(0x1FFFFFFF), RoundedCornerShape(22.dp)).padding(14.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            weekDays.forEachIndexed { i, day ->
                val has = services.keys.any { day.startsWith(it.take(3)) }
                val isNext = nextDay != null && day.startsWith(nextDay.take(3))
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        Modifier.size(38.dp).clip(CircleShape)
                            .background(when { isNext -> Brand.GoldGradient; has -> Brush.linearGradient(listOf(Color(0x33D4AF37), Color(0x33D4AF37))); else -> Brush.linearGradient(listOf(Color(0x0FFFFFFF), Color(0x0FFFFFFF))) })
                            .border(if (i == today) 1.5.dp else 0.dp, if (i == today) Color.White else Color.Transparent, CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(day.take(1), color = if (isNext) Brand.Black else if (has) Brand.GoldLight else Color(0x80FFFFFF), fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                    }
                    Spacer(Modifier.height(4.dp))
                    Text(if (i == today) "Today" else day.take(3).lowercase().replaceFirstChar { it.uppercase() }, fontSize = 10.sp, color = if (i == today) Color.White else Color(0x80FFFFFF), fontFamily = Inter)
                }
            }
        }
        if (services.isNotEmpty()) {
            Spacer(Modifier.height(14.dp))
            Box(Modifier.fillMaxWidth().height(1.dp).background(Color(0x14FFFFFF)))
            services.forEach { (day, times) ->
                val isNext = nextDay == day
                Row(Modifier.fillMaxWidth().padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.Church, null, tint = if (isNext) Brand.Gold else Color(0x80FFFFFF), modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(10.dp))
                    Text(day.lowercase().replaceFirstChar { it.uppercase() }, color = Color.White, fontSize = 14.sp, fontFamily = Inter, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
                    if (isNext) Text("NEXT", color = Brand.Black, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 9.5.sp, letterSpacing = 1.sp,
                        modifier = Modifier.padding(end = 8.dp).clip(RoundedCornerShape(50)).background(Brand.Gold).padding(horizontal = 7.dp, vertical = 2.dp))
                    Text(times.joinToString(" & "), color = Brand.GoldLight, fontSize = 14.sp, fontFamily = Inter, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@Composable
private fun Perk(icon: ImageVector, title: String, sub: String, modifier: Modifier) {
    Column(
        modifier.clip(RoundedCornerShape(18.dp)).background(Color(0x0FFFFFFF)).border(1.dp, Color(0x1AFFFFFF), RoundedCornerShape(18.dp)).padding(12.dp),
    ) {
        Box(Modifier.size(34.dp).clip(CircleShape).background(Color(0x26D4AF37)), contentAlignment = Alignment.Center) {
            Icon(icon, null, tint = Brand.Gold, modifier = Modifier.size(18.dp))
        }
        Spacer(Modifier.height(10.dp))
        Text(title, style = Type.CardTitle.copy(fontSize = 14.sp), color = Color.White)
        Text(sub, style = Type.Meta.copy(fontSize = 11.5.sp), color = Brand.Text2, maxLines = 2)
    }
}
