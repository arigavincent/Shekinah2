package com.shekinahsons.globalapp.admin

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AddCircleOutline
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.KeyboardArrowDown
import androidx.compose.material.icons.rounded.KeyboardArrowUp
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.data.Api
import com.shekinahsons.globalapp.ui.components.*
import com.shekinahsons.globalapp.ui.screens.Playlist
import com.shekinahsons.globalapp.ui.theme.*
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

// Official playlists every member sees in Sermons → Playlists, e.g. a series.
@Composable
fun AdminPlaylistsPane() {
    val scope = rememberCoroutineScope()
    val playlists = remember { mutableStateListOf<Playlist>() }
    var sermons by remember { mutableStateOf(emptyList<JsonObject>()) }
    var editing by remember { mutableStateOf<Playlist?>(null) }
    var name by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    val items = remember { mutableStateListOf<String>() }
    var query by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var deleting by remember { mutableStateOf(false) }
    var tick by remember { mutableIntStateOf(0) }
    LaunchedEffect(tick) {
        runCatching { Api.decode<List<Playlist>>(Api.get("/admin/playlists")["playlists"]) }.onSuccess { playlists.clear(); playlists.addAll(it) }.onFailure { error = it.message }
        runCatching { (Api.get("/admin/sermons")["sermons"] as? JsonArray)?.map { it.jsonObject }.orEmpty() }.onSuccess { sermons = it }
    }
    fun JsonObject.s(k: String) = this[k]?.jsonPrimitive?.content.orEmpty()
    fun begin(p: Playlist) { editing = p; name = p.name; description = p.description; items.clear(); items.addAll(p.items); query = ""; error = null }
    val titles = sermons.associate { it.s("id") to it.s("title") }

    Column(Modifier.fillMaxWidth().glass(RoundedCornerShape(22.dp), 0.9f).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Church playlists", style = Type.Title, color = Brand.White)
        Text("Members see these in Sermons → Playlists, under \"From the church\". Good for a sermon series.", style = Type.Meta, color = Brand.Text2)
        ErrorNote(error)
        val e = editing
        if (e == null) {
            playlists.forEach { p ->
                Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).clickable { begin(p) }.padding(vertical = 8.dp)) {
                    Text(p.name, style = Type.CardTitle, color = Brand.White)
                    Text("${p.items.size} sermons · Edit", style = Type.Meta, color = Brand.Gold)
                }
            }
            GhostButton("+ New church playlist") { begin(Playlist()) }
        } else {
            Field("NAME", name, { name = it.take(80) }, hint = "e.g. Sons of God series")
            Field("DESCRIPTION", description, { description = it }, hint = "Optional", singleLine = false, minHeight = 80.dp)
            Text("IN THIS PLAYLIST (${items.size})", style = Type.Label, color = Brand.Gold)
            items.toList().forEachIndexed { i, id ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("${i + 1}. ${titles[id] ?: id}", style = Type.Body, color = Brand.White, modifier = Modifier.weight(1f))
                    Icon(Icons.Rounded.KeyboardArrowUp, "Move up", tint = Brand.Text2, modifier = Modifier.size(32.dp).clickable(enabled = i > 0) { items.add(i - 1, items.removeAt(i)) }.padding(4.dp))
                    Icon(Icons.Rounded.KeyboardArrowDown, "Move down", tint = Brand.Text2, modifier = Modifier.size(32.dp).clickable(enabled = i < items.lastIndex) { items.add(i + 1, items.removeAt(i)) }.padding(4.dp))
                }
            }
            Text("ADD SERMONS", style = Type.Label, color = Brand.Gold)
            Field("SEARCH", query, { query = it }, hint = "Title or speaker")
            sermons.filter { query.isBlank() || it.s("title").contains(query, true) || it.s("speaker").contains(query, true) }.take(25).forEach { s ->
                val id = s.s("id")
                val inIt = id in items
                Row(Modifier.fillMaxWidth().clickable { if (inIt) items.remove(id) else items.add(id) }.padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(if (inIt) Icons.Rounded.CheckCircle else Icons.Rounded.AddCircleOutline, null, tint = if (inIt) Brand.Gold else Brand.Text2, modifier = Modifier.size(22.dp))
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text(s.s("title"), style = Type.Body, color = Brand.White)
                        Text(listOf(s.s("speaker"), s.s("sermonDate"), s.s("type")).filter { it.isNotBlank() }.joinToString(" · "), style = Type.Meta, color = Brand.Text2)
                    }
                }
            }
            GoldButton("Save playlist", busy = busy, enabled = name.isNotBlank()) {
                scope.launch {
                    busy = true; error = null
                    val body = mapOf("name" to name.trim(), "description" to description.trim(), "items" to items.toList())
                    runCatching { if (e.id.isBlank()) Api.post("/admin/playlists", body) else Api.patch("/admin/playlists/${e.id}", body) }
                        .onSuccess { editing = null; tick++ }.onFailure { error = it.message }
                    busy = false
                }
            }
            GhostButton("Cancel") { editing = null }
            if (e.id.isNotBlank()) Text("Delete playlist", color = Brand.Red, fontSize = 14.sp, modifier = Modifier.clickable { deleting = true }.padding(10.dp))
        }
    }
    if (deleting) AlertDialog(
        onDismissRequest = { deleting = false }, containerColor = Color(0xFF1C1C20),
        title = { Text("Delete this playlist?", color = Brand.White) },
        text = { Text("Members will no longer see it. The sermons stay in the app.", color = Brand.Text2) },
        confirmButton = { TextButton({ scope.launch { runCatching { Api.delete("/admin/playlists/${editing?.id}") }.onSuccess { editing = null; tick++ }.onFailure { error = it.message }; deleting = false } }) { Text("Delete", color = Brand.Red) } },
        dismissButton = { TextButton({ deleting = false }) { Text("Cancel", color = Brand.Text2) } },
    )
}
