package com.shekinahsons.globalapp.admin

import androidx.compose.foundation.clickable
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
 "sermons" -> listOf(ContentField("title","Title"),ContentField("speaker","Speaker"),ContentField("code","Sermon code"),ContentField("sermonDate","Date (YYYY-MM-DD)"),ContentField("publishedAt","Publish at (ISO date/time)"),ContentField("mediaUrl","Video or audio URL"),ContentField("thumbnailUrl","Cover image URL"),ContentField("duration","Duration"),ContentField("description","Description",true))
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
 fun begin(item:JsonObject){edit=item;values.clear();fields(kind).forEach{values[it.key]=item.text(it.key)};values["type"]=item.text("type").ifBlank{"video"};values["categoryId"]=item.text("categoryId");values["isActive"]=item.text("isActive").ifBlank{"true"};values["isPublished"]=item.text("isPublished").ifBlank{"true"};values["notifyOnPublish"]=item.text("notifyOnPublish").ifBlank{"false"};days.clear();days.addAll((item["days"] as? JsonArray)?.map{it.jsonObject}.orEmpty());if(item.text("id").isBlank()){values["publishedAt"]=Instant.now().toString();values["${if(kind=="devotions")"devotion" else if(kind=="updates")"update" else "sermon"}Date"]=LocalDate.now(java.time.ZoneId.of("Africa/Nairobi")).toString()}}
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)) {
  ErrorNote(error)
  if(edit==null){if(kind=="sermons")BatchPublishingPane("sermons")
 GoldButton("Add ${when(kind){"plans"->"reading plan";"updates"->"update";"devotions"->"devotion";else->"sermon"}} "){begin(JsonObject(emptyMap()))}
   records.forEach{item->Column(Modifier.fillMaxWidth().glass().clickable{begin(item)}.padding(16.dp)){Text(item.text("title"),style=Type.CardTitle,color=Brand.White);Text("Edit",style=Type.Meta,color=Brand.Gold)}}
   if(kind=="sermons")AdminReplaysPane()
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
    ToggleRow("Publish on release","",values["isPublished"]=="true"){values["isPublished"]=it.toString()}
    ToggleRow("Notify members","Keep off for backlog imports",values["notifyOnPublish"]=="true"){values["notifyOnPublish"]=it.toString()}
    Row(horizontalArrangement=Arrangement.spacedBy(16.dp)){listOf("video","audio").forEach{type->Text(type.uppercase(),color=if(values["type"]==type)Brand.Gold else Brand.Text2,modifier=Modifier.clickable{values["type"]=type}.padding(10.dp))}}
    Text("CATEGORY",style=Type.Label,color=Brand.Gold)
    LazyRow {items(categories){cat->Text(cat.text("name"),color=if(values["categoryId"]==cat.text("id"))Brand.Gold else Brand.Text2,modifier=Modifier.clickable{values["categoryId"]=cat.text("id")}.padding(10.dp))}}
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
    runCatching{val id=edit!!.text("id");if(id.isBlank())Api.post("/admin/$endpoint",body) else Api.patch("/admin/$endpoint/$id",body)}.onSuccess{edit=null;tick++}.onFailure{error=it.message};busy=false
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
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){ErrorNote(error);if(!testimonies) AdminReportsPane();rows.forEach{row->Column(Modifier.fillMaxWidth().glass().padding(16.dp)){
  Text(row.text(if(testimonies)"title" else "displayName"),style=Type.CardTitle,color=Brand.White);Text(row.text(if(testimonies)"body" else "message"),style=Type.Body,color=Brand.Text2);Text(row.text("status"),style=Type.Meta,color=Brand.Gold)
  Row(horizontalArrangement=Arrangement.spacedBy(12.dp)){listOf("approved" to "Approve","hidden" to "Hide").forEach{(status,label)->Text(label,color=Brand.Gold,modifier=Modifier.clickable{scope.launch{runCatching{Api.patch("/admin/$endpoint/${row.text("id")}",mapOf("status" to status,"hiddenReason" to "Reviewed by ministry team"))}.onSuccess{tick++}.onFailure{error=it.message}}}.padding(vertical=14.dp))}
   if(!testimonies)Text("Delete",color=Brand.Red,modifier=Modifier.clickable{deleting=row}.padding(vertical=14.dp))}
 }}
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
