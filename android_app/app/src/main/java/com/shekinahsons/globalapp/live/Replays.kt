package com.shekinahsons.globalapp.live

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.rounded.PlayArrow
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.shekinahsons.globalapp.BuildConfig
import com.shekinahsons.globalapp.ShekinahApp
import com.shekinahsons.globalapp.data.*
import com.shekinahsons.globalapp.ui.components.*
import com.shekinahsons.globalapp.ui.screens.*
import com.shekinahsons.globalapp.ui.theme.*
import kotlinx.serialization.Serializable

@Serializable private data class Replay(val id:String="",val title:String="",val price:Int=0,val date:String="",val status:String="",val access:Boolean=false,val mediaUrl:String="",val error:String="")
@Composable fun Replays(session:Session,signIn:()->Unit,back:()->Unit) {
 val context=LocalContext.current
 var items by remember { mutableStateOf(emptyList<Replay>()) };var error by remember { mutableStateOf<String?>(null) }
 var open by remember { mutableStateOf<Replay?>(null) };var paying by remember { mutableStateOf(false) }
 LaunchedEffect(session.member) { while(true) {runCatching{Api.decode<List<Replay>>(Api.get("/live/replays")["items"])}.onSuccess{items=it;error=null}.onFailure{error=it.message};kotlinx.coroutines.delay(8_000)} }
 val selected=open?.let { old->items.firstOrNull{it.id==old.id}?:old }
 BackHandler { if(open!=null){open=null;paying=false}else back() }
 if(selected!=null && selected.access && selected.status=="ready") {
  val sermon=Sermon(id="replay-${selected.id}",title=selected.title,speaker="Shekinah Sons Global",type="video",mediaUrl=BuildConfig.API_BASE+selected.mediaUrl)
  VideoPlayerScreen(sermon,listOf(sermon),(context.applicationContext as ShekinahApp).library,onOpen={},onBack={open=null});return
 }
 Column(Modifier.fillMaxSize()) {
  TopBar(title="Service replays",onBack={if(open!=null){open=null;paying=false}else back()})
  if(selected!=null && paying) GivingPage(session,Purchase(selected.id,selected.title,selected.price,kind="Replay",after="unlocks after finance confirms your payment.",back="Back to replays")){paying=false}
  else LazyColumn(contentPadding=PaddingValues(18.dp,8.dp,18.dp,130.dp),verticalArrangement=Arrangement.spacedBy(14.dp)) {
   item{ErrorNote(error)}
   if(items.isEmpty()) item{Text("Completed services appear here once the recording is ready.",style=Type.Body,color=Brand.Text2)}
   items(items,key={it.id}){r->
    val shape = RoundedCornerShape(20.dp)
    Column(
        Modifier.fillMaxWidth()
            .lifted(shape, 12.dp, Brand.Gold.copy(alpha = 0.2f))
            .clip(shape)
            .background(Brush.linearGradient(listOf(Color(0xFF1C1B20), Color(0xFF101014))))
            .border(1.dp, Color(0x22FFFFFF), shape)
            .clickable {
                if (r.status == "ready") {
                    if (!r.access && session.member == null) signIn() else { open = r; paying = !r.access }
                }
            }
            .padding(18.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(48.dp).clip(RoundedCornerShape(14.dp))
                    .background(Brush.linearGradient(listOf(Brand.Gold, Brand.GoldDeep))),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Rounded.PlayArrow, null, tint = Brand.Black, modifier = Modifier.size(28.dp))
            }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(r.title, style = Type.CardTitle, color = Brand.White, maxLines = 2)
                Spacer(Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(r.date.take(10), style = Type.Meta, color = Brand.Text2)
                    Spacer(Modifier.width(8.dp))
                    Box(
                        Modifier.clip(RoundedCornerShape(50))
                            .background(if (r.access) Color(0x264ADE80) else Color(0x33D4AF37))
                            .padding(horizontal = 8.dp, vertical = 2.dp)
                    ) {
                        Text(
                            if (r.access) "Free replay" else "KSh ${r.price}",
                            color = if (r.access) Color(0xFF4ADE80) else Brand.GoldLight,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }
            Icon(Icons.AutoMirrored.Rounded.ArrowForward, null, tint = Color(0x66FFFFFF), modifier = Modifier.size(20.dp))
        }
        if (r.status != "ready") {
            Spacer(Modifier.height(10.dp))
            Text(if (r.status == "failed") "Recording is being retried" else "Preparing recording…", color = Brand.Gold, fontSize = 12.sp)
            ErrorNote(r.error.takeIf { it.isNotBlank() })
        }
    }
   }
  }
 }
}

// The catalogue uses the same original broadcast entitlement as the live room.
@Composable fun ReplaySermon(sermon:Sermon, library:Library, back:()->Unit) {
 val context=LocalContext.current
 val session=(context.applicationContext as ShekinahApp).session
 var replay by remember(sermon.id){mutableStateOf<Replay?>(null)}
 var error by remember{mutableStateOf<String?>(null)}
 var paying by remember{mutableStateOf(false)}
 LaunchedEffect(sermon.id,session.member) {while(true){
  runCatching{Api.decode<List<Replay>>(Api.get("/live/replays")["items"]).firstOrNull{it.id==sermon.replayId}}.onSuccess{replay=it;error=null}.onFailure{error=it.message}
  kotlinx.coroutines.delay(8_000)
 }}
 BackHandler(onBack=back)
 val current=replay
 if(current?.access==true && current.status=="ready") {
  VideoPlayerScreen(sermon.copy(replayId="",mediaUrl=BuildConfig.API_BASE+current.mediaUrl),listOf(sermon),library,onOpen={},onBack=back)
 } else Column(Modifier.fillMaxSize()) {
  TopBar(title=sermon.title,onBack=back)
  Column(Modifier.padding(20.dp),verticalArrangement=Arrangement.spacedBy(16.dp)) {
   ErrorNote(error)
   if(current==null) Text("Checking recording…",color=Brand.Text2)
   else if(current.status!="ready") Text("Preparing replay. It will become available here automatically.",color=Brand.Gold)
   else if(session.member==null) Text("Sign in from Account to purchase and watch this replay.",color=Brand.Gold)
   else if(paying) GivingPage(session,Purchase(current.id,current.title,current.price,kind="Replay",after="unlocks after finance confirms your payment.",back="Back to recording")){paying=false}
   else {Text("Your live purchase includes this recording. Otherwise, purchase access below.",color=Brand.Text2);GoldButton("Get access · KSh ${current.price}"){paying=true}}
  }
 }
}
