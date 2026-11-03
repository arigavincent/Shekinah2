package com.shekinahsons.globalapp.admin

import androidx.compose.foundation.clickable
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.material.icons.rounded.*
import androidx.compose.material.icons.automirrored.rounded.MenuBook
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.shekinahsons.globalapp.data.Api
import com.shekinahsons.globalapp.ui.components.*
import com.shekinahsons.globalapp.ui.theme.*
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
import java.time.LocalDate
import java.time.Instant

private data class ContentField(val key:String,val label:String,val long:Boolean=false)
private fun JsonObject.text(key:String)=(get(key) as? JsonPrimitive)?.content.orEmpty()
private fun fields(kind:String):List<ContentField> = when(kind) {
 "sermons" -> listOf(ContentField("title","Title"),ContentField("speaker","Speaker"),ContentField("code","Sermon code"),ContentField("sermonDate","Date (YYYY-MM-DD)"),ContentField("publishedAt","Publish at (ISO date/time)"),ContentField("mediaUrl","Video or audio link (a YouTube link works too)"),ContentField("thumbnailUrl","Cover image URL"),ContentField("duration","Duration"),ContentField("description","Overview",true))
 "devotions" -> listOf(ContentField("title","Title"),ContentField("excerpt","Excerpt",true),ContentField("devotionDate","Date (YYYY-MM-DD)"),ContentField("publishedAt","Publish at (ISO date/time)"),ContentField("imageUrl","Image URL"),ContentField("body","Devotional body",true))
 "updates" -> listOf(ContentField("title","Title"),ContentField("excerpt","Message",true),ContentField("updateDate","Date (YYYY-MM-DD)"),ContentField("imageUrl","Image URL"))
 else -> listOf(ContentField("title","Title"),ContentField("description","Description",true),ContentField("imageUrl","Image URL"))
}
@Composable fun AdminContentPane(kind:String) {
 val scope=rememberCoroutineScope();var records by remember(kind){mutableStateOf(emptyList<JsonObject>())};var edit by remember(kind){mutableStateOf<JsonObject?>(null)}
 val values=remember(kind){mutableStateMapOf<String,String>()};val days=remember(kind){mutableStateListOf<JsonObject>()}
 var error by remember(kind){mutableStateOf<String?>(null)};var busy by remember{mutableStateOf(false)};var tick by remember{mutableIntStateOf(0)};var confirm by remember{mutableStateOf(false)}
 var categories by remember{mutableStateOf(emptyList<JsonObject>())}
 val context=androidx.compose.ui.platform.LocalContext.current;var coverBusy by remember{mutableStateOf(false)}
 val coverPick=androidx.activity.compose.rememberLauncherForActivityResult(androidx.activity.result.contract.ActivityResultContracts.PickVisualMedia()){uri->if(uri!=null)scope.launch{coverBusy=true;runCatching{uploadImage(context,uri)}.onSuccess{values["thumbnailUrl"]=it}.onFailure{error=it.message};coverBusy=false}}
 val endpoint=if(kind=="plans") "reading-plans" else kind
 val key=if(kind=="plans") "plans" else kind
 LaunchedEffect(kind,tick){runCatching{(Api.get("/admin/$endpoint")[key] as? JsonArray)?.map{it.jsonObject}.orEmpty()}.onSuccess{records=it;error=null}.onFailure{error=it.message};if(kind=="sermons") runCatching{(Api.get("/admin/sermon-categories")["categories"] as? JsonArray)?.map{it.jsonObject}.orEmpty()}.onSuccess{categories=it}}
 fun begin(item:JsonObject){edit=item;values.clear();fields(kind).forEach{values[it.key]=item.text(it.key)};values["type"]=item.text("type").ifBlank{"video"};values["categoryId"]=item.text("categoryId");values["isActive"]=item.text("isActive").ifBlank{"true"};values["isPublished"]=item.text("isPublished").ifBlank{"true"};values["notifyOnPublish"]=item.text("notifyOnPublish").ifBlank{"false"};days.clear();days.addAll((item["days"] as? JsonArray)?.map{it.jsonObject}.orEmpty());if(kind=="sermons"){values["notes"]="";if(item.text("id").isNotBlank())scope.launch{runCatching{Api.get("/sermons/${item.text("id")}/notes")["notes"]?.jsonPrimitive?.content.orEmpty()}.onSuccess{values["notes"]=it}}};if(item.text("id").isBlank()){values["publishedAt"]=Instant.now().toString();values["${if(kind=="devotions")"devotion" else if(kind=="updates")"update" else "sermon"}Date"]=LocalDate.now(java.time.ZoneId.of("Africa/Nairobi")).toString()}}
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)) {
  ErrorNote(error)
  if(edit==null){if(kind=="sermons")BatchPublishingPane("sermons")
 GoldButton("Add ${when(kind){"plans"->"reading plan";"updates"->"update";"devotions"->"devotion";else->"sermon"}} "){begin(JsonObject(emptyMap()))}
   ContentList(kind,records){begin(it)}
   if(kind=="sermons"){AdminPlaylistsPane();AdminReplaysPane()}
  } else {
   Text(if(edit!!.text("id").isBlank())"New content" else "Edit content",style=Type.Title,color=Brand.White)
   fields(kind).forEach{field->when{
    field.key=="publishedAt"->CalendarTimeField("Publish at",values[field.key].orEmpty(),{values[field.key]=it})
    field.key.endsWith("Date")->CalendarField(field.label.substringBefore(" ("),values[field.key].orEmpty(),{values[field.key]=it})
    field.key=="thumbnailUrl"&&kind=="sermons"->Column(verticalArrangement=Arrangement.spacedBy(8.dp)){
     Text("COVER",style=Type.Label,color=Brand.Gold)
     FadeImage(values["thumbnailUrl"].orEmpty(),Modifier.fillMaxWidth().aspectRatio(16/9f).clip(androidx.compose.foundation.shape.RoundedCornerShape(14.dp)),label="SERMON")
     Text(if(values["thumbnailUrl"].isNullOrBlank())"No cover uploaded: members see the bright automatic Shekinah cover." else "Your uploaded cover",style=Type.Meta,color=Brand.Text2)
     Row(horizontalArrangement=Arrangement.spacedBy(10.dp)){
      GhostButton(if(coverBusy)"Uploading…" else "Choose cover image",Modifier.weight(1f)){coverPick.launch(androidx.activity.result.PickVisualMediaRequest(androidx.activity.result.contract.ActivityResultContracts.PickVisualMedia.ImageOnly))}
      if(!values["thumbnailUrl"].isNullOrBlank())GhostButton("Use automatic cover",Modifier.weight(1f)){values["thumbnailUrl"]=""}
     }
    }
    else->Field(field.label.uppercase(),values[field.key].orEmpty(),{values[field.key]=it},singleLine=!field.long,minHeight=if(field.long)120.dp else 52.dp)
   }}
   if(kind=="sermons") {
    if(values["mediaUrl"].orEmpty().contains("youtu"))Text("YouTube link: members watch it in YouTube's player inside the app. It can't be downloaded for offline.",style=Type.Meta,color=Brand.GoldLight)
    Field("SERMON NOTES",values["notes"].orEmpty(),{values["notes"]=it},hint="Key points and scriptures. Start a line with - for a bullet. Bible references like John 3:16 become tappable.",singleLine=false,minHeight=160.dp)
    ToggleRow("Publish on release","",values["isPublished"]=="true"){values["isPublished"]=it.toString()}
    ToggleRow("Notify members","Keep off for backlog imports",values["notifyOnPublish"]=="true"){values["notifyOnPublish"]=it.toString()}
    Text("TYPE",style=Type.Label,color=Brand.Gold)
    FilterPills(listOf("video" to "Video","audio" to "Audio"),values["type"].orEmpty()){values["type"]=it}
    Text("CATEGORY",style=Type.Label,color=Brand.Gold)
    FilterPills(categories.map{it.text("id") to it.text("name")},values["categoryId"].orEmpty()){values["categoryId"]=it}
   }
   if(kind=="plans") {
    ToggleRow("Visible to members","",values["isActive"]=="true"){values["isActive"]=it.toString()}
    days.toList().forEachIndexed{index,day->Column(verticalArrangement=Arrangement.spacedBy(8.dp)){
     Text("DAY ${index+1}",style=Type.Label,color=Brand.Gold)
     listOf("title" to "Day title","reference" to "Scripture reference","description" to "Reading notes","prayerPrompt" to "Prayer prompt").forEach{(k,label)->Field(label.uppercase(),day.text(k),{text->days[index]=JsonObject(day.toMutableMap().apply{put(k,JsonPrimitive(text))})})}
     Text("Remove day",color=Brand.Text2,modifier=Modifier.clickable{days.removeAt(index)}.padding(12.dp))
    }}
    GhostButton("Add reading day"){days.add(JsonObject(mapOf("title" to JsonPrimitive(""),"reference" to JsonPrimitive(""))))}
   }
   GoldButton("Save",busy=busy,enabled=values["title"].orEmpty().isNotBlank()) {scope.launch {
    busy=true;error=null
    val body=values.mapValues{it.value as Any}.toMutableMap()
    if(kind=="plans"){body["isActive"]=values["isActive"]=="true";body["days"]=days.toList();body["durationDays"]=days.size}
    if(kind=="sermons"){body["source"]=edit!!.text("source").ifBlank{"manual"};body["status"]=edit!!.text("status").ifBlank{"ready"};body["isLive"]=false;body["isPublished"]=values["isPublished"]=="true";body["notifyOnPublish"]=values["notifyOnPublish"]=="true"}
    val notes=body.remove("notes") as? String
    runCatching{
     val id=edit!!.text("id")
     val saved=if(id.isBlank())Api.post("/admin/$endpoint",body) else Api.patch("/admin/$endpoint/$id",body)
     if(kind=="sermons"&&notes!=null){val sid=id.ifBlank{(saved["sermon"] as? JsonObject)?.text("id").orEmpty()};if(sid.isNotBlank())Api.put("/admin/sermons/$sid/notes",mapOf("notes" to notes))}
    }.onSuccess{edit=null;tick++}.onFailure{error=it.message};busy=false
   }}
   GhostButton("Cancel"){edit=null;error=null}
   if(edit!!.text("id").isNotBlank()) GhostButton("Delete"){confirm=true}
  }
 }
 if(confirm) AlertDialog(onDismissRequest={confirm=false},title={Text("Delete this content?")},text={Text("This removes it from the app.")},confirmButton={TextButton(onClick={scope.launch{runCatching{Api.delete("/admin/$endpoint/${edit!!.text("id")}")}.onSuccess{edit=null;tick++}.onFailure{error=it.message};confirm=false}}){Text("Delete")}},dismissButton={TextButton(onClick={confirm=false}){Text("Keep")}})
}

@Composable fun AdminModerationPane(testimonies:Boolean) {
 val scope=rememberCoroutineScope();var rows by remember(testimonies){mutableStateOf(emptyList<JsonObject>())};var error by remember{mutableStateOf<String?>(null)};var tick by remember{mutableIntStateOf(0)}
 val endpoint=if(testimonies)"testimonies" else "community/messages";val key=if(testimonies)"testimonies" else "messages";var deleting by remember{mutableStateOf<JsonObject?>(null)}
 LaunchedEffect(testimonies,tick){runCatching{(Api.get("/admin/$endpoint")[key] as? JsonArray)?.map{it.jsonObject}.orEmpty()}.onSuccess{rows=it}.onFailure{error=it.message}}
 var filter by remember(testimonies){mutableStateOf("all")}
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){ErrorNote(error);if(!testimonies) AdminReportsPane()
  StatStrip(listOf(Stat("${rows.size}",if(testimonies)"Testimonies" else "Messages"),Stat("${rows.count{it.text("status")=="pending"}}","Waiting",Brand.Gold),Stat("${rows.count{it.text("status")=="approved"}}","Shown",KitGreen),Stat("${rows.count{it.text("status")=="hidden"}}","Hidden",KitRed)))
  FilterPills(listOf("all" to "All","pending" to "Waiting","approved" to "Shown","hidden" to "Hidden"),filter){filter=it}
  val shown=rows.filter{filter=="all"||it.text("status")==filter}
  if(shown.isEmpty())EmptyState(androidx.compose.material.icons.Icons.Rounded.Forum,"Nothing here","Messages appear as members post them.")
  shown.forEach{row->
   val name=row.text(if(testimonies)"title" else "displayName").ifBlank{"Member"}
   val st=row.text("status")
   Column(Modifier.fillMaxWidth().clip(androidx.compose.foundation.shape.RoundedCornerShape(18.dp)).background(androidx.compose.ui.graphics.Brush.linearGradient(listOf(androidx.compose.ui.graphics.Color(0xFF1B1A1F),androidx.compose.ui.graphics.Color(0xFF131316)))).border(1.dp,androidx.compose.ui.graphics.Color(0x14FFFFFF),androidx.compose.foundation.shape.RoundedCornerShape(18.dp)).padding(14.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
    Row(verticalAlignment=androidx.compose.ui.Alignment.CenterVertically){
     if(testimonies)IconTile(androidx.compose.material.icons.Icons.Rounded.AutoAwesome,Brand.Gold,40) else PersonAvatar(name,row.text("userId").ifBlank{name},40)
     Spacer(Modifier.width(12.dp))
     Column(Modifier.weight(1f)){Text(name,style=Type.CardTitle,color=Brand.White);Text(row.text("createdAt").take(10),style=Type.Meta,color=Brand.Muted)}
     Badge(when(st){"approved"->"SHOWN";"hidden"->"HIDDEN";else->"WAITING"},when(st){"approved"->KitGreen;"hidden"->KitRed;else->Brand.Gold})
    }
    Text(row.text(if(testimonies)"body" else "message"),style=Type.Body,color=Brand.Text2)
    Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){
     if(st!="approved")ActionPill("Show",androidx.compose.material.icons.Icons.Rounded.Check,KitGreen,Modifier.weight(1f)){scope.launch{runCatching{Api.patch("/admin/$endpoint/${row.text("id")}",mapOf("status" to "approved","hiddenReason" to ""))}.onSuccess{tick++}.onFailure{error=it.message}}}
     if(st!="hidden")ActionPill("Hide",androidx.compose.material.icons.Icons.Rounded.VisibilityOff,Brand.GoldLight,Modifier.weight(1f)){scope.launch{runCatching{Api.patch("/admin/$endpoint/${row.text("id")}",mapOf("status" to "hidden","hiddenReason" to "Reviewed by ministry team"))}.onSuccess{tick++}.onFailure{error=it.message}}}
     if(!testimonies)ActionPill("Delete",androidx.compose.material.icons.Icons.Rounded.DeleteOutline,KitRed,Modifier.weight(1f)){deleting=row}
    }
   }
  }
 if(!testimonies)AdminChatBlocksPane()}
 deleting?.let{row->AlertDialog(onDismissRequest={deleting=null},containerColor=androidx.compose.ui.graphics.Color(0xFF1C1C20),
  title={Text("Delete this message?",color=Brand.White)},text={Text("\"${row.text("message").take(120)}\" from ${row.text("displayName")} is removed for everyone in the app. A hidden copy is kept for the records.",color=Brand.Text2)},
  confirmButton={TextButton({deleting=null;scope.launch{runCatching{Api.delete("/admin/community/messages/${row.text("id")}")}.onSuccess{tick++}.onFailure{error=it.message}}}){Text("Delete",color=Brand.Red)}},
  dismissButton={TextButton({deleting=null}){Text("Keep it",color=Brand.Text2)}})}
}

// People blocked from live chat (blocked by a moderator during a service), with Unblock.
@Composable fun AdminChatBlocksPane(){
 val scope=rememberCoroutineScope();var rows by remember{mutableStateOf(emptyList<JsonObject>())};var tick by remember{mutableIntStateOf(0)};var error by remember{mutableStateOf<String?>(null)}
 LaunchedEffect(tick){runCatching{(Api.get("/live/chat/bans")["bans"] as? JsonArray)?.map{it.jsonObject}.orEmpty()}.onSuccess{rows=it;error=null}.onFailure{error=it.message}}
 Column(Modifier.fillMaxWidth().glass().padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
  Text("Blocked from live chat (${rows.size})",style=Type.CardTitle,color=Brand.White)
  ErrorNote(error)
  if(rows.isEmpty())Text("No one is blocked. During a live service, long-press a comment to pin it, remove it or block the person.",style=Type.Meta,color=Brand.Text2)
  rows.forEach{r->Row(verticalAlignment=androidx.compose.ui.Alignment.CenterVertically){
   Column(Modifier.weight(1f)){Text(r.text("name"),style=Type.Body,color=Brand.White);Text(r.text("reason"),style=Type.Meta,color=Brand.Text2)}
   Text("Unblock",color=Brand.Gold,modifier=Modifier.clickable{scope.launch{runCatching{Api.delete("/live/chat/bans/${r.text("userId")}")}.onSuccess{tick++}.onFailure{error=it.message}}}.padding(10.dp))
  }}
 }
}


// The list of sermons, devotions, updates or plans: counts, search, filters,
// and a row per item with its cover and whether it's live in the app.
@Composable private fun ContentList(kind:String,records:List<JsonObject>,open:(JsonObject)->Unit){
 var query by remember(kind){mutableStateOf("")};var filter by remember(kind){mutableStateOf("all")}
 val now=Instant.now()
 fun state(i:JsonObject):String{val pub=i.text("isPublished")!="false"&&i.text("isActive")!="false";val at=runCatching{Instant.parse(i.text("publishedAt"))}.getOrNull();return when{!pub->"hidden";at!=null&&at.isAfter(now)->"scheduled";else->"live"}}
 val date={i:JsonObject->listOf("sermonDate","devotionDate","updateDate").map{i.text(it)}.firstOrNull{it.isNotBlank()}.orEmpty().take(10)}
 StatStrip(listOf(Stat("${records.size}","Total"),Stat("${records.count{state(it)=="live"}}","In the app",KitGreen),Stat("${records.count{state(it)=="scheduled"}}","Scheduled",KitBlue),Stat("${records.count{state(it)=="hidden"}}","Hidden",KitRed)))
 SearchBar(query,{query=it},"Search titles")
 FilterPills(listOf("all" to "All","live" to "In the app","scheduled" to "Scheduled","hidden" to "Hidden")+if(kind=="sermons")listOf("video" to "Video","audio" to "Audio") else emptyList(),filter){filter=it}
 val shown=records.filter{i->(query.isBlank()||i.text("title").contains(query,true)||i.text("speaker").contains(query,true))&&when(filter){"all"->true;"video","audio"->i.text("type").ifBlank{"video"}==filter;else->state(i)==filter}}
 if(shown.isEmpty())EmptyState(androidx.compose.material.icons.Icons.Rounded.Search,"Nothing found","Try another search or filter.")
 shown.forEach{i->
  val img=i.text("thumbnailUrl").ifBlank{i.text("imageUrl")}
  val st=state(i)
  KitRow(i.text("title").ifBlank{"Untitled"},line1=listOf(i.text("speaker"),date(i)).filter{it.isNotBlank()}.joinToString(" \u00B7 "),line2=if(kind=="sermons")i.text("type").ifBlank{"video"}.replaceFirstChar(Char::uppercase)+(if(i.text("duration").isNotBlank())" \u00B7 "+i.text("duration") else "") else i.text("excerpt").take(80),
   leading={if(img.isNotBlank())FadeImage(img,Modifier.size(64.dp,44.dp).clip(androidx.compose.foundation.shape.RoundedCornerShape(10.dp)),label=kind.uppercase().removeSuffix("S")) else IconTile(when(kind){"devotions"->androidx.compose.material.icons.Icons.AutoMirrored.Rounded.MenuBook;"plans"->androidx.compose.material.icons.Icons.Rounded.AutoStories;"updates"->androidx.compose.material.icons.Icons.Rounded.Campaign;else->androidx.compose.material.icons.Icons.Rounded.PlayCircle},Brand.Gold)},
   trailing={Badge(when(st){"live"->"IN APP";"scheduled"->"SCHEDULED";else->"HIDDEN"},when(st){"live"->KitGreen;"scheduled"->KitBlue;else->KitRed})},onClick={open(i)})
 }
}
