package com.shekinahsons.globalapp.ui.screens

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.CreditCard
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.PhoneAndroid
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.data.ApiException
import com.shekinahsons.globalapp.data.Api
import com.shekinahsons.globalapp.data.Session
import com.shekinahsons.globalapp.ui.components.*
import com.shekinahsons.globalapp.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import java.util.UUID

@Serializable private data class GatewayTransaction(
    val id: String = "",
    val status: String = "",
    val checkoutUrl: String = "",
    val amount: Int = 0,
    val message: String = "",
    val resultDescription: String = ""
)

@Composable internal fun GatewayPayments(session: Session, details: GivingDetails, purchase: Purchase?, onSettled: () -> Unit) {
    key(session.member?.id, purchase?.itemId) { GatewayPaymentForm(session, details, purchase, onSettled) }
}

@Composable private fun GatewayPaymentForm(session: Session, details: GivingDetails, purchase: Purchase?, onSettled: () -> Unit) {
    val context = LocalContext.current
    val account = session.member?.id.orEmpty()
    val prefs = remember(account) { context.getSharedPreferences("gateway-$account", Context.MODE_PRIVATE) }
    val slot = remember(account, purchase?.itemId) { "payment-${purchase?.itemId ?: "giving"}" }
    var method by remember { mutableStateOf(prefs.getString("$slot-method", null) ?: if (details.mpesaPrompt) "mpesa" else "card") }
    var amount by remember { mutableStateOf(prefs.getString("$slot-amount", null) ?: purchase?.price?.toString() ?: "") }
    var category by remember { mutableStateOf(prefs.getString("$slot-category", null) ?: purchase?.kind ?: details.categories.firstOrNull() ?: "Offering") }
    var phone by remember { mutableStateOf(prefs.getString("$slot-phone", null).orEmpty()) }
    var email by remember { mutableStateOf(prefs.getString("$slot-email", null) ?: session.member?.email.orEmpty()) }
    var transaction by remember(slot) { mutableStateOf<GatewayTransaction?>(null) }
    var requestID by remember(slot) { mutableStateOf(prefs.getString("$slot-request", null).orEmpty()) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var checking by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    suspend fun check(id: String) {
        transaction = Api.decode(Api.get("/giving/transactions/$id")["transaction"])
    }

    LaunchedEffect(slot) {
        prefs.getString(slot, null)?.let { id -> runCatching { check(id) }.onFailure { error = it.message } }
    }

    LaunchedEffect(transaction?.id, transaction?.status) {
        val id = transaction?.id ?: return@LaunchedEffect
        if (transaction?.status == "pending") {
            repeat(24) {
                delay(5000)
                runCatching { check(id) }
                if (transaction?.status != "pending") return@LaunchedEffect
            }
        } else if (transaction?.status == "success") {
            prefs.edit().remove(slot).remove("$slot-request").remove("$slot-method").remove("$slot-amount").remove("$slot-category").remove("$slot-phone").remove("$slot-email").apply()
            onSettled()
        }
    }

    val shape = RoundedCornerShape(22.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .lifted(shape, 18.dp)
            .clip(shape)
            .background(Color(0xFF111114))
            .border(1.dp, Brush.linearGradient(listOf(Color(0x33D4AF37), Color(0x11FFFFFF))), shape)
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(34.dp).clip(CircleShape).background(Color(0x22D4AF37)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Rounded.Lock, "Secure", tint = Brand.Gold, modifier = Modifier.size(18.dp))
            }
            Spacer(Modifier.width(10.dp))
            Column {
                Text("EXPRESS GIVING", style = Type.Label, color = Brand.Gold)
                Text(if (purchase != null) purchase.title else "Direct Church Giving", style = Type.CardTitle, color = Brand.White)
            }
        }

        if (account.isBlank()) {
            Text("Please sign in to give seamlessly via M-Pesa STK push or Card.", style = Type.Body, color = Brand.Text2)
        } else {
            val tx = transaction
            if (tx == null) {
                if (details.mpesaPrompt && details.cards) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        // M-Pesa Card
                        val isMpesa = method == "mpesa"
                        val mpesaShape = RoundedCornerShape(16.dp)
                        Box(
                            Modifier
                                .weight(1f)
                                .clip(mpesaShape)
                                .background(if (isMpesa) Color(0xFF132216) else Color(0xFF18181C))
                                .border(
                                    if (isMpesa) 1.5.dp else 1.dp,
                                    if (isMpesa) Color(0xFF3FB64A) else Color(0x22FFFFFF),
                                    mpesaShape
                                )
                                .clickable { if (requestID.isBlank()) method = "mpesa" }
                                .padding(12.dp)
                        ) {
                            Column {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        Modifier.size(24.dp).clip(CircleShape).background(Color(0xFF3FB64A)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(Icons.Rounded.PhoneAndroid, null, tint = Color.White, modifier = Modifier.size(15.dp))
                                    }
                                    Spacer(Modifier.weight(1f))
                                    if (isMpesa) {
                                        Icon(Icons.Rounded.CheckCircle, null, tint = Color(0xFF3FB64A), modifier = Modifier.size(18.dp))
                                    }
                                }
                                Spacer(Modifier.height(8.dp))
                                Text("M-Pesa STK", fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Color.White)
                                Text("Instant PIN Prompt", fontSize = 11.sp, color = Color(0xFF70C97A))
                            }
                        }

                        // Card Checkout
                        val isCard = method == "card"
                        val cardShape = RoundedCornerShape(16.dp)
                        Box(
                            Modifier
                                .weight(1f)
                                .clip(cardShape)
                                .background(if (isCard) Color(0xFF221E12) else Color(0xFF18181C))
                                .border(
                                    if (isCard) 1.5.dp else 1.dp,
                                    if (isCard) Brand.Gold else Color(0x22FFFFFF),
                                    cardShape
                                )
                                .clickable { if (requestID.isBlank()) method = "card" }
                                .padding(12.dp)
                        ) {
                            Column {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(
                                        Modifier.size(24.dp).clip(CircleShape).background(Color(0xFF2870D3)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Icon(Icons.Rounded.CreditCard, null, tint = Color.White, modifier = Modifier.size(15.dp))
                                    }
                                    Spacer(Modifier.weight(1f))
                                    if (isCard) {
                                        Icon(Icons.Rounded.CheckCircle, null, tint = Brand.Gold, modifier = Modifier.size(18.dp))
                                    }
                                }
                                Spacer(Modifier.height(8.dp))
                                Text("Card Pay", fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Color.White)
                                Text("Visa / Mastercard", fontSize = 11.sp, color = Brand.GoldLight)
                            }
                        }
                    }
                }

                if (purchase != null) {
                    Row(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Color(0x22FFFFFF)).padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(purchase.title, style = Type.CardTitle, color = Brand.White, modifier = Modifier.weight(1f))
                        Text("KSh ${"%,d".format(purchase.price)}", style = Type.Title, color = Brand.GoldLight)
                    }
                } else {
                    Field("AMOUNT · KSH", amount, { if (requestID.isBlank()) amount = it.filter(Char::isDigit).take(7) }, keyboard = KeyboardType.Number)
                    // Quick amount chips
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        val presets = listOf("200", "500", "1000", "2000", "5000")
                        items(presets) { p ->
                            val selected = amount == p
                            Box(
                                Modifier
                                    .clip(RoundedCornerShape(50))
                                    .background(if (selected) Brand.GoldGradient else Brush.linearGradient(listOf(Color(0x22FFFFFF), Color(0x11FFFFFF))))
                                    .clickable { if (requestID.isBlank()) amount = p }
                                    .padding(horizontal = 14.dp, vertical = 7.dp)
                            ) {
                                Text(
                                    "KSh ${"%,d".format(p.toInt())}",
                                    fontSize = 12.sp,
                                    fontFamily = Inter,
                                    fontWeight = FontWeight.SemiBold,
                                    color = if (selected) Brand.Black else Color.White
                                )
                            }
                        }
                    }
                    Field("GIVING TOWARDS", category, { if (requestID.isBlank()) category = it })
                }

                Field("M-PESA / PHONE NUMBER", phone, { if (requestID.isBlank()) phone = it }, keyboard = KeyboardType.Phone, hint = "07XX XXX XXX")
                if (method == "card") {
                    Field("EMAIL ADDRESS", email, { if (requestID.isBlank()) email = it }, keyboard = KeyboardType.Email)
                }

                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 2.dp)) {
                    Icon(
                        if (method == "mpesa") Icons.Rounded.PhoneAndroid else Icons.Rounded.Lock,
                        null,
                        tint = Brand.Muted,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        if (method == "mpesa")
                            "An official M-Pesa PIN prompt will appear automatically on your phone."
                        else
                            "Opens the bank processor's encrypted checkout page. No card data touches church servers.",
                        style = Type.Meta,
                        color = Brand.Muted
                    )
                }

                GoldButton(
                    if (busy) "Sending prompt…" else if (requestID.isNotBlank()) "Retry payment prompt" else if (method == "mpesa") "Send M-Pesa Prompt" else "Proceed to Card Checkout",
                    enabled = !busy && (amount.toIntOrNull() ?: 0) > 0 && phone.isNotBlank()
                ) {
                    busy = true
                    error = null
                    if (requestID.isBlank()) {
                        requestID = UUID.randomUUID().toString()
                        prefs.edit().putString("$slot-request", requestID).putString("$slot-method", method).putString("$slot-amount", amount).putString("$slot-category", category).putString("$slot-phone", phone).putString("$slot-email", email).apply()
                    }
                    scope.launch {
                        runCatching {
                            val result = Api.post(
                                if (method == "mpesa") "/giving/mpesa/stk-push" else "/giving/card/checkout",
                                mapOf(
                                    "requestId" to requestID,
                                    "itemId" to purchase?.itemId.orEmpty(),
                                    "amount" to (amount.toIntOrNull() ?: 0),
                                    "category" to category,
                                    "phone" to phone,
                                    "email" to email,
                                    "name" to session.member?.name.orEmpty()
                                )
                            )
                            transaction = Api.decode(result["transaction"])
                            prefs.edit().putString(slot, transaction!!.id).apply()
                        }.onFailure {
                            error = it.message
                            if (it is ApiException && it.status == 400) {
                                requestID = ""
                                prefs.edit().remove("$slot-request").apply()
                            }
                        }
                        busy = false
                    }
                }
            } else {
                // A transaction is in progress or completed
                val status = tx.status
                val isSuccess = status == "success"
                val isFailed = status == "failed"
                val isPending = status == "pending"

                Column(
                    Modifier.fillMaxWidth().padding(vertical = 12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    if (isPending) {
                        CircularProgressIndicator(color = Brand.Gold, strokeWidth = 3.dp, modifier = Modifier.size(52.dp))
                        Spacer(Modifier.height(14.dp))
                        Text("Prompt Sent to Phone", style = Type.Title, color = Brand.White, textAlign = TextAlign.Center)
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "Please check your phone screen and enter your M-Pesa PIN to complete payment of KSh ${"%,d".format(tx.amount)}.",
                            style = Type.Body,
                            color = Brand.Text2,
                            textAlign = TextAlign.Center
                        )
                    } else if (isSuccess) {
                        Box(Modifier.size(54.dp).clip(CircleShape).background(Color(0xFF3FB64A)), contentAlignment = Alignment.Center) {
                            Icon(Icons.Rounded.CheckCircle, null, tint = Color.White, modifier = Modifier.size(34.dp))
                        }
                        Spacer(Modifier.height(14.dp))
                        Text("Payment Received!", style = Type.Title, color = Brand.Gold, textAlign = TextAlign.Center)
                        Spacer(Modifier.height(6.dp))
                        Text("Thank you for your generous seed into Shekinah Sons Global ministry.", style = Type.Body, color = Brand.White, textAlign = TextAlign.Center)
                    } else {
                        Text("Payment Not Completed", style = Type.Title, color = Brand.Red, textAlign = TextAlign.Center)
                        Spacer(Modifier.height(6.dp))
                        Text(tx.resultDescription.ifBlank { "The transaction timed out or was cancelled." }, style = Type.Body, color = Brand.Text2, textAlign = TextAlign.Center)
                    }

                    Spacer(Modifier.height(18.dp))
                    if (tx.checkoutUrl.isNotBlank() && isPending) {
                        GoldButton("Open Secure Checkout") {
                            runCatching {
                                val uri = Uri.parse(tx.checkoutUrl)
                                check(uri.scheme == "https" && uri.host != null) { "Invalid checkout address" }
                                context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                            }.onFailure { error = it.message }
                        }
                        Spacer(Modifier.height(10.dp))
                    }
                    if (isPending) {
                        GhostButton(if (checking) "Checking confirmation…" else "Refresh payment status") {
                            if (!checking) {
                                checking = true
                                scope.launch {
                                    runCatching { check(tx.id) }.onFailure { error = it.message }
                                    checking = false
                                }
                            }
                        }
                    }
                    if (isFailed || isSuccess) {
                        GhostButton("Start another gift") {
                            prefs.edit().remove(slot).remove("$slot-request").remove("$slot-method").remove("$slot-amount").remove("$slot-category").remove("$slot-phone").remove("$slot-email").apply()
                            requestID = ""
                            transaction = null
                        }
                    }
                }
            }
            ErrorNote(error)
        }
    }
    Spacer(Modifier.height(16.dp))
}
