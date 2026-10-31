package com.shekinahsons.globalapp.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.R
import com.shekinahsons.globalapp.data.Session
import com.shekinahsons.globalapp.ui.components.Avatar
import com.shekinahsons.globalapp.ui.components.ErrorNote
import com.shekinahsons.globalapp.ui.components.Field
import com.shekinahsons.globalapp.ui.components.GhostButton
import com.shekinahsons.globalapp.ui.components.GoldButton
import com.shekinahsons.globalapp.ui.components.glass
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Cinzel
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Type
import kotlinx.coroutines.launch
import java.time.OffsetDateTime
import java.time.format.DateTimeFormatter

private enum class Mode { SignIn, Register, Forgot, Reset }

// Profile: signed out it is the doorway (sign in, create account, reset a
// password); signed in it shows the member and their account options.
@Composable
fun AccountPage(session: Session, onDone: (() -> Unit)? = null) {
    val member = session.member
    if (member == null) { SignInFlow(session, onDone); return }
    var changing by remember(member.passwordResetRequired) { mutableStateOf(member.passwordResetRequired) }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding().padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.padding(top = 8.dp).size(108.dp).clip(CircleShape).border(2.dp, Brand.GoldGradient, CircleShape).padding(6.dp), contentAlignment = Alignment.Center) {
            Avatar(member.name, member.id, 96.dp)
        }
        Spacer(Modifier.height(14.dp))
        Text(member.name, style = Type.Display, color = Brand.White, textAlign = TextAlign.Center)
        Text(member.email, style = Type.Meta.copy(fontSize = 14.sp), color = Brand.Text2)
        val since = runCatching { OffsetDateTime.parse(member.createdAt).format(DateTimeFormatter.ofPattern("MMMM yyyy")) }.getOrNull()
        if (since != null) {
            Spacer(Modifier.height(10.dp))
            Text("Member since $since", color = Brand.GoldLight, fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 13.sp,
                modifier = Modifier.glass().padding(horizontal = 14.dp, vertical = 6.dp))
        }
        Spacer(Modifier.height(28.dp))
        var resetting by remember { mutableStateOf(false) }
        when {
            resetting -> ResetByEmail(session, member.email) { resetting = false }
            changing -> {
                ChangePassword(session) { changing = false }
                Text("I forgot my current password \u2013 email me a code", color = Brand.BlueText, fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 13.5.sp,
                    modifier = Modifier.padding(top = 12.dp).clickable { changing = false; resetting = true }.padding(6.dp))
            }
            else -> GhostButton("Change password") { changing = true }
        }
        Spacer(Modifier.height(12.dp))
        GhostButton("Sign out") { session.signOut() }
        Spacer(Modifier.height(18.dp))
        Text("Your name is shown with everything you share in the app, like chat messages, prayer requests and testimonies.",
            style = Type.Meta, color = Brand.Muted, textAlign = TextAlign.Center)
    }
}

// Reset while signed in, when the current password is forgotten: a code is
// emailed to the member's address.
@Composable
private fun ResetByEmail(session: Session, email: String, done: () -> Unit) {
    val scope = rememberCoroutineScope()
    var sent by remember { mutableStateOf(false) }
    var code by remember { mutableStateOf("") }
    var next by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var info by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    fun send() = scope.launch {
        busy = true; error = null
        runCatching { session.requestReset(email) }.onSuccess { sent = true; info = "We emailed a 6-digit code to $email. It expires in 15 minutes." }.onFailure { error = it.message }
        busy = false
    }
    Column(Modifier.fillMaxWidth()) {
        Text("Reset your password", style = Type.Title, color = Brand.White)
        Spacer(Modifier.height(6.dp))
        if (!sent) {
            Text("We'll email a code to $email.", style = Type.Meta, color = Brand.Text2)
            ErrorNote(error)
            Spacer(Modifier.height(14.dp))
            GoldButton("Email me a code", busy = busy) { send() }
        } else {
            info?.let { Text(it, style = Type.Meta, color = Brand.Text2) }
            Spacer(Modifier.height(12.dp))
            Field("CODE", code, { code = it.filter(Char::isDigit).take(6) }, keyboard = KeyboardType.Number)
            Spacer(Modifier.height(12.dp))
            Field("NEW PASSWORD", next, { next = it }, hint = "At least 8 characters", password = true)
            ErrorNote(error)
            Spacer(Modifier.height(14.dp))
            GoldButton("Save new password", busy = busy, enabled = code.length == 6 && next.length >= 8) {
                scope.launch {
                    busy = true; error = null
                    runCatching { session.confirmReset(email, code, next); session.signIn(email, next) }.onSuccess { done() }.onFailure { error = it.message }
                    busy = false
                }
            }
            Text("Send the code again", color = Brand.BlueText, fontSize = 13.5.sp, modifier = Modifier.padding(top = 10.dp).clickable { send() }.padding(6.dp))
        }
        Spacer(Modifier.height(8.dp))
        GhostButton("Cancel", onClick = done)
    }
}

@Composable
private fun ChangePassword(session: Session, done: () -> Unit) {
    val scope = rememberCoroutineScope()
    var current by remember { mutableStateOf("") }
    var next by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    Column(Modifier.fillMaxWidth()) {
        Field("CURRENT PASSWORD", current, { current = it }, password = true)
        Spacer(Modifier.height(12.dp))
        Field("NEW PASSWORD", next, { next = it }, hint = "At least 8 characters", password = true)
        ErrorNote(error)
        Spacer(Modifier.height(14.dp))
        GoldButton("Save new password", busy = busy, enabled = current.isNotBlank() && next.length >= 8) {
            scope.launch {
                busy = true; error = null
                runCatching { session.changePassword(current, next) }.onSuccess { done() }.onFailure { error = it.message }
                busy = false
            }
        }
    }
}

@Composable
private fun SignInFlow(session: Session, onDone: (() -> Unit)?) {
    val scope = rememberCoroutineScope()
    var mode by remember { mutableStateOf(Mode.SignIn) }
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var info by remember { mutableStateOf<String?>(null) }

    fun run(block: suspend () -> Unit) = scope.launch {
        busy = true; error = null
        runCatching { block() }.onFailure { error = it.message }
        busy = false
    }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).imePadding().padding(horizontal = 22.dp, vertical = 12.dp)) {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            Image(painterResource(R.drawable.dove_mark), null, Modifier.size(78.dp))
            Spacer(Modifier.height(8.dp))
            Text("SHEKINAH", fontFamily = Cinzel, fontSize = 24.sp, color = Brand.Gold, letterSpacing = 3.sp)
            Text("SONS GLOBAL", fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 10.sp, color = Brand.Text2, letterSpacing = 4.sp)
        }
        Spacer(Modifier.height(24.dp))
        if (mode == Mode.SignIn || mode == Mode.Register) {
            Row(Modifier.fillMaxWidth().glass(com.shekinahsons.globalapp.ui.components.GlassShape, 0.8f).padding(4.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                listOf(Mode.SignIn to "Sign in", Mode.Register to "Create account").forEach { (m, label) ->
                    val on = mode == m
                    Box(
                        Modifier.weight(1f).height(42.dp).clip(RoundedCornerShape(50)).background(if (on) Brand.GoldGradient else Brush.linearGradient(listOf(Color.Transparent, Color.Transparent)))
                            .clickable { mode = m; error = null },
                        contentAlignment = Alignment.Center,
                    ) { Text(label, color = if (on) Brand.Black else Brand.Text2, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 14.5.sp) }
                }
            }
            Spacer(Modifier.height(20.dp))
        }
        AnimatedContent(mode, transitionSpec = { fadeIn() togetherWith fadeOut() }, label = "mode") { m ->
            Column(Modifier.fillMaxWidth()) {
                when (m) {
                    Mode.SignIn -> {
                        Field("EMAIL", email, { email = it }, hint = "you@example.com", keyboard = KeyboardType.Email)
                        Spacer(Modifier.height(12.dp))
                        Field("PASSWORD", password, { password = it }, password = true)
                        Text("Forgot password?", color = Brand.BlueText, fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 13.5.sp,
                            modifier = Modifier.align(Alignment.End).padding(top = 10.dp).clickable { mode = Mode.Forgot; error = null })
                        ErrorNote(error)
                        Spacer(Modifier.height(18.dp))
                        GoldButton("Sign in", busy = busy, enabled = email.isNotBlank() && password.isNotBlank()) { run { session.signIn(email, password); onDone?.invoke() } }
                    }
                    Mode.Register -> {
                        Field("FULL NAME", name, { name = it }, hint = "As the church knows you")
                        Spacer(Modifier.height(12.dp))
                        Field("EMAIL", email, { email = it }, hint = "you@example.com", keyboard = KeyboardType.Email)
                        Spacer(Modifier.height(12.dp))
                        Field("PASSWORD", password, { password = it }, hint = "At least 8 characters", password = true)
                        ErrorNote(error)
                        Spacer(Modifier.height(18.dp))
                        GoldButton("Create account", busy = busy, enabled = name.trim().length >= 2 && email.contains("@") && password.length >= 8) {
                            run { session.register(name, email, password); onDone?.invoke() }
                        }
                        Text("Your real name is shown with what you share, so the family knows who is speaking.",
                            style = Type.Meta, color = Brand.Muted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = 12.dp))
                    }
                    Mode.Forgot -> {
                        Text("Reset your password", style = Type.Title, color = Brand.White)
                        Text("Enter your account's email and we'll send you a 6-digit code. Works for members and admins.", style = Type.Meta, color = Brand.Text2)
                        Spacer(Modifier.height(16.dp))
                        Field("EMAIL", email, { email = it }, keyboard = KeyboardType.Email)
                        ErrorNote(error)
                        Spacer(Modifier.height(18.dp))
                        GoldButton("Send code", busy = busy, enabled = email.contains("@")) { run { session.requestReset(email); info = "Code sent to $email"; mode = Mode.Reset } }
                        Spacer(Modifier.height(10.dp))
                        GhostButton("Back to sign in") { mode = Mode.SignIn }
                    }
                    Mode.Reset -> {
                        Text("Enter the code", style = Type.Title, color = Brand.White)
                        info?.let { Text(it, style = Type.Meta, color = Brand.Text2) }
                        Spacer(Modifier.height(16.dp))
                        Field("CODE", code, { code = it }, keyboard = KeyboardType.Number)
                        Spacer(Modifier.height(12.dp))
                        Field("NEW PASSWORD", password, { password = it }, hint = "At least 8 characters", password = true)
                        ErrorNote(error)
                        Spacer(Modifier.height(18.dp))
                        GoldButton("Set password and sign in", busy = busy, enabled = code.isNotBlank() && password.length >= 8) {
                            run { session.confirmReset(email, code, password); session.signIn(email, password); onDone?.invoke() }
                        }
                        Text("Didn't get it? Send the code again", color = Brand.BlueText, fontSize = 13.5.sp,
                            modifier = Modifier.padding(top = 12.dp).clickable { run { session.requestReset(email); info = "A new code was sent to $email" } }.padding(6.dp))
                    }
                }
            }
        }
    }
}
