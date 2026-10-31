package com.shekinahsons.globalapp.books

import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.MenuBook
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.CloudUpload
import androidx.compose.material.icons.rounded.HourglassTop
import androidx.compose.material.icons.rounded.Image
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.PictureAsPdf
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Visibility
import androidx.compose.material.icons.rounded.VisibilityOff
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.shekinahsons.globalapp.R
import com.shekinahsons.globalapp.data.Session
import com.shekinahsons.globalapp.ui.components.AmbientGlow
import com.shekinahsons.globalapp.ui.components.CoverFlowRail
import com.shekinahsons.globalapp.ui.components.ErrorNote
import com.shekinahsons.globalapp.ui.components.FadeImage
import com.shekinahsons.globalapp.ui.components.Field
import com.shekinahsons.globalapp.ui.components.GhostButton
import com.shekinahsons.globalapp.ui.components.GoldButton
import com.shekinahsons.globalapp.ui.components.SignInCard
import com.shekinahsons.globalapp.ui.components.TopBar
import com.shekinahsons.globalapp.ui.components.glass
import com.shekinahsons.globalapp.ui.components.lifted
import com.shekinahsons.globalapp.ui.components.outset
import com.shekinahsons.globalapp.ui.components.pressable
import com.shekinahsons.globalapp.ui.screens.GivingPage
import com.shekinahsons.globalapp.ui.screens.Purchase
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Cinzel
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Type
import kotlinx.coroutines.launch
import kotlin.math.absoluteValue

private sealed interface View {
    data object Shelf : View
    data class Detail(val book: Book) : View
    data class Read(val book: Book) : View
    data class Buy(val book: Book) : View
    data object Publish : View
}

private val kindLabels = listOf("all" to "All", "book" to "Books", "journal" to "Journals", "devotional" to "Devotionals", "study" to "Study guides", "magazine" to "Magazines")
private fun kindName(k: String) = kindLabels.firstOrNull { it.first == k }?.second?.removeSuffix("s") ?: "Book"

private fun price(b: Book) = if (b.free) "Free" else "KSh ${"%,d".format(b.price)}"

// Books & Library: the ministry's books, journals and study materials.
@Composable
fun LibraryScreen(session: Session, openProfile: () -> Unit, onBack: () -> Unit, bottomInset: androidx.compose.ui.unit.Dp = 0.dp, onFullScreen: (Boolean)->Unit = {}) {
    val context = LocalContext.current
    var view by remember { mutableStateOf<View>(View.Shelf) }
    val books = remember { mutableStateListOf<Book>() }
    var canPublish by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var reload by remember { mutableIntStateOf(0) }
    LaunchedEffect(view) { onFullScreen(view!=View.Shelf) }
    androidx.compose.runtime.DisposableEffect(Unit) {onDispose {onFullScreen(false)}}
    Books.user = session.member?.id.orEmpty()
    LaunchedEffect(session.member?.id) { view=View.Shelf }
    LaunchedEffect(Unit) { while(true) { kotlinx.coroutines.delay(8_000);if(books.any{it.pending})reload++ } }
    LaunchedEffect(reload, session.member) {
        canPublish=false; books.clear(); books.addAll(Books.cached(context))
        runCatching { Books.list(context) }.onSuccess { (list, publish) -> books.clear(); books.addAll(list); canPublish = publish; error = null }.onFailure { error = it.message }
        loading = false
    }
    LaunchedEffect(books.toList(),com.shekinahsons.globalapp.notify.OpenLink.bookId) { val id=com.shekinahsons.globalapp.notify.OpenLink.bookId;books.firstOrNull{it.id==id}?.let{view=View.Detail(it);com.shekinahsons.globalapp.notify.OpenLink.bookId=null} }
    BackHandler { view = when (val v = view) { View.Shelf -> { onBack(); View.Shelf }; is View.Read -> View.Detail(v.book); is View.Buy -> View.Detail(v.book); else -> View.Shelf } }

    AnimatedContent(view, transitionSpec = { fadeIn() togetherWith fadeOut() }, label = "library", modifier = Modifier.fillMaxSize().background(Brand.Black)) { v ->
        when (v) {
            View.Shelf -> Shelf(books, loading, error, canPublish, onBack, open = { view = View.Detail(it) }, publish = { view = View.Publish }, retry = { loading = true; error = null; reload++ }, bottomInset = bottomInset)
            is View.Detail -> {
                val book = books.firstOrNull { it.id == v.book.id } ?: v.book
                Detail(book, session, onBack = { view = View.Shelf }, read = { view = View.Read(book) }, buy = { if (session.member == null) openProfile() else view = View.Buy(book) },
                    changed = { reload++ }, bottomInset = bottomInset)
            }
            is View.Read -> Reader(v.book) { view = View.Detail(v.book) }
            is View.Buy -> Column(Modifier.fillMaxSize()) {
                TopBar(title = "Get this book", onBack = { view = View.Detail(v.book) })
                GivingPage(session, Purchase(v.book.id, v.book.title, v.book.price)) { reload++; view = View.Shelf }
            }
            View.Publish -> Column(Modifier.fillMaxSize()) {
                TopBar(title="Publish books",onBack={reload++;view=View.Shelf})
                androidx.compose.foundation.lazy.LazyColumn(contentPadding=PaddingValues(18.dp,12.dp,18.dp,100.dp)){item{com.shekinahsons.globalapp.admin.BatchPublishingPane("book")}}
            }
        }
    }
}

// A book cover: the uploaded art, or a designed cover when there is none.
// A light edge on the left reads as the spine.
@Composable
fun BookCover(b: Book, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(topStart = 4.dp, bottomStart = 4.dp, topEnd = 10.dp, bottomEnd = 10.dp)
    Box(modifier.aspectRatio(2 / 3f).lifted(shape, 14.dp).clip(shape)) {
        if (b.coverUrl.isNotBlank()) FadeImage(b.coverUrl, Modifier.fillMaxSize(), label = kindName(b.kind).uppercase())
        else GeneratedCover(b, Modifier.fillMaxSize())
        Box(Modifier.fillMaxHeight().width(10.dp).background(Brush.horizontalGradient(listOf(Color(0x66000000), Color(0x22FFFFFF), Color.Transparent))))
        Box(Modifier.fillMaxSize().background(Brush.linearGradient(listOf(Color(0x14FFFFFF), Color.Transparent, Color(0x22000000)))))
    }
}

private val coverPalettes = listOf(
    listOf(Color(0xFF3A2A06), Color(0xFF0E0C08)), listOf(Color(0xFF0E2A6B), Color(0xFF070B18)),
    listOf(Color(0xFF6E0F24), Color(0xFF1A0508)), listOf(Color(0xFF0F4D3C), Color(0xFF041410)),
)

@Composable
private fun GeneratedCover(b: Book, modifier: Modifier) {
    val palette = coverPalettes[b.id.hashCode().absoluteValue % coverPalettes.size]
    BoxWithConstraints(modifier.background(Brush.verticalGradient(palette))) {
        val w = maxWidth.value
        Image(painterResource(R.drawable.dove_mark), null, Modifier.align(Alignment.Center).size((w * 0.8f).dp).graphicsLayer { alpha = 0.08f })
        Column(Modifier.fillMaxSize().padding((w * 0.1f).dp), verticalArrangement = Arrangement.SpaceBetween) {
            Text(kindName(b.kind).uppercase(), color = Brand.Gold, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = (w * 0.055f).sp, letterSpacing = 1.5.sp)
            Column {
                Box(Modifier.width((w * 0.18f).dp).height(2.dp).background(Brand.GoldGradient))
                Spacer(Modifier.height((w * 0.04f).dp))
                Text(b.title, color = Color.White, fontFamily = Cinzel, fontSize = (w * 0.105f).sp, lineHeight = (w * 0.125f).sp, maxLines = 4, overflow = TextOverflow.Ellipsis)
            }
            Text(b.author.ifBlank { "Shekinah Sons Global" }.uppercase(), color = Brand.GoldLight, fontFamily = Inter, fontSize = (w * 0.05f).sp, letterSpacing = 1.sp, maxLines = 1)
        }
    }
}

@Composable
private fun Tag(b: Book, modifier: Modifier = Modifier) {
    val (label, bg, fg) = when {
        b.owned -> Triple("Owned", Brand.Blue, Color.White)
        b.pending -> Triple("Pending", Color(0xFF6B5310), Brand.GoldLight)
        b.free -> Triple("Free", Color(0xFF1E7A4E), Color.White)
        else -> Triple(price(b), Brand.Gold, Brand.Black)
    }
    Text(label, color = fg, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 11.sp,
        modifier = modifier.clip(RoundedCornerShape(50)).background(bg).padding(horizontal = 9.dp, vertical = 3.dp))
}

@Composable
private fun Shelf(books: List<Book>, loading: Boolean, error: String?, canPublish: Boolean, onBack: () -> Unit, open: (Book) -> Unit, publish: () -> Unit, retry: () -> Unit, bottomInset: androidx.compose.ui.unit.Dp) {
    val context = LocalContext.current
    var query by remember { mutableStateOf("") }
    var kind by remember { mutableStateOf("all") }
    val shown = books.filter { (kind == "all" || it.kind == kind) && (query.isBlank() || listOf(it.title, it.author, it.category, it.description).any { f -> f.contains(query, true) }) }
    val reading = remember(books.toList(), Books.version) { books.filter { it.readable && Books.lastReadAt(context, it.id) > 0 }.sortedByDescending { Books.lastReadAt(context, it.id) } }
    val featured = books.take(6)
    val screenW = LocalConfiguration.current.screenWidthDp.dp

    Box(Modifier.fillMaxSize()) {
        // The featured cover washes the top of the page.
        Box(Modifier.fillMaxWidth().height(420.dp).clipToBounds()) {
            AmbientGlow(featured.firstOrNull()?.coverUrl?.takeIf { it.isNotBlank() }, Modifier.fillMaxSize(), blur = 80.dp, alpha = 0.6f)
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color(0x55000000), 1f to Brand.Black)))
        }
        LazyVerticalGrid(GridCells.Fixed(3), contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 120.dp + bottomInset), horizontalArrangement = Arrangement.spacedBy(14.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
            item(span = { GridItemSpan(3) }) { TopBar(title = "", onBack = onBack) }
            item(span = { GridItemSpan(3) }) {
                Column {
                    Text("Books & Library", style = Type.Display, color = Brand.White)
                    Text(if (Books.offline) "Offline shelf · saved books are ready to read" else "Ministry books, journals and study guides", style = Type.Meta.copy(fontSize = 13.5.sp), color = Brand.GoldLight)
                    Spacer(Modifier.height(14.dp))
                    Row(Modifier.fillMaxWidth().height(50.dp).glass(RoundedCornerShape(50), 0.8f).padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Rounded.Search, null, tint = Brand.Text2, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(10.dp))
                        Box(Modifier.weight(1f)) {
                            if (query.isEmpty()) Text("Search titles and authors", style = Type.Body, color = Brand.Muted)
                            BasicTextField(query, { query = it }, singleLine = true, textStyle = Type.Body.copy(color = Brand.White), cursorBrush = SolidColor(Brand.Gold), modifier = Modifier.fillMaxWidth())
                        }
                    }
                    Spacer(Modifier.height(12.dp))
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(kindLabels) { (k, label) ->
                            val on = kind == k
                            Text(label, color = if (on) Brand.Black else Brand.White, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                                modifier = (if (on) Modifier.clip(RoundedCornerShape(50)).background(Brand.GoldGradient) else Modifier.glass()).clickable { kind = k }.padding(horizontal = 14.dp, vertical = 8.dp))
                        }
                    }
                }
            }
            if (loading) item(span = { GridItemSpan(3) }) { Box(Modifier.fillMaxWidth().padding(40.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Brand.Gold) } }
            error?.let { item(span = { GridItemSpan(3) }) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth().padding(vertical = 20.dp)) {
                    ErrorNote(it)
                    Spacer(Modifier.height(12.dp))
                    GhostButton("Try again", onClick = retry)
                }
            } }
            if (!loading && books.isEmpty() && error == null) item(span = { GridItemSpan(3) }) {
                Column(Modifier.fillMaxWidth().padding(vertical = 40.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.AutoMirrored.Rounded.MenuBook, null, tint = Brand.Gold, modifier = Modifier.size(42.dp))
                    Spacer(Modifier.height(10.dp))
                    Text("The shelf is being filled", style = Type.Title, color = Brand.White)
                    Text("Ministry books will appear here.", style = Type.Meta, color = Brand.Text2)
                }
            }
            if (reading.isNotEmpty() && query.isBlank() && kind == "all") {
                item(span = { GridItemSpan(3) }) { Text("Continue reading", style = Type.Title, color = Brand.White, modifier = Modifier.padding(top = 6.dp)) }
                item(span = { GridItemSpan(3) }) {
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        items(reading, key = { "r-" + it.id }) { b ->
                            Row(Modifier.width(270.dp).glass(RoundedCornerShape(18.dp), 0.7f).pressable { open(b) }.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                                BookCover(b, Modifier.width(56.dp))
                                Spacer(Modifier.width(12.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(b.title, style = Type.CardTitle, color = Brand.White, maxLines = 2, overflow = TextOverflow.Ellipsis)
                                    Spacer(Modifier.height(8.dp))
                                    val p = Books.progress(context, b.id)
                                    Box(Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)).background(Color(0x22FFFFFF))) {
                                        Box(Modifier.fillMaxWidth(p).fillMaxHeight().background(Brand.GoldGradient))
                                    }
                                    Text("${(p * 100).toInt()}% read", style = Type.Meta, color = Brand.Text2, modifier = Modifier.padding(top = 4.dp))
                                }
                            }
                        }
                    }
                }
            }
            if (featured.size >= 2 && query.isBlank() && kind == "all") {
                item(span = { GridItemSpan(3) }) { Text("Featured", style = Type.Title, color = Brand.White, modifier = Modifier.padding(top = 6.dp)) }
                item(span = { GridItemSpan(3) }) {
                    val w = screenW * 0.42f
                    Box(Modifier.padding(horizontal = 0.dp)) {
                        CoverFlowRail(featured, w, spacing = 6.dp, depth = 1.2f) { b, offset ->
                            val focus = (1f - offset.absoluteValue).coerceIn(0f, 1f)
                            Column(Modifier.width(w).padding(vertical = 20.dp).pressable { open(b) }) {
                                Box {
                                    if (b.coverUrl.isNotBlank()) AmbientGlow(b.coverUrl, Modifier.matchParentSize().outset(0.dp, drop = 14.dp), blur = 26.dp, alpha = focus)
                                    BookCover(b, Modifier.fillMaxWidth())
                                }
                                Spacer(Modifier.height(10.dp))
                                Text(b.title, style = Type.CardTitle, color = Brand.White, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.graphicsLayer { alpha = 0.4f + 0.6f * focus })
                                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.graphicsLayer { alpha = focus }) {
                                    Text(b.author, style = Type.Meta, color = Brand.Text2, maxLines = 1, modifier = Modifier.weight(1f))
                                    Tag(b)
                                }
                            }
                        }
                    }
                }
                item(span = { GridItemSpan(3) }) { Text("All titles", style = Type.Title, color = Brand.White) }
            }
            items(shown, key = { it.id }) { b ->
                Column(Modifier.pressable { open(b) }) {
                    Box {
                        BookCover(b, Modifier.fillMaxWidth())
                        Tag(b, Modifier.align(Alignment.TopEnd).padding(6.dp))
                        if (!b.isPublished) Text("Hidden", color = Color.White, fontSize = 10.sp, modifier = Modifier.align(Alignment.BottomStart).padding(6.dp).clip(RoundedCornerShape(4.dp)).background(Color(0xCC000000)).padding(horizontal = 6.dp, vertical = 2.dp))
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(b.title, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, lineHeight = 17.sp, color = Brand.White, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Text(b.author, style = Type.Meta.copy(fontSize = 11.5.sp), color = Brand.Text2, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }
        if (canPublish) {
            Row(
                Modifier.align(Alignment.BottomEnd).navigationBarsPadding().padding(bottom = bottomInset).padding(20.dp).lifted(RoundedCornerShape(50), 18.dp, Brand.Gold)
                    .clip(RoundedCornerShape(50)).background(Brand.GoldGradient).clickable(onClick = publish).padding(horizontal = 20.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Rounded.Add, null, tint = Brand.Black)
                Spacer(Modifier.width(6.dp))
                Text("Publish", color = Brand.Black, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            }
        }
    }
}

@Composable
@OptIn(ExperimentalLayoutApi::class)
private fun Detail(b: Book, session: Session, onBack: () -> Unit, read: () -> Unit, buy: () -> Unit, changed: () -> Unit, bottomInset: androidx.compose.ui.unit.Dp = 0.dp) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var editPrice by remember(b.id) { mutableStateOf(b.price.toString()) }
    val have = remember(b.id, Books.version) { Books.has(context, b) }
    val progress = Books.downloading[b.id]

    Box(Modifier.fillMaxSize()) {
        Box(Modifier.fillMaxWidth().height(520.dp).clipToBounds()) {
            if (b.coverUrl.isNotBlank()) AmbientGlow(b.coverUrl, Modifier.fillMaxSize(), blur = 70.dp, alpha = 0.8f)
            else Box(Modifier.fillMaxSize().background(Brush.verticalGradient(coverPalettes[b.id.hashCode().absoluteValue % coverPalettes.size])))
            Box(Modifier.fillMaxSize().background(Brush.verticalGradient(0f to Color(0x44000000), 1f to Brand.Black)))
        }
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding()) {
            TopBar(title = "", onBack = onBack)
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                Box(Modifier.width(190.dp)) {
                    if (b.coverUrl.isNotBlank()) AmbientGlow(b.coverUrl, Modifier.matchParentSize().outset(6.dp, drop = 18.dp), blur = 30.dp)
                    BookCover(b, Modifier.fillMaxWidth().graphicsLayer { rotationY = -6f; cameraDistance = 14f * density })
                }
            }
            Column(Modifier.padding(horizontal = 22.dp, vertical = 20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(kindName(b.kind).uppercase() + if (b.category.isNotBlank() && !b.category.equals(kindName(b.kind), true)) " · ${b.category.uppercase()}" else "", style = Type.Label, color = Brand.Gold)
                Spacer(Modifier.height(8.dp))
                Text(b.title, style = Type.Display, color = Brand.White, textAlign = TextAlign.Center)
                if (b.author.isNotBlank()) Text("by ${b.author}", style = Type.Body, color = Brand.GoldLight)
                Spacer(Modifier.height(14.dp))
                // Wraps onto a second line on narrow phones instead of cutting chips off.
                FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    InfoChip(price(b))
                    if (b.fileSizeBytes > 0) InfoChip(if (b.fileSizeBytes < 1_048_576) "${(b.fileSizeBytes / 1024).coerceAtLeast(1)} KB" else "${"%.1f".format(b.fileSizeBytes / 1_048_576f)} MB")
                    InfoChip("Read in the app")
                }
                Spacer(Modifier.height(22.dp))
                when {
                    b.readable -> GoldButton(if (Books.lastReadAt(context, b.id) > 0) "Continue reading" else "Read now", onClick = read)
                    b.pending -> Row(Modifier.fillMaxWidth().glass(RoundedCornerShape(18.dp)).padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Rounded.HourglassTop, null, tint = Brand.GoldLight)
                        Spacer(Modifier.width(12.dp))
                        Text("Your payment is being confirmed. This book opens here as soon as it is.", style = Type.Meta.copy(fontSize = 13.5.sp), color = Brand.White)
                    }
                    else -> {
                        GoldButton("Get this book · ${price(b)}", onClick = buy)
                        Text(if (session.member == null) "Sign in to buy. " else "" + "Pay with M-Pesa, Airtel Money or bank; it unlocks once confirmed.",
                            style = Type.Meta, color = Brand.Text2, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 8.dp))
                    }
                }
                if (b.readable && (have || progress != null)) {
                    Spacer(Modifier.height(10.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Rounded.Lock, null, tint = Brand.Text2, modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(if (progress != null) "Saving to your shelf ${(progress * 100).toInt()}%" else "Saved on this phone, encrypted · reads offline", style = Type.Meta, color = Brand.Text2)
                    }
                }
                if (b.description.isNotBlank()) {
                    Spacer(Modifier.height(22.dp))
                    Text(b.description, style = Type.Body, color = Brand.Text2)
                }
                if (b.canEdit) {
                    com.shekinahsons.globalapp.admin.PublicationEditor("/library/${b.id}",b.publishedAt,b.isPublished,b.notifyOnPublish,changed)
                    Spacer(Modifier.height(26.dp))
                    Column(Modifier.fillMaxWidth().glass(RoundedCornerShape(20.dp), 0.7f).padding(16.dp)) {
                        Text("PUBLISHER", style = Type.Label, color = Brand.Gold)
                        Spacer(Modifier.height(4.dp))
                        Text(
                            (if (b.publisherName.isNotBlank()) "Published by ${b.publisherName}" else "Published from the dashboard") +
                                if (!b.free) " \u00B7 ${b.sales} sold" else "",
                            style = Type.Meta, color = Brand.Text2,
                        )
                        Spacer(Modifier.height(10.dp))
                        Row(verticalAlignment = Alignment.Bottom) {
                            Field("PRICE (KSH, 0 = FREE)", editPrice, { editPrice = it.filter(Char::isDigit).take(7) }, Modifier.weight(1f), keyboard = KeyboardType.Number)
                            Spacer(Modifier.width(10.dp))
                            Text("Save", color = Brand.Black, fontWeight = FontWeight.Bold, modifier = Modifier.clip(RoundedCornerShape(50)).background(Brand.Gold).clickable(enabled = !busy) {
                                scope.launch { busy = true; runCatching { Books.update(b.id, mapOf("price" to (editPrice.toIntOrNull() ?: 0))) }.onSuccess { changed() }.onFailure { error = it.message }; busy = false }
                            }.padding(horizontal = 18.dp, vertical = 14.dp))
                        }
                        Spacer(Modifier.height(12.dp))
                        Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).clickable(enabled = !busy) {
                            scope.launch { busy = true; runCatching { Books.update(b.id, mapOf("isPublished" to !b.isPublished)) }.onSuccess { changed() }.onFailure { error = it.message }; busy = false }
                        }.padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(if (b.isPublished) Icons.Rounded.Visibility else Icons.Rounded.VisibilityOff, null, tint = Brand.GoldLight)
                            Spacer(Modifier.width(10.dp))
                            Text(if (b.isPublished) "Publication enabled · tap to hide" else "Hidden · tap to publish", color = Brand.White)
                        }
                        ErrorNote(error)
                    }
                }
            }
            // Room to scroll the last controls clear of the bottom bar and gesture area.
            Spacer(Modifier.height(32.dp + bottomInset).navigationBarsPadding())
        }
    }
}

@Composable
private fun InfoChip(text: String) {
    Text(text, color = Brand.White, fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 12.5.sp, modifier = Modifier.glass().padding(horizontal = 12.dp, vertical = 6.dp))
}

// Publishing a book, journal or study guide from the phone.
@Composable
private fun Publish(onBack: () -> Unit, done: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var title by remember { mutableStateOf("") }
    var author by remember { mutableStateOf("Sir Joseph Mash") }
    var category by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var kind by remember { mutableStateOf("book") }
    var paid by remember { mutableStateOf(false) }
    var priceText by remember { mutableStateOf("") }
    var pdf by remember { mutableStateOf<Uri?>(null) }
    var pdfName by remember { mutableStateOf("") }
    var cover by remember { mutableStateOf<Uri?>(null) }
    var busy by remember { mutableStateOf(false) }
    var progress by remember { mutableFloatStateOf(0f) }
    var error by remember { mutableStateOf<String?>(null) }
    val pickPdf = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            pdf = uri
            pdfName = context.contentResolver.query(uri, null, null, null, null)?.use { c -> if (c.moveToFirst()) c.getString(c.getColumnIndexOrThrow(android.provider.OpenableColumns.DISPLAY_NAME)) else "" }.orEmpty()
            if (title.isBlank()) title = pdfName.removeSuffix(".pdf").replace('_', ' ').replace('-', ' ')
        }
    }
    val pickCover = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri -> if (uri != null) cover = uri }

    Column(Modifier.fillMaxSize().imePadding()) {
        TopBar(title = "Publish", onBack = onBack)
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 18.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                // Cover
                Box(Modifier.width(120.dp).aspectRatio(2 / 3f).clip(RoundedCornerShape(10.dp)).glass(RoundedCornerShape(10.dp)).clickable {
                    pickCover.launch(androidx.activity.result.PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                }, contentAlignment = Alignment.Center) {
                    if (cover != null) AsyncImage(cover, "Cover", contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                    else Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(Icons.Rounded.Image, null, tint = Brand.Gold, modifier = Modifier.size(30.dp))
                        Text("Cover override", color = Brand.Text2, fontSize = 12.sp)
                        Text("(optional)", color = Brand.Muted, fontSize = 11.sp)
                    }
                }
                // File
                Column(Modifier.weight(1f)) {
                    Box(Modifier.fillMaxWidth().height(120.dp).clip(RoundedCornerShape(16.dp)).border(1.5.dp, if (pdf != null) Brand.Gold else Color(0x44FFFFFF), RoundedCornerShape(16.dp))
                        .background(Color(0x10FFFFFF)).clickable { pickPdf.launch(arrayOf("application/pdf")) }.padding(12.dp), contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(if (pdf != null) Icons.Rounded.CheckCircle else Icons.Rounded.PictureAsPdf, null, tint = Brand.Gold, modifier = Modifier.size(30.dp))
                            Spacer(Modifier.height(6.dp))
                            Text(if (pdf != null) pdfName else "Choose the PDF", color = Brand.White, fontSize = 13.sp, textAlign = TextAlign.Center, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        }
                    }
                    Spacer(Modifier.height(10.dp))
                    Text("The file is encrypted before it's stored. Readers can only open it inside the app.", style = Type.Meta.copy(fontSize = 11.5.sp), color = Brand.Text2)
                }
            }
            Spacer(Modifier.height(18.dp))
            Field("TITLE", title, { title = it.take(160) })
            Spacer(Modifier.height(12.dp))
            Field("AUTHOR", author, { author = it.take(80) })
            Spacer(Modifier.height(12.dp))
            Text("TYPE", style = Type.Label.copy(fontSize = 10.5.sp), color = Brand.GoldLight, modifier = Modifier.padding(start = 4.dp, bottom = 6.dp))
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(kindLabels.drop(1)) { (k, label) ->
                    val on = kind == k
                    Text(label.removeSuffix("s"), color = if (on) Brand.Black else Brand.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                        modifier = (if (on) Modifier.clip(RoundedCornerShape(50)).background(Brand.GoldGradient) else Modifier.glass()).clickable { kind = k }.padding(horizontal = 14.dp, vertical = 8.dp))
                }
            }
            Spacer(Modifier.height(12.dp))
            Field("CATEGORY (OPTIONAL)", category, { category = it.take(40) }, hint = "e.g. Prayer, Sonship")
            Spacer(Modifier.height(12.dp))
            Field("DESCRIPTION", description, { description = it.take(1500) }, minHeight = 110.dp, singleLine = false)
            Spacer(Modifier.height(16.dp))
            Text("ACCESS", style = Type.Label.copy(fontSize = 10.5.sp), color = Brand.GoldLight, modifier = Modifier.padding(start = 4.dp, bottom = 6.dp))
            Row(Modifier.fillMaxWidth().glass(RoundedCornerShape(50), 0.8f).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                listOf(false to "Free for everyone", true to "Paid").forEach { (v, label) ->
                    Box(Modifier.weight(1f).height(42.dp).clip(RoundedCornerShape(50)).background(if (paid == v) Brand.GoldGradient else SolidColor(Color.Transparent)).clickable { paid = v }, contentAlignment = Alignment.Center) {
                        Text(label, color = if (paid == v) Brand.Black else Brand.Text2, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    }
                }
            }
            if (paid) {
                Spacer(Modifier.height(12.dp))
                Field("PRICE (KSH)", priceText, { priceText = it.filter(Char::isDigit).take(7) }, hint = "e.g. 500", keyboard = KeyboardType.Number)
                Text("Readers pay with the church's M-Pesa / Airtel paybill or bank, and the book unlocks when finance confirms.", style = Type.Meta, color = Brand.Text2, modifier = Modifier.padding(top = 6.dp))
            }
            ErrorNote(error)
            Spacer(Modifier.height(20.dp))
            if (busy) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                    Box(Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)).background(Color(0x22FFFFFF))) {
                        Box(Modifier.fillMaxWidth(progress.coerceIn(0.02f, 1f)).fillMaxHeight().background(Brand.GoldGradient))
                    }
                    Text(if (progress < 1f) "Uploading ${(progress * 100).toInt()}%" else "Securing and publishing…", style = Type.Meta, color = Brand.Text2, modifier = Modifier.padding(top = 8.dp))
                }
            } else {
                GoldButton("Publish", enabled = pdf != null && title.isNotBlank() && (!paid || (priceText.toIntOrNull() ?: 0) > 0)) {
                    scope.launch {
                        busy = true; error = null; progress = 0f
                        runCatching { Books.publish(context, title.trim(), author.trim(), description.trim(), category.trim(), kind, if (paid) priceText.toIntOrNull() ?: 0 else 0, pdf!!, cover) { progress = it } }
                            .onSuccess { done() }.onFailure { error = it.message }
                        busy = false
                    }
                }
            }
            Spacer(Modifier.height(40.dp))
        }
    }
}
