package com.shekinahsons.globalapp.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.rounded.AccountBalance
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.ContentPaste
import androidx.compose.material.icons.rounded.HourglassTop
import androidx.compose.material.icons.rounded.PhoneAndroid
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.BuildConfig
import com.shekinahsons.globalapp.R
import com.shekinahsons.globalapp.data.Api
import com.shekinahsons.globalapp.data.Session
import com.shekinahsons.globalapp.ui.components.ErrorNote
import com.shekinahsons.globalapp.ui.components.Field
import com.shekinahsons.globalapp.ui.components.GhostButton
import com.shekinahsons.globalapp.ui.components.GoldButton
import com.shekinahsons.globalapp.ui.components.glass
import com.shekinahsons.globalapp.ui.components.lifted
import com.shekinahsons.globalapp.ui.components.pressable
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Scripture
import com.shekinahsons.globalapp.ui.theme.Type
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter

@Serializable
data class Paybill(val enabled: Boolean = false, val paybill: String = "", val account: String = "", val accountHint: String = "", val name: String = "")

@Serializable
data class Bank(val enabled: Boolean = false, val bankName: String = "", val accountName: String = "", val accountNumber: String = "", val branch: String = "", val swiftCode: String = "", val reference: String = "")

@Serializable
data class GivingDetails(val mpesaPrompt:Boolean=false,val cards:Boolean=false,val mpesa: Paybill = Paybill(), val airtel: Paybill = Paybill(), val bank: Bank = Bank(), val note: String = "", val categories: List<String> = emptyList())

@Serializable
data class Gift(
    val id: String = "", val status: String = "", val amount: Int = 0, val category: String = "", val method: String = "",
    val createdAt: String = "", val providerReference: String = "", val payerName: String = "",
)

private enum class Way(val key: String, val title: String, val subtitle: String, val colors: List<Color>, val ink: Color, val accent: Color, val mark: String, val note: String) {
    Mpesa("mpesa_paybill", "M-Pesa", "Lipa na M-PESA · Paybill", listOf(Color(0xFF3FB64A), Color(0xFF167A2B)), Color.White, Color(0xFF4CD964), "M-PESA", "Most used · on any Safaricom line"),
    Airtel("airtel_paybill", "Airtel Money", "Make Payments · Pay Bill", listOf(Color(0xFFF2343C), Color(0xFF8E0F18)), Color.White, Color(0xFFFF4D57), "airtel", "From any Airtel line"),
    Bank("bank", "Bank transfer", "Deposit, EFT or RTGS", listOf(Color(0xFFE8C766), Color(0xFF9C7618)), Color(0xFF1A1206), Color(0xFFF0D27A), "BANK", "Best for large gifts"),
}

private enum class Step { Method, Amount, Pay, Confirm, Done }

private fun copy(context: Context, label: String, text: String) {
    context.getSystemService(ClipboardManager::class.java).setPrimaryClip(ClipData.newPlainText(label, text))
}

private fun money(v: Int) = "KSh ${"%,d".format(v)}"

// Giving, one step at a time: pick how, pick how much, follow the payment
// card on your own phone or bank, then confirm with the transaction code.
// A purchase made with the giving payment flow: a book, an event ticket or a
// paid live. The kind is also the paybill account (BOOK, EVENT, LIVE) so
// finance can tell purchases apart.
data class Purchase(
    val itemId: String, val title: String, val price: Int, val kind: String = "Book",
    val after: String = "opens on your shelf as soon as the finance team confirms your payment. We'll keep it ready for you.",
    val back: String = "Back to the library",
)

private val purchaseKinds = setOf("Book", "Event", "Live")

@Composable
fun GivingPage(session: Session, purchase: Purchase? = null, onPurchased: () -> Unit = {}) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val prefs = remember { context.getSharedPreferences("giving", Context.MODE_PRIVATE) }
    var details by remember { mutableStateOf<GivingDetails?>(null) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var step by remember { mutableStateOf(Step.Method) }
    var way by remember { mutableStateOf(Way.Mpesa) }
    var category by remember { mutableStateOf(purchase?.kind ?: "Tithe") }
    var amount by remember { mutableStateOf(purchase?.price?.toString() ?: "") }
    var code by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf(prefs.getString("phone", "") ?: "") }
    var name by remember { mutableStateOf(session.member?.name ?: prefs.getString("name", "") ?: "") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var reload by remember { mutableIntStateOf(0) }
    val history = remember { mutableStateListOf<Gift>() }

    LaunchedEffect(Unit) {
        runCatching { details = Api.decode<GivingDetails>(Api.get("/giving/details")["details"]) }.onFailure { loadError = it.message }
    }
    // Signed in: your giving from the server. Otherwise the ones made on this phone.
    LaunchedEffect(reload, session.member) {
        history.clear()
        if (session.member != null) runCatching { history.addAll(Api.decode<List<Gift>>(Api.get("/giving/mine")["transactions"])) }
        else prefs.getString("ids", "")!!.split(",").filter { it.isNotBlank() }.reversed().take(20).forEach { id ->
            runCatching { history += Api.decode<Gift>(Api.get("/giving/transactions/$id", prefs.getString("receipt-$id", null)?.let { mapOf("X-Receipt-Token" to it) } ?: emptyMap())["transaction"]) }
        }
    }
    BackHandler(enabled = step != Step.Method && step != Step.Done) {
        step = when (step) { Step.Amount -> Step.Method; Step.Pay -> if (purchase != null) Step.Method else Step.Amount; Step.Confirm -> Step.Pay; else -> Step.Method }
    }

    val d = details
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding().padding(16.dp)) {
        if (step != Step.Done) Stepper(step, purchase != null)
        Spacer(Modifier.height(14.dp))
        when {
            d == null && loadError == null -> Text("Loading…", style = Type.Body, color = Brand.Muted)
            d == null -> ErrorNote(loadError)
            !d.mpesaPrompt && !d.cards && !d.mpesa.enabled && !d.airtel.enabled && !d.bank.enabled -> Text("Giving details will appear here soon.", style = Type.Body, color = Brand.Muted)
            else -> AnimatedContent(
                step,
                transitionSpec = {
                    val forward = targetState.ordinal > initialState.ordinal
                    (slideInHorizontally(tween(280)) { if (forward) it / 4 else -it / 4 } + fadeIn(tween(280))) togetherWith fadeOut(tween(160))
                },
                label = "step",
            ) { st ->
                Column(Modifier.fillMaxWidth()) {
                    when (st) {
                        Step.Method -> {
                            if(d.mpesaPrompt||d.cards)GatewayPayments(session,d,purchase){reload++;if(purchase!=null)onPurchased()}
                            if(d.mpesaPrompt||d.cards){if(d.mpesa.enabled||d.airtel.enabled||d.bank.enabled)Text("Other payment methods",style=Type.CardTitle,color=Brand.White)}
                            else if (purchase != null) {
                                Text("How would you like to pay?", style = Type.Title, color = Brand.White)
                                Spacer(Modifier.height(4.dp))
                                Text("${purchase.title} · ${money(purchase.price)}", color = Brand.GoldLight, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                            } else {
                                Text("How would you like to give?", style = Type.Title, color = Brand.White)
                                Spacer(Modifier.height(4.dp))
                                Text("“God loves a cheerful giver.” 2 Corinthians 9:7", fontFamily = Scripture, fontSize = 15.sp, color = Brand.GoldLight)
                            }
                            Spacer(Modifier.height(16.dp))
                            listOf(Way.Mpesa to d.mpesa.enabled, Way.Airtel to d.airtel.enabled, Way.Bank to d.bank.enabled).filter { it.second }.forEach { (w, _) ->
                                MethodCard(w) { way = w; error = null; step = if (purchase != null) Step.Pay else Step.Amount }
                                Spacer(Modifier.height(12.dp))
                            }
                            if (d.note.isNotBlank()) Text(d.note, style = Type.Meta, color = Brand.Text2, modifier = Modifier.padding(top = 4.dp))
                        }
                        Step.Amount -> {
                            BackRow("Giving by ${way.title}") { step = Step.Method }
                            Text("What are you giving towards?", style = Type.CardTitle, color = Brand.White)
                            Spacer(Modifier.height(10.dp))
                            ChipRow(d.categories.ifEmpty { listOf("Tithe", "Offering") }, category) { category = it }
                            Spacer(Modifier.height(20.dp))
                            Text("How much?", style = Type.CardTitle, color = Brand.White)
                            Spacer(Modifier.height(10.dp))
                            AmountBox(amount) { amount = it }
                            Spacer(Modifier.height(10.dp))
                            ChipRow(listOf("200", "500", "1000", "2000", "5000", "10000"), amount, format = { money(it.toInt()) }) { amount = it }
                            Spacer(Modifier.height(24.dp))
                            GoldButton("Continue", enabled = (amount.toIntOrNull() ?: 0) > 0) { step = Step.Pay }
                        }
                        Step.Pay -> {
                            BackRow(if (purchase != null) "Pay ${money(purchase.price)} · ${purchase.title}" else "Pay ${money(amount.toIntOrNull() ?: 0)} · $category") { step = if (purchase != null) Step.Method else Step.Amount }
                            PaymentCard(way, d, amount.toIntOrNull() ?: 0, category)
                            Spacer(Modifier.height(18.dp))
                            Text("Follow these steps", style = Type.CardTitle, color = Brand.White)
                            Spacer(Modifier.height(10.dp))
                            val steps = instructions(way, d, amount.toIntOrNull() ?: 0, category)
                            Column(Modifier.fillMaxWidth().glass(RoundedCornerShape(20.dp), 0.7f).padding(16.dp)) {
                                steps.forEachIndexed { i, line -> StepLine(i + 1, line, last = i == steps.lastIndex) }
                            }
                            Spacer(Modifier.height(20.dp))
                            GoldButton("I've paid — confirm") { step = Step.Confirm; error = null }
                        }
                        Step.Confirm -> {
                            BackRow(if (purchase != null) "Confirm your payment" else "Confirm your gift") { step = Step.Pay }
                            Text(
                                if (way == Way.Bank) "Enter the reference on your bank slip or transfer confirmation."
                                else "Enter the transaction code from the ${way.title} message you received (e.g. SJK4XY7Z2P).",
                                style = Type.Body, color = Brand.Text2,
                            )
                            Spacer(Modifier.height(14.dp))
                            Row(verticalAlignment = Alignment.Bottom) {
                                Field("TRANSACTION CODE", code, { code = it.uppercase().filter { c -> c.isLetterOrDigit() }.take(20) }, Modifier.weight(1f), hint = "SJK4XY7Z2P")
                                Spacer(Modifier.width(8.dp))
                                Box(Modifier.size(52.dp).glass(RoundedCornerShape(16.dp)).clickable {
                                    // Pull the code out of a copied confirmation SMS.
                                    val clip = context.getSystemService(ClipboardManager::class.java).primaryClip?.getItemAt(0)?.coerceToText(context)?.toString().orEmpty()
                                    Regex("\\b[A-Z0-9]{10}\\b").find(clip.uppercase())?.value?.let { code = it } ?: run { code = clip.uppercase().filter { it.isLetterOrDigit() }.take(20) }
                                }, contentAlignment = Alignment.Center) { Icon(Icons.Rounded.ContentPaste, "Paste code", tint = Brand.Gold) }
                            }
                            Spacer(Modifier.height(12.dp))
                            Field("YOUR NAME", name, { name = it })
                            Spacer(Modifier.height(12.dp))
                            if (way != Way.Bank) Field("PHONE NUMBER USED", phone, { phone = it }, hint = "07XX XXX XXX", keyboard = KeyboardType.Phone)
                            ErrorNote(error)
                            Spacer(Modifier.height(18.dp))
                            GoldButton("Submit confirmation", busy = busy, enabled = code.length >= 6 && name.isNotBlank()) {
                                scope.launch {
                                    busy = true; error = null
                                    prefs.edit().putString("phone", phone).putString("name", name).apply()
                                    runCatching {
                                        val res = Api.post("/giving/confirm", mapOf("method" to way.key, "category" to category, "amount" to (amount.toIntOrNull() ?: 0), "reference" to code, "phone" to phone, "name" to name, "itemId" to (purchase?.itemId ?: "")))
                                        val gift = Api.decode<Gift>(res["transaction"])
                                        val raw = res["transaction"] as? kotlinx.serialization.json.JsonObject
                                        (raw?.get("receiptToken") as? kotlinx.serialization.json.JsonPrimitive)?.content?.let { prefs.edit().putString("receipt-${gift.id}", it).apply() }
                                        prefs.edit().putString("ids", (prefs.getString("ids", "") + "," + gift.id).trim(',')).apply()
                                    }.onSuccess { step = Step.Done; reload++ }.onFailure { error = it.message }
                                    busy = false
                                }
                            }
                        }
                        Step.Done -> if (purchase != null) BookPending(purchase, onPurchased) else ThankYou(money(amount.toIntOrNull() ?: 0), category) {
                            step = Step.Method; amount = ""; code = ""
                        }
                    }
                }
            }
        }
        if (purchase == null && history.isNotEmpty() && (step == Step.Method || step == Step.Done)) {
            Spacer(Modifier.height(26.dp))
            Text("Your giving", style = Type.Title, color = Brand.White)
            Spacer(Modifier.height(10.dp))
            history.forEach { g -> HistoryRow(g); Spacer(Modifier.height(8.dp)) }
        }
        Spacer(Modifier.height(30.dp))
    }
}

@Composable
private fun Stepper(step: Step, purchase: Boolean) {
    val labels = if (purchase) listOf("Method", "Pay", "Confirm") else listOf("Method", "Amount", "Pay", "Confirm")
    val current = if (purchase && step.ordinal >= Step.Pay.ordinal) step.ordinal - 1 else step.ordinal
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        labels.forEachIndexed { i, label ->
            val done = i < current
            val on = i == current
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Box(
                    Modifier.size(28.dp).clip(CircleShape).background(if (on || done) Brand.GoldGradient else SolidColor(Color(0x22FFFFFF))),
                    contentAlignment = Alignment.Center,
                ) {
                    if (done) Icon(Icons.Rounded.CheckCircle, null, tint = Brand.Black, modifier = Modifier.size(18.dp))
                    else Text("${i + 1}", color = if (on) Brand.Black else Brand.Text2, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }
                Text(label, color = if (on) Brand.GoldLight else Brand.Muted, fontSize = 11.sp, modifier = Modifier.padding(top = 4.dp))
            }
            if (i < labels.lastIndex) Box(Modifier.weight(1f).padding(horizontal = 6.dp, vertical = 0.dp).padding(bottom = 16.dp).height(2.dp).background(if (done) Brand.Gold else Color(0x22FFFFFF)))
        }
    }
}

@Composable
private fun BackRow(title: String, back: () -> Unit) {
    Row(Modifier.padding(bottom = 14.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back", tint = Brand.White, modifier = Modifier.size(38.dp).clip(CircleShape).clickable(onClick = back).padding(8.dp))
        Spacer(Modifier.width(6.dp))
        Text(title, style = Type.Title, color = Brand.White)
    }
}

// Brand mark: the provider's colour block with its name, like on a card.
@Composable
private fun BrandMark(w: Way, height: androidx.compose.ui.unit.Dp = 30.dp) {
    Box(
        Modifier.height(height).clip(RoundedCornerShape(8.dp)).background(Brush.linearGradient(w.colors)).padding(horizontal = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        if (w == Way.Bank) Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Rounded.AccountBalance, null, tint = w.ink, modifier = Modifier.size(height * 0.5f))
            Spacer(Modifier.width(4.dp))
            Text(w.mark, color = w.ink, fontFamily = Inter, fontWeight = FontWeight.Black, fontSize = (height.value * 0.4f).sp, letterSpacing = 1.sp)
        } else Text(w.mark, color = w.ink, fontFamily = Inter, fontWeight = FontWeight.Black, fontSize = (height.value * 0.42f).sp, letterSpacing = if (w == Way.Mpesa) 0.5.sp else 0.sp)
    }
}

// A way to pay: a dark card with the provider's colour as its accent.
@Composable
private fun MethodCard(w: Way, onClick: () -> Unit) {
    val shape = RoundedCornerShape(24.dp)
    Box(
        Modifier.fillMaxWidth().lifted(shape, 16.dp, w.accent.copy(alpha = 0.35f)).clip(shape)
            .background(Brush.linearGradient(listOf(Color(0xFF1C1C20), Color(0xFF111114))))
            .border(1.dp, Brush.linearGradient(listOf(w.accent.copy(alpha = 0.55f), Color(0x14FFFFFF), Color(0x14FFFFFF))), shape)
            .pressable(onClick),
    ) {
        // The provider's colour glowing from the left edge.
        Box(Modifier.matchParentSize().background(Brush.horizontalGradient(0f to w.accent.copy(alpha = 0.22f), 0.45f to Color.Transparent)))
        Box(Modifier.align(Alignment.CenterStart).width(4.dp).height(56.dp).clip(RoundedCornerShape(topEnd = 4.dp, bottomEnd = 4.dp)).background(Brush.verticalGradient(w.colors)))
        Row(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 18.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                BrandMark(w, 28.dp)
                Spacer(Modifier.height(12.dp))
                Text(w.title, color = Color.White, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 19.sp)
                Text(w.subtitle, color = Brand.Text2, fontSize = 13.sp)
                Spacer(Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(6.dp).clip(CircleShape).background(w.accent))
                    Spacer(Modifier.width(6.dp))
                    Text(w.note, color = w.accent.copy(alpha = 0.9f), fontSize = 12.sp, fontWeight = FontWeight.Medium)
                }
            }
            Box(Modifier.size(44.dp).clip(CircleShape).background(Color(0x14FFFFFF)).border(1.dp, Color(0x22FFFFFF), CircleShape), contentAlignment = Alignment.Center) {
                Icon(Icons.AutoMirrored.Rounded.ArrowForward, null, tint = Color.White, modifier = Modifier.size(20.dp))
            }
        }
    }
}

@Composable
private fun ChipRow(options: List<String>, selected: String, format: (String) -> String = { it }, onSelect: (String) -> Unit) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(options) { o ->
            val on = o == selected
            Text(
                format(o), color = if (on) Brand.Black else Brand.White, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 14.sp,
                modifier = (if (on) Modifier.clip(RoundedCornerShape(50)).background(Brand.GoldGradient) else Modifier.glass()).clickable { onSelect(o) }.padding(horizontal = 16.dp, vertical = 9.dp),
            )
        }
    }
}

@Composable
private fun AmountBox(amount: String, onChange: (String) -> Unit) {
    Row(Modifier.fillMaxWidth().glass(RoundedCornerShape(20.dp)).padding(horizontal = 20.dp, vertical = 16.dp), verticalAlignment = Alignment.CenterVertically) {
        Text("KSh", color = Brand.GoldLight, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 22.sp)
        Spacer(Modifier.width(12.dp))
        Box(Modifier.weight(1f)) {
            if (amount.isEmpty()) Text("0", color = Brand.Muted, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 34.sp)
            BasicTextField(
                amount, { onChange(it.filter(Char::isDigit).take(7)) }, singleLine = true,
                textStyle = Type.Display.copy(fontSize = 34.sp, color = Brand.White), cursorBrush = SolidColor(Brand.Gold),
                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

// The payment details as a card you could hold: a dark bank card with the
// provider's colours, a chip, the number set large, and copy buttons.
@Composable
private fun PaymentCard(w: Way, d: GivingDetails, amount: Int, category: String) {
    val context = LocalContext.current
    val shape = RoundedCornerShape(26.dp)
    var copied by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(copied) { if (copied != null) { kotlinx.coroutines.delay(1600); copied = null } }
    fun copyIt(label: String, value: String) { copy(context, label, value); copied = label }
    val p = if (w == Way.Mpesa) d.mpesa else d.airtel
    val number = if (w == Way.Bank) d.bank.accountNumber else p.paybill
    Column {
        Box(
            Modifier.fillMaxWidth().aspectRatio(1.586f).lifted(shape, 26.dp, w.accent.copy(alpha = 0.45f)).clip(shape)
                .background(Brush.linearGradient(listOf(Color(0xFF202024), Color(0xFF0D0D10), w.colors.last().copy(alpha = 0.55f))))
                .border(1.dp, Color(0x26FFFFFF), shape),
        ) {
            // Sheen and the provider's colour wash.
            Box(Modifier.matchParentSize().background(Brush.radialGradient(listOf(w.accent.copy(alpha = 0.35f), Color.Transparent), radius = 700f, center = androidx.compose.ui.geometry.Offset(900f, 0f))))
            Box(Modifier.matchParentSize().background(Brush.linearGradient(0.25f to Color.Transparent, 0.42f to Color(0x18FFFFFF), 0.5f to Color.Transparent)))
            Image(painterResource(R.drawable.dove_mark), null, Modifier.align(Alignment.BottomEnd).padding(14.dp).size(96.dp).graphicsLayer { alpha = 0.12f })
            Column(Modifier.fillMaxSize().padding(20.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    BrandMark(w, 26.dp)
                    Spacer(Modifier.weight(1f))
                    Text(if (w == Way.Bank) "BANK DEPOSIT" else "PAYBILL", color = Color(0xB3FFFFFF), fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
                }
                Spacer(Modifier.height(16.dp))
                // The chip.
                Box(Modifier.size(width = 44.dp, height = 32.dp).clip(RoundedCornerShape(7.dp)).background(Brush.linearGradient(listOf(Color(0xFFF7E3A0), Color(0xFFC9A33A), Color(0xFF8C6B16))))) {
                    Box(Modifier.align(Alignment.Center).fillMaxWidth().height(1.dp).background(Color(0x55000000)))
                    Box(Modifier.align(Alignment.Center).width(1.dp).fillMaxHeight().background(Color(0x55000000)))
                    Box(Modifier.align(Alignment.Center).size(width = 18.dp, height = 14.dp).clip(RoundedCornerShape(3.dp)).border(1.dp, Color(0x66000000), RoundedCornerShape(3.dp)))
                }
                Spacer(Modifier.weight(1f))
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.clickable { copyIt(if (w == Way.Bank) "Account number" else "Paybill", number) }) {
                    Text(number.chunked(if (w == Way.Bank) 4 else 3).joinToString("  "), color = Color.White, fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                        fontWeight = FontWeight.Bold, fontSize = 26.sp, letterSpacing = 1.sp, maxLines = 1)
                    Spacer(Modifier.width(10.dp))
                    Icon(Icons.Rounded.ContentCopy, "Copy number", tint = Color(0xCCFFFFFF), modifier = Modifier.size(18.dp))
                }
                Spacer(Modifier.height(12.dp))
                Row(verticalAlignment = Alignment.Bottom) {
                    Column(Modifier.weight(1f)) {
                        Text(if (w == Way.Bank) "ACCOUNT NAME" else "ACCOUNT", color = Color(0x99FFFFFF), fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.5.sp)
                        Text(if (w == Way.Bank) d.bank.accountName.ifBlank { "Shekinah Sons Global" } else accountFor(p, category),
                            color = Color.White, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 15.sp, maxLines = 1)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("AMOUNT", color = Color(0x99FFFFFF), fontSize = 10.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.5.sp)
                        Text(money(amount), color = w.accent, fontFamily = Inter, fontWeight = FontWeight.Black, fontSize = 17.sp)
                    }
                }
            }
        }
        Spacer(Modifier.height(12.dp))
        // Every value, one tap to copy.
        Column(Modifier.fillMaxWidth().glass(RoundedCornerShape(20.dp), 0.85f).padding(horizontal = 16.dp, vertical = 6.dp)) {
            val rows = if (w == Way.Bank) listOfNotNull(
                "Bank" to d.bank.bankName, "Account name" to d.bank.accountName, "Account number" to d.bank.accountNumber,
                d.bank.branch.takeIf { it.isNotBlank() }?.let { "Branch" to it }, d.bank.swiftCode.takeIf { it.isNotBlank() }?.let { "SWIFT" to it },
            ) else listOf("Business number" to p.paybill, "Account number" to accountFor(p, category), "Amount" to "$amount")
            rows.forEachIndexed { i, (label, value) ->
                Row(Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(label, style = Type.Meta, color = Brand.Text2)
                        Text(value, color = Color.White, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                    }
                    val done = copied == label
                    Row(
                        Modifier.clip(RoundedCornerShape(50)).background(if (done) w.accent.copy(alpha = 0.2f) else Color(0x14FFFFFF)).clickable { copyIt(label, value) }.padding(horizontal = 12.dp, vertical = 7.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(if (done) Icons.Rounded.CheckCircle else Icons.Rounded.ContentCopy, null, tint = if (done) w.accent else Brand.GoldLight, modifier = Modifier.size(15.dp))
                        Text(if (done) " Copied" else " Copy", color = if (done) w.accent else Color.White, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
                if (i < rows.lastIndex) Box(Modifier.fillMaxWidth().height(1.dp).background(Color(0x14FFFFFF)))
            }
        }
        if (w != Way.Bank) {
            Spacer(Modifier.height(10.dp))
            Row(
                Modifier.fillMaxWidth().height(50.dp).clip(RoundedCornerShape(50)).background(Brush.horizontalGradient(w.colors))
                    .clickable { openWallet(context, w) },
                horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Rounded.PhoneAndroid, null, tint = w.ink, modifier = Modifier.size(18.dp))
                Text("  Open ${w.title}", color = w.ink, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            }
        }
    }
}

// Opens the wallet app if it's installed, otherwise the SIM toolkit menu.
private fun openWallet(context: Context, w: Way) {
    val pm = context.packageManager
    val apps = if (w == Way.Mpesa) listOf("com.safaricom.mpesa.lifestyle", "com.safaricom.mysafaricom") else listOf("com.airtel.africa.selfcare", "com.airtel.money")
    val launch = (apps + "com.android.stk").firstNotNullOfOrNull { pm.getLaunchIntentForPackage(it) }
    runCatching { context.startActivity(launch ?: android.content.Intent(android.content.Intent.ACTION_MAIN).setClassName("com.android.stk", "com.android.stk.StkLauncherActivity")) }
}

// Purchases always use their kind as the account so finance can tell them apart.
private fun accountFor(p: Paybill, category: String) = if (category in purchaseKinds) category.uppercase() else p.account.ifBlank { category.uppercase() }

private fun instructions(w: Way, d: GivingDetails, amount: Int, category: String): List<String> = when (w) {
    Way.Mpesa -> listOf(
        "Open M-PESA on your phone (SIM toolkit or the M-PESA app).",
        "Choose Lipa na M-PESA, then Pay Bill.",
        "Business number: ${d.mpesa.paybill}",
        "Account number: ${accountFor(d.mpesa, category)}" + if (category !in purchaseKinds && d.mpesa.accountHint.isNotBlank()) " (${d.mpesa.accountHint})" else "",
        "Amount: ${money(amount)}",
        "Enter your M-PESA PIN and confirm. You'll get an SMS with a transaction code.",
    )
    Way.Airtel -> listOf(
        "Open Airtel Money on your phone (the Airtel Money menu or the My Airtel app).",
        "Choose Make Payments, then Pay Bill.",
        "Business number: ${d.airtel.paybill}",
        "Account number: ${accountFor(d.airtel, category)}" + if (category !in purchaseKinds && d.airtel.accountHint.isNotBlank()) " (${d.airtel.accountHint})" else "",
        "Amount: ${money(amount)}",
        "Enter your Airtel Money PIN and confirm. You'll get an SMS with a transaction ID.",
    )
    Way.Bank -> listOfNotNull(
        "Deposit or transfer ${money(amount)} to ${d.bank.bankName}.",
        "Account name: ${d.bank.accountName}",
        "Account number: ${d.bank.accountNumber}",
        d.bank.branch.takeIf { it.isNotBlank() }?.let { "Branch: $it" },
        d.bank.swiftCode.takeIf { it.isNotBlank() }?.let { "SWIFT: $it" },
        "Reference: ${d.bank.reference.ifBlank { "your name and \"$category\"" }}",
        "Keep the slip or confirmation; you'll enter its reference next.",
    )
}

@Composable
private fun StepLine(n: Int, text: String, last: Boolean = false) {
    Row(Modifier.height(androidx.compose.foundation.layout.IntrinsicSize.Min)) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(Modifier.size(28.dp).clip(CircleShape).background(Brand.GoldGradient), contentAlignment = Alignment.Center) {
                Text("$n", color = Brand.Black, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            }
            if (!last) Box(Modifier.width(2.dp).weight(1f).background(Brush.verticalGradient(listOf(Color(0x99D4AF37), Color(0x22D4AF37)))))
        }
        Spacer(Modifier.width(14.dp))
        Text(text, style = Type.Body.copy(fontSize = 15.sp, lineHeight = 21.sp), color = Brand.White, modifier = Modifier.padding(top = 3.dp, bottom = if (last) 0.dp else 16.dp))
    }
}

@Composable
private fun ThankYou(amount: String, category: String, again: () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(top = 20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(96.dp).lifted(CircleShape, 22.dp, Brand.Gold).clip(CircleShape).background(Brand.GoldGradient), contentAlignment = Alignment.Center) {
            Icon(Icons.Rounded.CheckCircle, null, tint = Brand.Black, modifier = Modifier.size(54.dp))
        }
        Spacer(Modifier.height(18.dp))
        Text("Thank you!", style = Type.Display, color = Brand.White)
        Spacer(Modifier.height(6.dp))
        Text("Your $amount $category has been recorded. The finance team will confirm it shortly.", style = Type.Body, color = Brand.Text2, textAlign = TextAlign.Center)
        Spacer(Modifier.height(10.dp))
        Text("“Give, and it will be given to you.” Luke 6:38", fontFamily = Scripture, fontSize = 16.sp, color = Brand.GoldLight, textAlign = TextAlign.Center)
        Spacer(Modifier.height(22.dp))
        GhostButton("Give again", onClick = again)
    }
}

@Composable
private fun HistoryRow(g: Gift) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var receiptError by remember { mutableStateOf<String?>(null) }
    val (label, color, icon) = when (g.status) {
        "success" -> Triple("Received", Color(0xFF4ADE80), Icons.Rounded.CheckCircle)
        "awaiting_verification", "pending" -> Triple("Awaiting confirmation", Brand.GoldLight, Icons.Rounded.HourglassTop)
        else -> Triple("Not found — contact finance", Color(0xFFFF8A80), Icons.Rounded.HourglassTop)
    }
    val via = when (g.method) { "mpesa_paybill", "mpesa" -> "M-Pesa"; "airtel_paybill" -> "Airtel Money"; "bank" -> "Bank"; else -> g.method }
    Row(Modifier.fillMaxWidth().glass(RoundedCornerShape(16.dp), 0.6f).padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, null, tint = color, modifier = Modifier.size(22.dp))
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text("${money(g.amount)} · ${g.category}", fontFamily = Inter, fontWeight = FontWeight.SemiBold, color = Brand.White)
            val date = runCatching { OffsetDateTime.parse(g.createdAt).format(DateTimeFormatter.ofPattern("d MMM yyyy")) }.getOrDefault("")
            Text(listOf(via, g.providerReference, date).filter { it.isNotBlank() }.joinToString(" · "), style = Type.Meta, color = Brand.Text2)
            Text(label, color = color, fontSize = 12.5.sp, fontWeight = FontWeight.SemiBold)
            ErrorNote(receiptError)
        }
        if (g.status == "success") {
            Text("Receipt", color = Brand.BlueText, fontSize = 13.sp, modifier = Modifier.clickable {
                scope.launch {
                    runCatching { com.shekinahsons.globalapp.data.Documents.openReceipt(context, g.id) }.onFailure { receiptError = it.message }
                }
            }.padding(6.dp))
        }
    }
}

@Composable
private fun BookPending(purchase: Purchase, done: () -> Unit) {
    Column(Modifier.fillMaxWidth().padding(top = 20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(96.dp).lifted(CircleShape, 22.dp, Brand.Gold).clip(CircleShape).background(Brand.GoldGradient), contentAlignment = Alignment.Center) {
            Icon(Icons.Rounded.HourglassTop, null, tint = Brand.Black, modifier = Modifier.size(50.dp))
        }
        Spacer(Modifier.height(18.dp))
        Text("Payment received", style = Type.Display, color = Brand.White)
        Spacer(Modifier.height(6.dp))
        Text("\u201C${purchase.title}\u201D ${purchase.after}",
            style = Type.Body, color = Brand.Text2, textAlign = TextAlign.Center)
        Spacer(Modifier.height(22.dp))
        GoldButton(purchase.back, onClick = done)
    }
}
