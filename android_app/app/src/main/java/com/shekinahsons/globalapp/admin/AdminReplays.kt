package com.shekinahsons.globalapp.admin

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.data.Api
import com.shekinahsons.globalapp.ui.components.*
import com.shekinahsons.globalapp.ui.theme.*
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.jsonPrimitive

@Serializable
data class AdminReplay(val id: String = "", val title: String = "", val description: String = "", val date: String? = null, val status: String = "",
    val thumbnailUrl: String = "", val customCover: Boolean = false, val seconds: Int = 0)

private fun length(s: Int) = if (s >= 3600) "%d:%02d:%02d".format(s / 3600, s / 60 % 60, s % 60) else "%d:%02d".format(s / 60, s % 60)

// Recorded live services: they appear in Sermons automatically. Staff can
// rename them, add a description, change or reset the cover, or delete them.
@Composable
fun AdminReplaysPane() {
    var items by remember { mutableStateOf(emptyList<AdminReplay>()) }
    var editing by remember { mutableStateOf<AdminReplay?>(null) }
    var tick by remember { mutableIntStateOf(0) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(tick) {
        runCatching { Api.decode<List<AdminReplay>>(Api.get("/admin/replays")["items"]) }.onSuccess { items = it; error = null }.onFailure { error = it.message }
    }
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("SERVICE RECORDINGS", style = Type.Label, color = Brand.Gold, modifier = Modifier.padding(top = 10.dp))
        ErrorNote(error)
        val current = editing
        if (current != null) ReplayEditor(current, onClose = { editing = null; tick++ })
        else if (items.isEmpty()) Text("Recordings of live services show here once a broadcast ends.", style = Type.Meta, color = Brand.Text2)
        else items.forEach { r ->
            Row(Modifier.fillMaxWidth().glass(RoundedCornerShape(18.dp), 0.85f).clickable { editing = r }.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                FadeImage(r.thumbnailUrl, Modifier.width(120.dp).aspectRatio(16 / 9f).clip(RoundedCornerShape(12.dp)), label = "REPLAY")
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(r.title, style = Type.CardTitle, color = Brand.White, maxLines = 2)
                    Text(listOfNotNull(r.date?.take(10), if (r.seconds > 0) length(r.seconds) else null, if (r.status != "ready") r.status else null).joinToString(" · "), style = Type.Meta, color = Brand.Text2)
                    Text("Edit or delete", style = Type.Meta, color = Brand.Gold)
                }
            }
        }
    }
}

@Composable
private fun ReplayEditor(r: AdminReplay, onClose: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var title by remember(r.id) { mutableStateOf(r.title) }
    var description by remember(r.id) { mutableStateOf(r.description) }
    var cover by remember(r.id) { mutableStateOf(r.thumbnailUrl) }
    var custom by remember(r.id) { mutableStateOf(r.customCover) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var note by remember { mutableStateOf<String?>(null) }
    var confirm by remember { mutableStateOf(false) }
    fun save(body: Map<String, Any?>) = scope.launch {
        busy = true; error = null; note = null
        runCatching { Api.patch("/admin/replays/${r.id}", body) }.onSuccess {
            cover = it["thumbnailUrl"]?.jsonPrimitive?.content.orEmpty(); custom = it["customCover"]?.jsonPrimitive?.content == "true"
            note = it["message"]?.jsonPrimitive?.content
        }.onFailure { error = it.message }
        busy = false
    }
    val pick = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri: Uri? ->
        if (uri != null) scope.launch {
            busy = true; error = null
            runCatching { uploadImage(context, uri) }.onSuccess { url -> busy = false; save(mapOf("thumbnailUrl" to url)) }.onFailure { error = it.message; busy = false }
        }
    }
    Column(Modifier.fillMaxWidth().glass(RoundedCornerShape(20.dp), 0.85f).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("← All recordings", color = Brand.GoldLight, modifier = Modifier.clickable(onClick = onClose).padding(vertical = 4.dp))
        FadeImage(cover, Modifier.fillMaxWidth().aspectRatio(16 / 9f).clip(RoundedCornerShape(16.dp)), label = "REPLAY")
        Text(if (custom) "Your own cover" else "Automatic Shekinah cover (redrawn when you change the title)", style = Type.Meta, color = Brand.Text2)
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            GhostButton("Change cover", Modifier.weight(1f)) { pick.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }
            if (custom) GhostButton("Use Shekinah cover", Modifier.weight(1f)) { save(mapOf("resetCover" to true)) }
        }
        Field("TITLE", title, { title = it.take(160) })
        Field("DESCRIPTION", description, { description = it.take(4000) }, minHeight = 100.dp, singleLine = false)
        ErrorNote(error)
        note?.let { Text(it, color = Color(0xFF4ADE80), fontSize = 13.sp) }
        GoldButton("Save", busy = busy, enabled = title.isNotBlank()) { save(mapOf("title" to title.trim(), "description" to description.trim())) }
        Text("Delete recording", color = Brand.Red, fontWeight = FontWeight.SemiBold, modifier = Modifier.align(Alignment.CenterHorizontally).clickable { confirm = true }.padding(8.dp))
    }
    if (confirm) AlertDialog(
        onDismissRequest = { confirm = false }, containerColor = Color(0xFF1C1C20),
        title = { Text("Delete this recording?", color = Brand.White) },
        text = { Text("\"${r.title}\" is removed from Sermons and its video files are deleted. This can't be undone.", color = Brand.Text2) },
        confirmButton = { TextButton({
            confirm = false
            scope.launch { runCatching { Api.delete("/admin/replays/${r.id}") }.onSuccess { onClose() }.onFailure { error = it.message } }
        }) { Text("Delete", color = Brand.Red) } },
        dismissButton = { TextButton({ confirm = false }) { Text("Keep it", color = Brand.Text2) } },
    )
}
