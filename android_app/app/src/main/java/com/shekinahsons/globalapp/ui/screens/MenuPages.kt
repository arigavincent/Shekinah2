package com.shekinahsons.globalapp.ui.screens

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Call
import androidx.compose.material.icons.rounded.Place
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.R
import com.shekinahsons.globalapp.data.HomeContent
import com.shekinahsons.globalapp.data.Library
import com.shekinahsons.globalapp.data.Sermon
import com.shekinahsons.globalapp.ui.components.FadeImage
import com.shekinahsons.globalapp.ui.components.TopBar
import com.shekinahsons.globalapp.ui.components.pressable
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.Cinzel
import com.shekinahsons.globalapp.ui.theme.Inter
import com.shekinahsons.globalapp.ui.theme.Type

val MenuPageTitles = mapOf(
    "Profile" to "Profile", "Giving" to "Giving", "Updates" to "Updates", "Notifications" to "Notifications",
    "Downloads" to "Downloads", "Library" to "Saved Sermons", "Platforms" to "Our Platforms",
    "Prayer" to "Prayer Request", "Events" to "Events", "ReadingPlans" to "Reading Plans", "Chat" to "Chat",
    "Testimonies" to "Testimonies", "Serve" to "Serve", "Branches" to "Branches", "CheckIn" to "QR Check-In",
    "About" to "About & Contact",
)

@Composable
fun MenuPage(
    page: String,
    content: HomeContent,
    library: Library,
    openVideo: (Sermon, List<Sermon>) -> Unit,
    openAudio: (Sermon, List<Sermon>) -> Unit,
    onBack: () -> Unit,
) {
    Column(Modifier.fillMaxSize().background(Brand.Black)) {
        TopBar(title = MenuPageTitles[page] ?: page, onBack = onBack)
        when (page) {
            "Events" -> EventsPage(content)
            "Branches" -> BranchesPage(content)
            "Updates" -> UpdatesPage(content)
            "About" -> AboutPage(content)
            "Downloads" -> SermonShelf(content.sermons.filter { library.isDownloaded(it) }, "Sermons you download play here without data.", openVideo, openAudio)
            "Library" -> SermonShelf(content.sermons.filter { library.isSaved(it.id) }, "Tap the heart on a sermon to keep it here.", openVideo, openAudio)
            else -> ComingSoon(MenuPageTitles[page] ?: page)
        }
    }
}

@Composable
private fun SermonShelf(list: List<Sermon>, empty: String, openVideo: (Sermon, List<Sermon>) -> Unit, openAudio: (Sermon, List<Sermon>) -> Unit) {
    if (list.isEmpty()) { Note(empty); return }
    LazyColumn(contentPadding = PaddingValues(vertical = 8.dp)) {
        items(list, key = { it.id }) { s ->
            val audio = s.type == "audio"
            SermonRow(s, audio = audio) { if (audio) openAudio(s, list.filter { it.type == "audio" }) else openVideo(s, list.filter { it.type != "audio" }) }
        }
    }
}

@Composable
private fun EventsPage(content: HomeContent) {
    if (content.events.isEmpty()) { Note("No upcoming events right now."); return }
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        items(content.events, key = { it.id }) { e ->
            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Brand.Surface)) {
                FadeImage(e.imageUrl, Modifier.fillMaxWidth().aspectRatio(2.2f))
                Column(Modifier.padding(16.dp)) {
                    Text(e.date.uppercase(), style = Type.Label, color = Brand.Gold)
                    Spacer(Modifier.height(6.dp))
                    Text(e.title, style = Type.Title, color = Brand.White)
                    Spacer(Modifier.height(8.dp))
                    MetaLine(Icons.Rounded.Schedule, e.time)
                    MetaLine(Icons.Rounded.Place, e.location)
                    if (e.description.isNotBlank()) {
                        Spacer(Modifier.height(8.dp))
                        Text(e.description, style = Type.Body.copy(fontSize = 14.sp, lineHeight = 21.sp), color = Brand.Text2)
                    }
                }
            }
        }
    }
}

@Composable
private fun BranchesPage(content: HomeContent) {
    val context = LocalContext.current
    if (content.branches.isEmpty()) { Note("Branch details are coming soon."); return }
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        items(content.branches, key = { it.id }) { b ->
            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(Brand.Surface)) {
                FadeImage(b.imageUrl, Modifier.fillMaxWidth().aspectRatio(2.2f))
                Column(Modifier.padding(16.dp)) {
                    Text(b.name, style = Type.Title, color = Brand.White)
                    Spacer(Modifier.height(8.dp))
                    MetaLine(Icons.Rounded.Place, b.address)
                    MetaLine(Icons.Rounded.Schedule, b.services)
                    if (b.phone.isNotBlank()) {
                        Spacer(Modifier.height(12.dp))
                        Row(
                            Modifier.clip(RoundedCornerShape(50)).background(Brand.Gold)
                                .pressable { context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${b.phone.replace(" ", "")}"))) }
                                .padding(horizontal = 16.dp, vertical = 9.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(Icons.Rounded.Call, null, tint = Brand.Black, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(8.dp))
                            Text("Call ${b.phone}", color = Brand.Black, fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun UpdatesPage(content: HomeContent) {
    if (content.updates.isEmpty()) { Note("No updates yet."); return }
    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        items(content.updates, key = { it.id }) { u ->
            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(Brand.Surface).padding(12.dp)) {
                FadeImage(u.image, Modifier.size(92.dp).clip(RoundedCornerShape(12.dp)))
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    Text(u.date.uppercase(), style = Type.Label, color = Brand.Gold)
                    Spacer(Modifier.height(4.dp))
                    Text(u.title, style = Type.CardTitle, color = Brand.White)
                    Spacer(Modifier.height(4.dp))
                    Text(u.excerpt, style = Type.Meta.copy(fontSize = 13.5.sp, lineHeight = 19.sp), color = Brand.Text2)
                }
            }
        }
    }
}

@Composable
private fun AboutPage(content: HomeContent) {
    val a = content.about
    LazyColumn(contentPadding = PaddingValues(20.dp)) {
        item {
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                Image(painterResource(R.drawable.dove_mark), null, Modifier.size(96.dp))
                Spacer(Modifier.height(10.dp))
                Text("SHEKINAH", fontFamily = Cinzel, fontSize = 26.sp, color = Brand.Gold, letterSpacing = 3.sp)
                Text("SONS GLOBAL", fontFamily = Inter, fontWeight = FontWeight.SemiBold, fontSize = 12.sp, color = Brand.Text2, letterSpacing = 4.sp)
            }
            Spacer(Modifier.height(26.dp))
            if (a.vision.isNotBlank()) Block("Our Vision", a.vision)
            if (a.description.isNotBlank()) Block("Who We Are", a.description)
            if (a.contactSummary.isNotBlank()) Block("Get In Touch", a.contactSummary)
        }
    }
}

@Composable
private fun Block(title: String, body: String) {
    Column(
        Modifier.fillMaxWidth().padding(bottom = 14.dp).clip(RoundedCornerShape(18.dp))
            .background(Brush.linearGradient(listOf(Color(0xFF1C1810), Color(0xFF121216))))
            .border(1.dp, Color(0x1AD4AF37), RoundedCornerShape(18.dp)).padding(18.dp),
    ) {
        Text(title.uppercase(), style = Type.Label, color = Brand.Gold)
        Spacer(Modifier.height(8.dp))
        Text(body, style = Type.Body, color = Brand.White)
    }
}

@Composable
private fun MetaLine(icon: androidx.compose.ui.graphics.vector.ImageVector, text: String) {
    if (text.isBlank()) return
    Row(Modifier.padding(vertical = 3.dp), verticalAlignment = Alignment.Top) {
        Icon(icon, null, tint = Brand.BlueText, modifier = Modifier.size(16.dp).padding(top = 2.dp))
        Spacer(Modifier.width(8.dp))
        Text(text, style = Type.Meta.copy(fontSize = 13.5.sp, lineHeight = 19.sp), color = Brand.Text2)
    }
}

@Composable
private fun Note(text: String) {
    Text(text, style = Type.Body, color = Brand.Muted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(48.dp))
}

@Composable
private fun ComingSoon(title: String) {
    Box(Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Image(painterResource(R.drawable.dove_mark), null, Modifier.size(72.dp), alpha = 0.8f)
            Spacer(Modifier.height(18.dp))
            Text(title, style = Type.Title, color = Brand.White)
            Spacer(Modifier.height(8.dp))
            Text("This is moving over from the old app in the next update.", style = Type.Body, color = Brand.Text2, textAlign = TextAlign.Center)
        }
    }
}
