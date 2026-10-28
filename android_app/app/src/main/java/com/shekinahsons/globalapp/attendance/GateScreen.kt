package com.shekinahsons.globalapp.attendance

import android.Manifest
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.provider.MediaStore
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
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
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.ErrorOutline
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.rounded.PictureAsPdf
import androidx.compose.material.icons.rounded.QrCodeScanner
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.google.zxing.BarcodeFormat
import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.MultiFormatReader
import com.google.zxing.PlanarYUVLuminanceSource
import com.google.zxing.common.HybridBinarizer
import com.shekinahsons.globalapp.BuildConfig
import com.shekinahsons.globalapp.data.Api
import com.shekinahsons.globalapp.data.HomeContent
import com.shekinahsons.globalapp.ui.components.ErrorNote
import com.shekinahsons.globalapp.ui.components.Field
import com.shekinahsons.globalapp.ui.components.GoldButton
import com.shekinahsons.globalapp.ui.components.TopBar
import com.shekinahsons.globalapp.ui.components.glass
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Type
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import okhttp3.Request
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter
import java.util.concurrent.Executors

@Serializable
data class AttendanceRecord(val id: String = "", val name: String = "", val email: String = "", val occasion: String = "", val date: String = "", val method: String = "", val by: String = "", val createdAt: String = "")

@Serializable
data class Count(val name: String = "", val count: Int = 0)

private data class Result(val ok: Boolean, val title: String, val detail: String, val warn: Boolean = false)

// Gate check-in: scan members' QR codes (or event tickets) to record who
// came, and see / download the attendance. For admins and those allowed.
@Composable
fun GateScreen(content: HomeContent?, onBack: (() -> Unit)?) {
    var tab by remember { mutableStateOf("scan") }
    Column(Modifier.fillMaxSize().background(Brand.Black)) {
        if (onBack != null) TopBar(title = "Gate check-in", onBack = onBack)
        Row(Modifier.padding(horizontal = 16.dp, vertical = 6.dp).fillMaxWidth().glass(RoundedCornerShape(50), 0.85f).padding(4.dp)) {
            listOf("scan" to "Scan", "records" to "Attendance").forEach { (k, label) ->
                val on = tab == k
                Box(Modifier.weight(1f).height(42.dp).clip(RoundedCornerShape(50)).background(if (on) Brand.GoldGradient else Brush.linearGradient(listOf(Color.Transparent, Color.Transparent))).clickable { tab = k }, contentAlignment = Alignment.Center) {
                    Text(label, color = if (on) Brand.Black else Brand.Text2, fontWeight = FontWeight.SemiBold)
                }
            }
        }
        if (tab == "scan") Scanner(content) else Records()
    }
}

@Composable
private fun Scanner(content: HomeContent?) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var granted by remember { mutableStateOf(ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) }
    val ask = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted = it }
    LaunchedEffect(Unit) { if (!granted) ask.launch(Manifest.permission.CAMERA) }
    val today = LocalDate.now().toString()
    val todaysEvents = content?.events.orEmpty().filter { it.eventDate == today }.map { it.title }
    val occasions = (listOf("Sunday Service", "Midweek Service", "Prayer Meeting") + todaysEvents).distinct()
    var occasion by remember { mutableStateOf(occasions.first()) }
    var custom by remember { mutableStateOf("") }
    var result by remember { mutableStateOf<Result?>(null) }
    var count by remember { mutableIntStateOf(0) }
    var manual by remember { mutableStateOf("") }
    var last by remember { mutableStateOf("" to 0L) }
    val current = custom.trim().ifBlank { occasion }

    fun submit(code: String) {
        val now = System.currentTimeMillis()
        // The camera sees the same code many times a second; handle it once.
        if (last.first == code && now - last.second < 4000) return
        last = code to now
        scope.launch {
            runCatching { Api.post("/attendance/scan", mapOf("code" to code, "occasion" to current)) }
                .onSuccess { res ->
                    val name = Api.decode<String>(res["name"])
                    val already = Api.decode<Boolean>(res["already"])
                    count = Api.decode(res["count"])
                    val occ = Api.decode<String>(res["occasion"])
                    result = if (already) Result(true, name, "Already checked in for $occ", warn = true) else Result(true, "Welcome, ${name.substringBefore(' ')}!", "$name · checked in for $occ")
                    buzz(context, short = true)
                }
                .onFailure { result = Result(false, "Not checked in", it.message ?: "Try again"); buzz(context, short = false) }
        }
    }
    LaunchedEffect(result) { if (result != null) { delay(3000); result = null } }

    LazyColumn(Modifier.fillMaxSize().imePadding(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Text("CHECKING IN FOR", style = Type.Label, color = Brand.Gold)
            Spacer(Modifier.height(8.dp))
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(occasions) { o ->
                    val on = custom.isBlank() && occasion == o
                    Text(o, color = if (on) Brand.Black else Color.White, fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                        modifier = (if (on) Modifier.clip(RoundedCornerShape(50)).background(Brand.GoldGradient) else Modifier.glass()).clickable { occasion = o; custom = "" }.padding(horizontal = 14.dp, vertical = 8.dp))
                }
            }
            Spacer(Modifier.height(8.dp))
            Field("OR TYPE ANOTHER (E.G. YOUTH CAMP)", custom, { custom = it.take(80) })
        }
        item {
            Box(Modifier.fillMaxWidth().aspectRatio(1f).clip(RoundedCornerShape(26.dp)).background(Color(0xFF0B0B0D)).border(1.dp, Color(0x33D4AF37), RoundedCornerShape(26.dp))) {
                if (granted) CameraScanner(Modifier.fillMaxSize()) { submit(it) }
                else Column(Modifier.align(Alignment.Center).padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Rounded.QrCodeScanner, null, tint = Brand.Gold, modifier = Modifier.size(48.dp))
                    Text("The camera is needed to scan codes.", color = Brand.Text2)
                    Spacer(Modifier.height(10.dp))
                    GoldButton("Allow camera") { ask.launch(Manifest.permission.CAMERA) }
                }
                // Viewfinder corners.
                if (granted) Box(Modifier.align(Alignment.Center).size(220.dp).border(3.dp, Brush.linearGradient(listOf(Brand.GoldLight, Color.Transparent, Brand.Gold)), RoundedCornerShape(24.dp)))
                AnimatedVisibility(result != null, enter = fadeIn(), exit = fadeOut(), modifier = Modifier.align(Alignment.BottomCenter)) {
                    val r = result ?: return@AnimatedVisibility
                    val color = when { !r.ok -> Color(0xFFD7263D); r.warn -> Color(0xFFB7791F); else -> Color(0xFF1E7A4E) }
                    Row(Modifier.padding(12.dp).fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(color).padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(when { !r.ok -> Icons.Rounded.ErrorOutline; r.warn -> Icons.Rounded.Info; else -> Icons.Rounded.CheckCircle }, null, tint = Color.White, modifier = Modifier.size(30.dp))
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text(r.title, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                            Text(r.detail, color = Color(0xE6FFFFFF), fontSize = 13.sp)
                        }
                    }
                }
            }
        }
        item {
            Row(Modifier.fillMaxWidth().glass(RoundedCornerShape(18.dp), 0.85f).padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(current, style = Type.CardTitle, color = Color.White)
                    Text("Point the camera at a member's code or event ticket", style = Type.Meta, color = Brand.Text2)
                }
                Text("$count", color = Brand.Gold, fontFamily = Inter, fontWeight = FontWeight.Black, fontSize = 28.sp)
            }
        }
        item {
            Text("NO CAMERA? TYPE THE CODE UNDER THE MEMBER'S QR", style = Type.Label.copy(fontSize = 10.5.sp), color = Brand.Muted, modifier = Modifier.padding(top = 4.dp, bottom = 6.dp))
            Row(verticalAlignment = Alignment.Bottom) {
                Field("CODE", manual, { manual = it.uppercase().filter(Char::isLetterOrDigit).take(10) }, Modifier.weight(1f))
                Spacer(Modifier.width(8.dp))
                Text("Check in", color = Brand.Black, fontWeight = FontWeight.Bold, modifier = Modifier.clip(RoundedCornerShape(50)).background(Brand.Gold).clickable(enabled = manual.length == 10) { submit(manual); manual = "" }.padding(horizontal = 18.dp, vertical = 15.dp))
            }
        }
    }
}

private fun buzz(context: Context, short: Boolean) {
    val v = context.getSystemService(Vibrator::class.java) ?: return
    if (Build.VERSION.SDK_INT >= 26) runCatching { v.vibrate(if (short) VibrationEffect.createOneShot(60, 200) else VibrationEffect.createWaveform(longArrayOf(0, 120, 80, 120), -1)) }
}

// The camera, decoding QR codes from its frames with ZXing.
@Composable
private fun CameraScanner(modifier: Modifier, onCode: (String) -> Unit) {
    val context = LocalContext.current
    val owner = LocalLifecycleOwner.current
    val callback by rememberUpdatedState(onCode)
    val executor = remember { Executors.newSingleThreadExecutor() }
    val reader = remember { MultiFormatReader().apply { setHints(mapOf(DecodeHintType.POSSIBLE_FORMATS to listOf(BarcodeFormat.QR_CODE), DecodeHintType.TRY_HARDER to true)) } }
    DisposableEffect(Unit) { onDispose { executor.shutdown() } }
    AndroidView(factory = { ctx ->
        val view = PreviewView(ctx)
        val providerFuture = ProcessCameraProvider.getInstance(ctx)
        providerFuture.addListener({
            val provider = providerFuture.get()
            val preview = Preview.Builder().build().also { it.surfaceProvider = view.surfaceProvider }
            val analysis = ImageAnalysis.Builder().setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST).build()
            analysis.setAnalyzer(executor) { image ->
                runCatching {
                    val plane = image.planes[0]
                    val bytes = ByteArray(plane.buffer.remaining()).also { plane.buffer.get(it) }
                    val source = PlanarYUVLuminanceSource(bytes, plane.rowStride, image.height, 0, 0, image.width, image.height, false)
                    val text = reader.decodeWithState(BinaryBitmap(HybridBinarizer(source))).text
                    ContextCompat.getMainExecutor(context).execute { callback(text) }
                }
                reader.reset()
                image.close()
            }
            runCatching {
                provider.unbindAll()
                provider.bindToLifecycle(owner, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis)
            }
        }, ContextCompat.getMainExecutor(ctx))
        view
    }, modifier = modifier)
}

@Composable
private fun Records() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var date by remember { mutableStateOf(LocalDate.now()) }
    var occasion by remember { mutableStateOf("") }
    val records = remember { mutableStateListOf<AttendanceRecord>() }
    val occasions = remember { mutableStateListOf<Count>() }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf(false) }
    var saved by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(date, occasion) {
        loading = true
        runCatching { Api.get("/attendance?date=$date&occasion=${java.net.URLEncoder.encode(occasion, "UTF-8")}") }.onSuccess { res ->
            records.clear(); records.addAll(Api.decode<List<AttendanceRecord>>(res["records"]))
            occasions.clear(); occasions.addAll(Api.decode<List<Count>>(res["occasions"]))
            error = null
        }.onFailure { error = it.message }
        loading = false
    }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Row(Modifier.fillMaxWidth().glass(RoundedCornerShape(18.dp), 0.85f).padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.AutoMirrored.Rounded.KeyboardArrowLeft, "Previous day", tint = Color.White, modifier = Modifier.size(44.dp).clip(CircleShape).clickable { date = date.minusDays(1); occasion = "" }.padding(8.dp))
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(date.format(DateTimeFormatter.ofPattern("EEEE")), style = Type.Meta, color = Brand.GoldLight)
                    Text(date.format(DateTimeFormatter.ofPattern("d MMMM yyyy")), style = Type.CardTitle, color = Color.White)
                }
                Icon(Icons.AutoMirrored.Rounded.KeyboardArrowRight, "Next day", tint = if (date < LocalDate.now()) Color.White else Brand.Muted,
                    modifier = Modifier.size(44.dp).clip(CircleShape).clickable(enabled = date < LocalDate.now()) { date = date.plusDays(1); occasion = "" }.padding(8.dp))
            }
        }
        if (occasions.isNotEmpty()) item {
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                item { Chip("All · ${occasions.sumOf { it.count }}", occasion == "") { occasion = "" } }
                items(occasions) { o -> Chip("${o.name} · ${o.count}", occasion == o.name) { occasion = o.name } }
            }
        }
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("${records.size} present", style = Type.Title, color = Color.White, modifier = Modifier.weight(1f))
                Row(Modifier.clip(RoundedCornerShape(50)).background(Brand.GoldGradient).clickable(enabled = !saving) {
                    scope.launch {
                        saving = true
                        runCatching { savePdf(context, date.toString(), occasion) }.onSuccess { saved = it }.onFailure { error = it.message }
                        saving = false
                    }
                }.padding(horizontal = 14.dp, vertical = 9.dp), verticalAlignment = Alignment.CenterVertically) {
                    if (saving) CircularProgressIndicator(color = Brand.Black, strokeWidth = 2.dp, modifier = Modifier.size(16.dp))
                    else Icon(Icons.Rounded.PictureAsPdf, null, tint = Brand.Black, modifier = Modifier.size(18.dp))
                    Text(" Download PDF", color = Brand.Black, fontWeight = FontWeight.Bold, fontSize = 13.5.sp)
                }
            }
            saved?.let { Text("Saved to Downloads as $it", color = Color(0xFF4ADE80), fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp)) }
            ErrorNote(error)
        }
        if (loading) item { Box(Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Brand.Gold) } }
        else if (records.isEmpty()) item { Text("No one was checked in on this day.", style = Type.Body, color = Brand.Muted, modifier = Modifier.padding(vertical = 20.dp)) }
        else {
            // Table header
            item {
                Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(Color(0x22D4AF37)).padding(horizontal = 12.dp, vertical = 8.dp)) {
                    Text("#", color = Brand.GoldLight, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(26.dp))
                    Text("MEMBER", color = Brand.GoldLight, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                    Text("TIME", color = Brand.GoldLight, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(70.dp))
                }
            }
            items(records.size) { i ->
                val r = records[i]
                Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(if (i % 2 == 0) Color(0x0FFFFFFF) else Color.Transparent).padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("${i + 1}", color = Brand.Text2, fontSize = 13.sp, modifier = Modifier.width(26.dp))
                    Column(Modifier.weight(1f)) {
                        Text(r.name, color = Color.White, fontSize = 14.5.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(r.email + (if (occasion.isEmpty()) " · ${r.occasion}" else "") + if (r.method == "ticket") " · ticket" else "",
                            color = Brand.Text2, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    Text(runCatching { OffsetDateTime.parse(r.createdAt).atZoneSameInstant(java.time.ZoneId.systemDefault()).format(DateTimeFormatter.ofPattern("h:mm a")) }.getOrDefault(""),
                        color = Brand.Text2, fontSize = 12.5.sp, modifier = Modifier.width(70.dp))
                }
            }
        }
    }
}

@Composable
private fun Chip(label: String, on: Boolean, onClick: () -> Unit) {
    Text(label, color = if (on) Brand.Black else Color.White, fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
        modifier = (if (on) Modifier.clip(RoundedCornerShape(50)).background(Brand.GoldGradient) else Modifier.glass()).clickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 8.dp))
}

// Downloads the PDF from the server into the phone's Downloads folder and opens it.
private suspend fun savePdf(context: Context, date: String, occasion: String): String = withContext(Dispatchers.IO) {
    val url = "${BuildConfig.API_BASE}/api/v1/attendance/report.pdf?date=$date&occasion=${java.net.URLEncoder.encode(occasion, "UTF-8")}"
    val req = Request.Builder().url(url).apply { Api.token?.let { header("Authorization", "Bearer $it") } }.build()
    val bytes = Api.http.newCall(req).execute().use { r -> if (!r.isSuccessful) error("Couldn't get the PDF (${r.code})"); r.body!!.bytes() }
    val name = "Attendance $date" + (if (occasion.isNotBlank()) " $occasion" else "") + ".pdf"
    val values = ContentValues().apply {
        put(MediaStore.Downloads.DISPLAY_NAME, name)
        put(MediaStore.Downloads.MIME_TYPE, "application/pdf")
    }
    val resolver = context.contentResolver
    val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: error("Couldn't save the file")
    resolver.openOutputStream(uri)!!.use { it.write(bytes) }
    withContext(Dispatchers.Main) {
        runCatching { context.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/pdf").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)) }
    }
    name
}
