package com.shekinahsons.globalapp.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.R
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Type

// Frosted input with a small label above it.
@Composable
fun Field(
    label: String,
    value: String,
    onChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    hint: String = "",
    password: Boolean = false,
    keyboard: KeyboardType = KeyboardType.Text,
    minHeight: Dp = 52.dp,
    singleLine: Boolean = true,
) {
    Column(modifier.fillMaxWidth()) {
        Text(label, style = Type.Label.copy(fontSize = 10.5.sp), color = Brand.GoldLight, modifier = Modifier.padding(start = 4.dp, bottom = 6.dp))
        Box(Modifier.fillMaxWidth().heightIn(min = minHeight).glass(RoundedCornerShape(16.dp), 0.8f).padding(horizontal = 16.dp, vertical = 14.dp)) {
            if (value.isEmpty()) Text(hint, style = Type.Body, color = Brand.Muted)
            BasicTextField(
                value, onChange,
                singleLine = singleLine,
                textStyle = Type.Body.copy(color = Brand.White),
                cursorBrush = SolidColor(Brand.Gold),
                visualTransformation = if (password) PasswordVisualTransformation() else VisualTransformation.None,
                keyboardOptions = KeyboardOptions(keyboardType = if (password) KeyboardType.Password else keyboard),
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
fun GoldButton(label: String, modifier: Modifier = Modifier, busy: Boolean = false, enabled: Boolean = true, onClick: () -> Unit) {
    Box(
        modifier.fillMaxWidth().height(54.dp).lifted(RoundedCornerShape(50), 14.dp, Brand.Gold.copy(alpha = 0.5f)).clip(RoundedCornerShape(50))
            .background(if (enabled) Brand.GoldGradient else SolidColor(Color(0x33D4AF37)))
            .clickable(enabled = enabled && !busy, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        if (busy) CircularProgressIndicator(color = Brand.Black, strokeWidth = 2.dp, modifier = Modifier.size(22.dp))
        else Text(label, color = if (enabled) Brand.Black else Brand.Muted, fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = 16.sp)
    }
}

@Composable
fun GhostButton(label: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Box(modifier.fillMaxWidth().height(50.dp).glass().clickable(onClick = onClick), contentAlignment = Alignment.Center) {
        Text(label, color = Brand.White, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
    }
}

@Composable
fun ErrorNote(message: String?) {
    if (message.isNullOrBlank()) return
    Text(
        message, color = Color(0xFFFFB4AE), style = Type.Meta.copy(fontSize = 13.5.sp),
        modifier = Modifier.fillMaxWidth().padding(top = 10.dp).clip(RoundedCornerShape(12.dp)).background(Color(0x22E53935)).padding(12.dp),
    )
}

// Shown where a feature needs a member account.
@Composable
fun SignInCard(reason: String, onSignIn: () -> Unit, modifier: Modifier = Modifier) {
    Column(
        modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp))
            .background(Brush.linearGradient(listOf(Color(0xFF261E0C), Color(0xFF111216))))
            .border(1.dp, Color(0x40D4AF37), RoundedCornerShape(22.dp)).padding(22.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Image(painterResource(R.drawable.dove_mark), null, Modifier.size(54.dp))
        Spacer(Modifier.height(12.dp))
        Text("Join the family", style = Type.Title, color = Brand.White)
        Spacer(Modifier.height(6.dp))
        Text(reason, style = Type.Body.copy(fontSize = 14.5.sp, lineHeight = 21.sp), color = Brand.Text2, textAlign = TextAlign.Center)
        Spacer(Modifier.height(16.dp))
        GoldButton("Sign in or create account", onClick = onSignIn)
    }
}

// Round initials badge; the colour is stable per person so a chat reads like WhatsApp.
private val avatarColors = listOf(
    Color(0xFFE9B949), Color(0xFF6EA2FF), Color(0xFFEF6C6C), Color(0xFF4FD1A5), Color(0xFFB98CFF),
    Color(0xFFFF9F5A), Color(0xFF5CC8E8), Color(0xFFF07EB5), Color(0xFF9CD86A),
)

fun personColor(key: String): Color = avatarColors[(key.hashCode() and 0x7fffffff) % avatarColors.size]

fun initials(name: String) = name.trim().split(Regex("\\s+")).filter { it.isNotBlank() }.take(2).joinToString("") { it.first().uppercase() }.ifBlank { "?" }

@Composable
fun Avatar(name: String, key: String, size: Dp = 36.dp) {
    val color = personColor(key)
    Box(
        Modifier.size(size).clip(CircleShape).background(Brush.linearGradient(listOf(color, color.copy(alpha = 0.6f)))),
        contentAlignment = Alignment.Center,
    ) {
        Text(initials(name), color = Color(0xFF111111), fontFamily = Inter, fontWeight = FontWeight.Bold, fontSize = (size.value * 0.38f).sp)
    }
}

@Composable
fun ToggleRow(label: String, detail: String, on: Boolean, onToggle: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().clickable { onToggle(!on) }.padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(label, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = Brand.White)
            if (detail.isNotBlank()) Text(detail, style = Type.Meta, color = Brand.Text2)
        }
        Spacer(Modifier.width(12.dp))
        Box(Modifier.width(48.dp).height(28.dp).clip(RoundedCornerShape(50)).background(if (on) Brand.Gold else Color(0x33FFFFFF)).padding(3.dp)) {
            Box(Modifier.size(22.dp).align(if (on) Alignment.CenterEnd else Alignment.CenterStart).clip(CircleShape).background(if (on) Brand.Black else Color(0xFFBDBDBD)))
        }
    }
}
