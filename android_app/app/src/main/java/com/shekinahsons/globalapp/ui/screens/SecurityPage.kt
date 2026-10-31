package com.shekinahsons.globalapp.ui.screens

import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.data.Api
import com.shekinahsons.globalapp.ui.components.*
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Type
import kotlinx.coroutines.launch
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.jsonPrimitive

// Two-step sign-in for the signed-in member: a code from an authenticator app
// after the password. Staff may be required to have it.
@Composable
fun TwoStepPage() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var enabled by remember { mutableStateOf<Boolean?>(null) }
    var required by remember { mutableStateOf(false) }
    var secret by remember { mutableStateOf("") }
    var uri by remember { mutableStateOf("") }
    var qr by remember { mutableStateOf<androidx.compose.ui.graphics.ImageBitmap?>(null) }
    var code by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var note by remember { mutableStateOf<String?>(null) }
    suspend fun load() {
        val s = Api.get("/auth/mfa")
        enabled = s["enabled"]?.jsonPrimitive?.booleanOrNull == true
        required = s["required"]?.jsonPrimitive?.booleanOrNull == true
    }
    LaunchedEffect(Unit) { runCatching { load() }.onFailure { error = it.message } }
    fun act(block: suspend () -> Unit) = scope.launch { busy = true; error = null; note = null; runCatching { block() }.onFailure { error = it.message }; busy = false }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Two-step sign-in", style = Type.Display, color = Brand.White)
        Text("After your password you also type a code from an authenticator app (Google Authenticator, Microsoft Authenticator or Authy). Someone who learns your password still cannot get in.",
            style = Type.Body, color = Brand.Text2)
        if (required && enabled == false) Text("The church requires two-step sign-in for staff. Turn it on to use the staff tools.", style = Type.Body, color = Brand.GoldLight)
        ErrorNote(error)
        note?.let { Text(it, color = Color(0xFF4ADE80), style = Type.Body) }
        when {
            enabled == null -> {}
            enabled == true -> {
                Text("● On: your account asks for a code at every sign-in.", color = Color(0xFF4ADE80), style = Type.Body)
                if (!required) {
                    Field("CODE TO TURN IT OFF", code, { code = it.filter(Char::isDigit).take(6) }, keyboard = KeyboardType.NumberPassword)
                    GhostButton("Turn off", Modifier.fillMaxWidth()) {
                        if (!busy && code.length == 6) act { note = Api.post("/auth/mfa/disable", mapOf("code" to code))["message"]?.jsonPrimitive?.content; code = ""; load() }
                    }
                }
            }
            secret.isNotBlank() -> {
                Text("1. Add an account in your authenticator app: tap below if the app is on this phone, or scan the code from another phone.", style = Type.Body, color = Brand.White)
                GoldButton("Open authenticator app") {
                    runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(uri))) }.onFailure { error = "No authenticator app found. Install Google Authenticator, then try again." }
                }
                qr?.let { Image(it, "QR code for your authenticator app", Modifier.align(Alignment.CenterHorizontally).size(220.dp).clip(RoundedCornerShape(16.dp)).background(Color.White).padding(8.dp)) }
                Text("Setup key: " + secret.chunked(4).joinToString(" "), style = Type.Meta, color = Brand.Text2)
                Text("2. Type the 6-digit code the app shows.", style = Type.Body, color = Brand.White)
                Field("CODE", code, { code = it.filter(Char::isDigit).take(6) }, keyboard = KeyboardType.NumberPassword)
                GoldButton(if (busy) "Checking…" else "Turn on", busy = busy, enabled = code.length == 6) {
                    act { note = Api.post("/auth/mfa/enable", mapOf("code" to code))["message"]?.jsonPrimitive?.content; code = ""; secret = ""; load() }
                }
            }
            else -> GoldButton("Set up two-step sign-in", busy = busy) {
                act {
                    val r = Api.post("/auth/mfa/setup", emptyMap<String, String>())
                    secret = r["secret"]?.jsonPrimitive?.content.orEmpty()
                    uri = r["otpauthUrl"]?.jsonPrimitive?.content.orEmpty()
                    qr = r["qrPng"]?.jsonPrimitive?.content?.substringAfter(",")?.let { b64 ->
                        val bytes = Base64.decode(b64, Base64.DEFAULT)
                        BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap()
                    }
                }
            }
        }
        Spacer(Modifier.height(40.dp))
    }
}
