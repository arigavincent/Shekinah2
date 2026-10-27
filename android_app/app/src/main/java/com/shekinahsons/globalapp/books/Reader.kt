package com.shekinahsons.globalapp.books

import android.app.Activity
import android.content.Context
import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import android.view.WindowManager
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.rememberTransformableState
import androidx.compose.foundation.gestures.transformable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.Undo
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.material.icons.rounded.Bookmark
import androidx.compose.material.icons.rounded.Brush
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Contrast
import androidx.compose.material.icons.rounded.EditNote
import androidx.compose.material.icons.rounded.FormatListBulleted
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.data.VaultFiles
import com.shekinahsons.globalapp.data.decryptToTemp
import com.shekinahsons.globalapp.ui.components.ErrorNote
import com.shekinahsons.globalapp.ui.components.Field
import com.shekinahsons.globalapp.ui.components.glass
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Type
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File

@Serializable
data class InkStroke(val color: String, val points: List<Float>)

@Serializable
data class Marks(
    val bookmarks: List<Int> = emptyList(),
    val notes: Map<Int, String> = emptyMap(),
    // Highlighter strokes per page, in page-relative coordinates (0..1).
    val strokes: Map<Int, List<InkStroke>> = emptyMap(),
    val theme: String = "paper",
)

private val markJson = Json { ignoreUnknownKeys = true }
private fun loadMarks(context: Context, id: String) =
    runCatching { markJson.decodeFromString<Marks>(context.getSharedPreferences("book-marks", Context.MODE_PRIVATE).getString(id, "") ?: "") }.getOrDefault(Marks())
private fun saveMarks(context: Context, id: String, marks: Marks) =
    context.getSharedPreferences("book-marks", Context.MODE_PRIVATE).edit().putString(id, markJson.encodeToString(Marks.serializer(), marks)).apply()

private val pens = listOf("gold" to Color(0xFFE9C23C), "blue" to Color(0xFF4A8BFF), "green" to Color(0xFF4ADE80), "pink" to Color(0xFFF07EB5))
private fun pen(name: String) = pens.firstOrNull { it.first == name }?.second ?: pens.first().second

// Renders one PDF page at a time (PdfRenderer allows only one open page).
private class Pages(file: File) {
    private val fd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
    private val renderer = PdfRenderer(fd)
    private val lock = Mutex()
    val count = renderer.pageCount
    val ratios: List<Float> = (0 until count).map { i -> renderer.openPage(i).use { it.height.toFloat() / it.width } }

    suspend fun render(index: Int, width: Int): Bitmap = lock.withLock {
        withContext(Dispatchers.IO) {
            renderer.openPage(index).use { page ->
                val w = width.coerceIn(400, 2400)
                val h = (w * page.height.toFloat() / page.width).toInt()
                Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888).also { bmp ->
                    bmp.eraseColor(android.graphics.Color.WHITE)
                    page.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                }
            }
        }
    }

    fun close() { runCatching { renderer.close(); fd.close() } }
}

// Reading a book inside the app: sharp pages, zoom, a highlighter pen,
// notes and bookmarks, page themes, and no screenshots.
@Composable
fun Reader(book: Book, onBack: () -> Unit) {
    val context = LocalContext.current
    val activity = context as Activity
    val scope = rememberCoroutineScope()
    var pages by remember { mutableStateOf<Pages?>(null) }
    var temp by remember { mutableStateOf<File?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var marks by remember { mutableStateOf(loadMarks(context, book.id)) }
    fun update(change: (Marks) -> Marks) { marks = change(marks); saveMarks(context, book.id, marks) }

    // Fetch into the vault once, then open a private plain copy while reading.
    LaunchedEffect(book.id) {
        // Never open a paid book the reader hasn't got.
        if (!book.readable) { error = "Get this book to read it."; return@LaunchedEffect }
        runCatching {
            if (!Books.has(context, book)) Books.fetch(context, book)
            val f = withContext(Dispatchers.IO) { VaultFiles.decryptToTemp(context, Books.vaultId(book)) }
            temp = f
            pages = withContext(Dispatchers.IO) { Pages(f) }
        }.onFailure { error = it.message ?: "Couldn't open this book." }
    }
    DisposableEffect(Unit) {
        activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        onDispose {
            activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
            pages?.close()
            temp?.delete()
        }
    }

    val p = pages
    Box(Modifier.fillMaxSize().background(if (marks.theme == "night") Color(0xFF0B0B0D) else Color(0xFF1B1A18))) {
        if (p == null) {
            Column(Modifier.align(Alignment.Center).padding(30.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                if (error != null) ErrorNote(error) else {
                    CircularProgressIndicator(color = Brand.Gold, strokeWidth = 2.dp)
                    Spacer(Modifier.height(12.dp))
                    val dl = Books.downloading[book.id]
                    Text(if (dl != null) "Getting your book ${(dl * 100).toInt()}%" else "Opening…", color = Brand.Text2)
                }
            }
        } else ReaderPages(book, p, marks, ::update, onBack)
    }
}

@Composable
private fun ReaderPages(book: Book, pages: Pages, marks: Marks, update: ((Marks) -> Marks) -> Unit, onBack: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val list = rememberLazyListState(initialFirstVisibleItemIndex = Books.lastPage(context, book.id).coerceIn(0, pages.count - 1))
    val current by remember { derivedStateOf { list.firstVisibleItemIndex } }
    LaunchedEffect(current) { Books.saveLastPage(context, book.id, current, pages.count) }
    var chrome by remember { mutableStateOf(true) }
    var drawing by remember { mutableStateOf<String?>(null) }
    var noteFor by remember { mutableStateOf<Int?>(null) }
    var showMarks by remember { mutableStateOf(false) }
    var scale by remember { mutableFloatStateOf(1f) }
    var offset by remember { mutableStateOf(Offset.Zero) }
    val zoom = rememberTransformableState { change, pan, _ ->
        scale = (scale * change).coerceIn(1f, 4f)
        offset = if (scale <= 1f) Offset.Zero else offset + pan
    }
    val filter = when (marks.theme) {
        "sepia" -> ColorFilter.colorMatrix(ColorMatrix(floatArrayOf(0.95f, 0f, 0f, 0f, 8f, 0f, 0.88f, 0f, 0f, 4f, 0f, 0f, 0.72f, 0f, -6f, 0f, 0f, 0f, 1f, 0f)))
        "night" -> ColorFilter.colorMatrix(ColorMatrix(floatArrayOf(-0.86f, 0f, 0f, 0f, 235f, 0f, -0.86f, 0f, 0f, 232f, 0f, 0f, -0.86f, 0f, 220f, 0f, 0f, 0f, 1f, 0f)))
        else -> null
    }

    Box(Modifier.fillMaxSize()) {
        BoxWithConstraints(
            Modifier.fillMaxSize()
                .then(if (drawing == null) Modifier.transformable(zoom) else Modifier)
                .pointerInput(drawing) {
                    if (drawing == null) detectTapGestures(
                        onTap = { chrome = !chrome },
                        onDoubleTap = { if (scale > 1f) { scale = 1f; offset = Offset.Zero } else scale = 2f },
                    )
                },
        ) {
            val widthPx = constraints.maxWidth
            LazyColumn(
                state = list, userScrollEnabled = drawing == null,
                contentPadding = PaddingValues(top = 90.dp, bottom = 140.dp, start = 10.dp, end = 10.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.fillMaxSize().graphicsLayer { scaleX = scale; scaleY = scale; translationX = offset.x; translationY = offset.y },
            ) {
                items((0 until pages.count).toList(), key = { it }) { index ->
                    Page(pages, index, widthPx, filter, marks, drawing, update, noteTap = { noteFor = index })
                }
            }
        }

        // Top bar
        AnimatedVisibility(chrome || drawing != null, enter = fadeIn(), exit = fadeOut(), modifier = Modifier.align(Alignment.TopCenter)) {
            Row(Modifier.fillMaxWidth().background(Color(0xE6101012)).statusBarsPadding().padding(horizontal = 6.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back", tint = Color.White, modifier = Modifier.size(44.dp).clip(CircleShape).clickable(onClick = onBack).padding(10.dp))
                Column(Modifier.weight(1f)) {
                    Text(book.title, color = Color.White, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, maxLines = 1)
                    Text("Page ${current + 1} of ${pages.count}", style = Type.Meta, color = Brand.GoldLight)
                }
                val marked = current in marks.bookmarks
                Icon(if (marked) Icons.Rounded.Bookmark else Icons.Outlined.BookmarkBorder, "Bookmark page", tint = if (marked) Brand.Gold else Color.White,
                    modifier = Modifier.size(42.dp).clip(CircleShape).clickable { update { m -> m.copy(bookmarks = if (marked) m.bookmarks - current else (m.bookmarks + current).sorted()) } }.padding(9.dp))
                Icon(Icons.Rounded.EditNote, "Note on this page", tint = if (marks.notes[current] != null) Brand.BlueText else Color.White, modifier = Modifier.size(42.dp).clip(CircleShape).clickable { noteFor = current }.padding(9.dp))
                Icon(Icons.Rounded.Brush, "Highlighter", tint = if (drawing != null) Brand.Gold else Color.White, modifier = Modifier.size(42.dp).clip(CircleShape).clickable { drawing = if (drawing == null) "gold" else null; scale = 1f; offset = Offset.Zero }.padding(9.dp))
                Icon(Icons.Rounded.Contrast, "Page colour", tint = Color.White, modifier = Modifier.size(42.dp).clip(CircleShape).clickable {
                    update { m -> m.copy(theme = when (m.theme) { "paper" -> "sepia"; "sepia" -> "night"; else -> "paper" }) }
                }.padding(9.dp))
                Icon(Icons.Rounded.FormatListBulleted, "Bookmarks and notes", tint = Color.White, modifier = Modifier.size(42.dp).clip(CircleShape).clickable { showMarks = true }.padding(9.dp))
            }
        }

        // Highlighter tray or page slider
        Box(Modifier.align(Alignment.BottomCenter).fillMaxWidth()) {
            if (drawing != null) {
                Row(
                    Modifier.navigationBarsPadding().padding(16.dp).fillMaxWidth().clip(RoundedCornerShape(26.dp)).background(Color(0xF01A1A1D)).padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Draw over the text", color = Brand.Text2, fontSize = 12.5.sp, modifier = Modifier.weight(1f))
                    pens.forEach { (name, color) ->
                        Box(Modifier.padding(horizontal = 4.dp).size(30.dp).clip(CircleShape).background(color).border(2.dp, if (drawing == name) Color.White else Color.Transparent, CircleShape).clickable { drawing = name })
                    }
                    Icon(Icons.AutoMirrored.Rounded.Undo, "Undo", tint = Color.White, modifier = Modifier.padding(start = 6.dp).size(36.dp).clip(CircleShape).clickable {
                        update { m -> val list2 = m.strokes[current].orEmpty(); if (list2.isEmpty()) m else m.copy(strokes = m.strokes + (current to list2.dropLast(1))) }
                    }.padding(6.dp))
                    Icon(Icons.Rounded.Check, "Done", tint = Brand.Black, modifier = Modifier.padding(start = 4.dp).size(38.dp).clip(CircleShape).background(Brand.Gold).clickable { drawing = null }.padding(7.dp))
                }
            } else AnimatedVisibility(chrome, enter = fadeIn(), exit = fadeOut()) {
                Column(Modifier.fillMaxWidth().background(Color(0xE6101012)).navigationBarsPadding().padding(horizontal = 18.dp, vertical = 8.dp)) {
                    var target by remember(current) { mutableFloatStateOf(current.toFloat()) }
                    Slider(
                        value = target, onValueChange = { target = it }, valueRange = 0f..(pages.count - 1).coerceAtLeast(1).toFloat(),
                        onValueChangeFinished = { scope.launch { list.scrollToItem(target.toInt()) } },
                        colors = SliderDefaults.colors(thumbColor = Brand.Gold, activeTrackColor = Brand.Gold, inactiveTrackColor = Color(0x33FFFFFF)),
                    )
                    Text("Page ${target.toInt() + 1} · ${((current + 1f) / pages.count * 100).toInt()}% read", style = Type.Meta, color = Brand.Text2, modifier = Modifier.align(Alignment.CenterHorizontally))
                }
            }
        }
    }

    noteFor?.let { page ->
        var text by remember(page) { mutableStateOf(marks.notes[page].orEmpty()) }
        AlertDialog(
            onDismissRequest = { noteFor = null }, containerColor = Color(0xFF1C1C20),
            title = { Text("Note · page ${page + 1}", color = Brand.White) },
            text = { Field("YOUR NOTE", text, { text = it }, minHeight = 120.dp, singleLine = false) },
            confirmButton = { TextButton({ update { m -> m.copy(notes = if (text.isBlank()) m.notes - page else m.notes + (page to text.trim())) }; noteFor = null }) { Text("Save", color = Brand.Gold) } },
            dismissButton = { TextButton({ noteFor = null }) { Text("Cancel", color = Brand.Text2) } },
        )
    }
    if (showMarks) {
        ModalBottomSheet(onDismissRequest = { showMarks = false }, containerColor = Color(0xFF16161A)) {
            Column(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 20.dp).padding(bottom = 24.dp)) {
                Text("Bookmarks & notes", style = Type.Title, color = Brand.White)
                Spacer(Modifier.height(10.dp))
                val pagesWithMarks = (marks.bookmarks + marks.notes.keys + marks.strokes.filterValues { it.isNotEmpty() }.keys).distinct().sorted()
                if (pagesWithMarks.isEmpty()) Text("Bookmark a page, add a note or highlight text and it shows up here.", style = Type.Body, color = Brand.Text2)
                pagesWithMarks.forEach { page ->
                    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).clickable { showMarks = false; scope.launch { list.scrollToItem(page) } }.padding(vertical = 10.dp), verticalAlignment = Alignment.Top) {
                        Text("p.${page + 1}", color = Brand.Gold, fontWeight = FontWeight.Bold, modifier = Modifier.width(52.dp))
                        Column(Modifier.weight(1f)) {
                            if (page in marks.bookmarks) Text("Bookmarked", color = Brand.White, fontSize = 14.sp)
                            marks.notes[page]?.let { Text(it, color = Brand.BlueText, fontSize = 14.sp) }
                            val n = marks.strokes[page]?.size ?: 0
                            if (n > 0) Text("$n highlight${if (n > 1) "s" else ""}", color = Brand.Text2, fontSize = 13.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Page(
    pages: Pages, index: Int, widthPx: Int, filter: ColorFilter?, marks: Marks, drawing: String?,
    update: ((Marks) -> Marks) -> Unit, noteTap: () -> Unit,
) {
    val bitmap by produceState<Bitmap?>(null, index, widthPx) { value = runCatching { pages.render(index, (widthPx * 1.5f).toInt()) }.getOrNull() }
    val live = remember { mutableStateListOf<Float>() }
    Box(Modifier.fillMaxWidth().aspectRatio(1f / pages.ratios[index]).clip(RoundedCornerShape(4.dp)).background(Color.White)) {
        bitmap?.let { Image(it.asImageBitmap(), "Page ${index + 1}", contentScale = ContentScale.FillWidth, colorFilter = filter, modifier = Modifier.fillMaxSize()) }
            ?: CircularProgressIndicator(color = Brand.Gold, strokeWidth = 2.dp, modifier = Modifier.align(Alignment.Center).size(24.dp))
        // Highlights, drawn like a marker over the page.
        Canvas(
            Modifier.fillMaxSize().then(
                if (drawing != null) Modifier.pointerInput(drawing, index) {
                    detectDragGestures(
                        onDragStart = { o -> live.clear(); live.add(o.x / size.width); live.add(o.y / size.height) },
                        onDrag = { change, _ -> live.add(change.position.x / size.width); live.add(change.position.y / size.height) },
                        onDragEnd = {
                            val stroke = InkStroke(drawing, live.toList())
                            live.clear()
                            if (stroke.points.size >= 4) update { m -> m.copy(strokes = m.strokes + (index to (m.strokes[index].orEmpty() + stroke))) }
                        },
                    )
                } else Modifier,
            ),
        ) {
            val width = size.width * 0.028f
            fun draw(points: List<Float>, color: Color) {
                if (points.size < 4) return
                val path = Path().apply {
                    moveTo(points[0] * size.width, points[1] * size.height)
                    var i = 2
                    while (i + 1 < points.size) { lineTo(points[i] * size.width, points[i + 1] * size.height); i += 2 }
                }
                drawPath(path, color.copy(alpha = 0.36f), style = Stroke(width, cap = StrokeCap.Round, join = StrokeJoin.Round))
            }
            marks.strokes[index].orEmpty().forEach { draw(it.points, pen(it.color)) }
            if (drawing != null) draw(live.toList(), pen(drawing))
        }
        if (marks.notes[index] != null || index in marks.bookmarks) {
            Row(Modifier.align(Alignment.TopEnd).padding(6.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                if (index in marks.bookmarks) Icon(Icons.Rounded.Bookmark, null, tint = Brand.Gold, modifier = Modifier.size(22.dp))
                if (marks.notes[index] != null) Icon(Icons.Rounded.EditNote, "Open note", tint = Brand.Blue, modifier = Modifier.size(24.dp).clickable(onClick = noteTap))
            }
        }
        Text("${index + 1}", color = Color(0x88000000), fontSize = 11.sp, modifier = Modifier.align(Alignment.BottomCenter).padding(4.dp))
    }
}
