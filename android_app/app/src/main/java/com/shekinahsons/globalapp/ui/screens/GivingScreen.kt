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
data class GivingDetails(val mpesa: Paybill = Paybill(), val airtel: Paybill = Paybill(), val bank: Bank = Bank(), val note: String = "", val categories: List<String> = emptyList())

@Serializable
data class Gift(
    val id: String = "", val status: String = "", val amount: Int = 0, val category: String = "", val method: String = "",
    val createdAt: String = "", val providerReference: String = "", val payerName: String = "",
)

private enum class Way(val key: String, val title: String, val subtitle: String, val colors: List<Color>, val ink: Color) {
    Mpesa("mpesa_paybill", "M-Pesa", "Lipa na M-PESA · Paybill", listOf(Color(0xFF3FB64A), Color(0xFF167A2B)), Color.White),
    Airtel("airtel_paybill", "Airtel Money", "Pay Bill", listOf(Color(0xFFF2343C), Color(0xFF8E0F18)), Color.White),
    Bank("bank", "Bank transfer", "Deposit or transfer", listOf(Color(0xFFE8C766), Color(0xFF9C7618)), Color(0xFF1A1206)),
}

private enum class Step { Method, Amount, Pay, Confirm, Done }

private fun copy(context: Context, label: String, text: String) {
    context.getSystemService(ClipboardManager::class.java).setPrimaryClip(ClipData.newPlainText(label, text))
}

private fun money(v: Int) = "KSh ${"%,d".format(v)}"

// Giving, one step at a time: pick how, pick how much, follow the payment
// card on your own phone or bank, then confirm with the transaction code.
@Composable
fun GivingPage(session: Session) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val prefs = remember { context.getSharedPreferences("giving", Context.MODE_PRIVATE) }
    var details by remember { mutableStateOf<GivingDetails?>(null) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var step by remember { mutableStateOf(Step.Method) }
    var way by remember { mutableStateOf(Way.Mpesa) }
    var category by remember { mutableStateOf("Tithe") }
    var amount by remember { mutableStateOf("") }
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
            runCatching { history += Api.decode<Gift>(Api.get("/giving/transactions/$id")["transaction"]) }
        }
    }
    BackHandler(enabled = step != Step.Method && step != Step.Done) {
        step = when (step) { Step.Amount -> Step.Method; Step.Pay -> Step.Amount; Step.Confirm -> Step.Pay; else -> Step.Method }
    }

    val d = details
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding().padding(16.dp)) {
        if (step != Step.Done) Stepper(step)
        Spacer(Modifier.height(14.dp))
        when {
            d == null && loadError == null -> Text("Loading…", style = Type.Body, color = Brand.Muted)
            d == null -> ErrorNote(loadError)
            !d.mpesa.enabled && !d.airtel.enabled && !d.bank.enabled -> Text("Giving details will appear here soon.", style = Type.Body, color = Brand.Muted)
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
                            Text("How would you like to give?", style = Type.Title, color = Brand.White)
                            Spacer(Modifier.height(4.dp))
                            Text("“God loves a cheerful giver.” 2 Corinthians 9:7", fontFamily = Scripture, fontSize = 15.sp, color = Brand.GoldLight)
                            Spacer(Modifier.height(16.dp))
                            listOf(Way.Mpesa to d.mpesa.enabled, Way.Airtel to d.airtel.enabled, Way.Bank to d.bank.enabled).filter { it.second }.forEach { (w, _) ->
                                MethodCard(w) { way = w; error = null; step = Step.Amount }
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
                            BackRow("Pay ${money(amount.toIntOrNull() ?: 0)} · $category") { step = Step.Amount }
                            PaymentCard(way, d, amount.toIntOrNull() ?: 0, category)
                            Spacer(Modifier.height(18.dp))
                            Text("Follow these steps", style = Type.CardTitle, color = Brand.White)
                            Spacer(Modifier.height(10.dp))
                            instructions(way, d, amount.toIntOrNull() ?: 0, category).forEachIndexed { i, line -> StepLine(i + 1, line) }
                            Spacer(Modifier.height(20.dp))
                            GoldButton("I've paid — confirm") { step = Step.Confirm; error = null }
                        }
                        Step.Confirm -> {
                            BackRow("Confirm your gift") { step = Step.Pay }
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
                                        val res = Api.post("/giving/confirm", mapOf("method" to way.key, "category" to category, "amount" to (amount.toIntOrNull() ?: 0), "reference" to code, "phone" to phone, "name" to name))
                                        val gift = Api.decode<Gift>(res["transaction"])
                                        prefs.edit().putString("ids", (prefs.getString("ids", "") + "," + gift.id).trim(',')).apply()
                                    }.onSuccess { step = Step.Done; reload++ }.onFailure { error = it.message }
                                    busy = false
                                }
                            }
                        }
                        Step.Done -> ThankYou(money(amount.toIntOrNull() ?: 0), category) {
                            step = Step.Method; amount = ""; code = ""
                        }
                    }
                }
            }
        }
        if (history.isNotEmpty() && (step == Step.Method || step == Step.Done)) {
            Spacer(Modifier.height(26.dp))
            Text("Your giving", style = Type.Title, color = Brand.White)
            Spacer(Modifier.height(10.dp))
            history.forEach { g -> HistoryRow(g); Spacer(Modifier.height(8.dp)) }
        }
        Spacer(Modifier.height(30.dp))
    }
}

@Composable
private fun Stepper(step: Step) {
    val labels = listOf("Method", "Amount", "Pay", "Confirm")
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        labels.forEachIndexed { i, label ->
            val done = i < step.ordinal
            val on = i == step.ordinal
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

@Composable
private fun MethodCard(w: Way, onClick: () -> Unit) {
    val shape = RoundedCornerShape(22.dp)
    Row(
        Modifier.fillMaxWidth().lifted(shape, 14.dp, w.colors.first().copy(alpha = 0.6f)).clip(shape)
            .background(Brush.linearGradient(w.colors)).pressable(onClick).padding(18.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(50.dp).clip(RoundedCornerShape(14.dp)).background(Color(0x33FFFFFF)), contentAlignment = Alignment.Center) {
            Icon(if (w == Way.Bank) Icons.Rounded.AccountBalance else Icons.Rounded.PhoneAndroid, null, tint = w.ink, modifier = Modifier.size(28.dp))
        }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(w.title, color = w.ink, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 19.sp)
            Text(w.subtitle, color = w.ink.copy(alpha = 0.8f), fontSize = 13.sp)
        }
        Icon(Icons.AutoMirrored.Rounded.ArrowForward, null, tint = w.ink)
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

// The payment details as a card you could hold: big numbers, copy buttons.
@Composable
private fun PaymentCard(w: Way, d: GivingDetails, amount: Int, category: String) {
    val context = LocalContext.current
    val shape = RoundedCornerShape(24.dp)
    Box(Modifier.fillMaxWidth().aspectRatio(1.55f).lifted(shape, 22.dp, w.colors.first().copy(alpha = 0.6f)).clip(shape).background(Brush.linearGradient(w.colors))) {
        Image(painterResource(R.drawable.dove_mark), null, Modifier.align(Alignment.BottomEnd).padding(10.dp).size(120.dp).graphicsLayer { alpha = 0.16f })
        Box(Modifier.fillMaxSize().background(Brush.linearGradient(listOf(Color(0x33FFFFFF), Color.Transparent, Color(0x22000000)))))
        Column(Modifier.fillMaxSize().padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(w.title.uppercase(), color = w.ink, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 13.sp, letterSpacing = 1.5.sp, modifier = Modifier.weight(1f))
                Text(money(amount), color = w.ink, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            }
            Spacer(Modifier.weight(1f))
            if (w == Way.Bank) {
                CardField("ACCOUNT NUMBER", d.bank.accountNumber, w) { copy(context, "Account", d.bank.accountNumber) }
                Spacer(Modifier.height(8.dp))
                Text("${d.bank.bankName}${if (d.bank.branch.isNotBlank()) " · ${d.bank.branch}" else ""}", color = w.ink, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                Text(d.bank.accountName, color = w.ink.copy(alpha = 0.85f), fontSize = 13.sp)
            } else {
                val p = if (w == Way.Mpesa) d.mpesa else d.airtel
                Row {
                    Box(Modifier.weight(1f)) { CardField("PAYBILL", p.paybill, w) { copy(context, "Paybill", p.paybill) } }
                    Box(Modifier.weight(1f)) { CardField("ACCOUNT", p.account.ifBlank { category.uppercase() }, w) { copy(context, "Account", p.account.ifBlank { category.uppercase() }) } }
                }
                Spacer(Modifier.height(6.dp))
                Text(p.name.ifBlank { "Shekinah Sons Global" }, color = w.ink.copy(alpha = 0.85f), fontSize = 13.sp)
            }
        }
    }
}

@Composable
private fun CardField(label: String, value: String, w: Way, onCopy: () -> Unit) {
    Column {
        Text(label, color = w.ink.copy(alpha = 0.75f), fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.clickable(onClick = onCopy)) {
            Text(value, color = w.ink, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 24.sp, letterSpacing = 1.sp)
            Spacer(Modifier.width(8.dp))
            Icon(Icons.Rounded.ContentCopy, "Copy $label", tint = w.ink.copy(alpha = 0.8f), modifier = Modifier.size(18.dp))
        }
    }
}

private fun instructions(w: Way, d: GivingDetails, amount: Int, category: String): List<String> = when (w) {
    Way.Mpesa -> listOf(
        "Open M-PESA on your phone (SIM toolkit or the M-PESA app).",
        "Choose Lipa na M-PESA, then Pay Bill.",
        "Business number: ${d.mpesa.paybill}",
        "Account number: ${d.mpesa.account.ifBlank { category.uppercase() }}" + if (d.mpesa.accountHint.isNotBlank()) " (${d.mpesa.accountHint})" else "",
        "Amount: ${money(amount)}",
        "Enter your M-PESA PIN and confirm. You'll get an SMS with a transaction code.",
    )
    Way.Airtel -> listOf(
        "Open Airtel Money on your phone (the Airtel Money menu or the My Airtel app).",
        "Choose Make Payments, then Pay Bill.",
        "Business number: ${d.airtel.paybill}",
        "Account number: ${d.airtel.account.ifBlank { category.uppercase() }}" + if (d.airtel.accountHint.isNotBlank()) " (${d.airtel.accountHint})" else "",
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
private fun StepLine(n: Int, text: String) {
    Row(Modifier.padding(vertical = 6.dp), verticalAlignment = Alignment.Top) {
        Box(Modifier.size(26.dp).clip(CircleShape).background(Color(0x26D4AF37)).border(1.dp, Color(0x66D4AF37), CircleShape), contentAlignment = Alignment.Center) {
            Text("$n", color = Brand.Gold, fontWeight = FontWeight.Bold, fontSize = 12.5.sp)
        }
        Spacer(Modifier.width(12.dp))
        Text(text, style = Type.Body.copy(fontSize = 15.sp, lineHeight = 21.sp), color = Brand.White, modifier = Modifier.padding(top = 2.dp))
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
        }
        if (g.status == "success") {
            Text("Receipt", color = Brand.BlueText, fontSize = 13.sp, modifier = Modifier.clickable {
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("${BuildConfig.API_BASE}/api/v1/giving/transactions/${g.id}/receipt.pdf")))
            }.padding(6.dp))
        }
    }
}
