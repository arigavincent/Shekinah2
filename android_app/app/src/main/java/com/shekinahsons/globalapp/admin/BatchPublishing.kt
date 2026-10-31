package com.shekinahsons.globalapp.admin

import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.shekinahsons.globalapp.ShekinahApp
import com.shekinahsons.globalapp.data.*
import com.shekinahsons.globalapp.ui.components.*
import com.shekinahsons.globalapp.ui.theme.*
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
import java.time.*

private val ministryZone=ZoneId.of("Africa/Nairobi")
private fun releaseInstant(value:String)=runCatching{Instant.parse(value)}.getOrElse{LocalDateTime.parse(value).atZone(ministryZone).toInstant()}.toString()
private fun fileInfo(context:android.content.Context,uri:Uri):Pair<String,Long> {
 context.contentResolver.takePersistableUriPermission(uri,Intent.FLAG_GRANT_READ_URI_PERMISSION)
 context.contentResolver.query(uri,arrayOf(OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE),null,null,null).use{c->
  check(c!=null&&c.moveToFirst()){ "Cannot read selected file" };val name=c.getString(0);val size=c.getLong(1);check(size>0){"The selected file has no readable size"};return name to size
 }
}

// A compact publishing workbench, using the ministry's existing gold/black forms.
// Review persists locally before a transfer starts; server offsets own recovery.
@Composable fun BatchPublishingPane(section:String) {
 val context=LocalContext.current;val session=(context.applicationContext as ShekinahApp).session;val scope=rememberCoroutineScope()
 var publishNow by remember{mutableStateOf(true)};var uploadMode by remember{mutableStateOf("single")};var materialKind by remember{mutableStateOf("book")};var categories by remember{mutableStateOf(emptyList<Pair<String,String>>())}
 var visible by remember{mutableStateOf(false)};var jobs by remember{mutableStateOf(emptyList<PublishJob>())};var selected by remember{mutableStateOf("")}
 var kind by remember{mutableStateOf(if(section=="sermons")"video" else section)}
 var speaker by remember{mutableStateOf("Shekinah Sons Global")};var description by remember{mutableStateOf("")};var category by remember{mutableStateOf("")}
 var serviceDate by remember{mutableStateOf(LocalDate.now(ministryZone).toString())};var publishAt by remember{mutableStateOf(LocalDateTime.now(ministryZone).withSecond(0).withNano(0).toString())}
 var spacing by remember{mutableStateOf("0")};var price by remember{mutableStateOf("0")};var location by remember{mutableStateOf("")};var eventTime by remember{mutableStateOf("10:00")}
 var published by remember{mutableStateOf(true)};var notify by remember{mutableStateOf(false)};var error by remember{mutableStateOf<String?>(null)}
 var mode by remember{mutableStateOf("form")};var formUrl by remember{mutableStateOf("")};var questions by remember{mutableStateOf("")};var capacity by remember{mutableStateOf("0")}
 LaunchedEffect(session.member?.id){while(true){jobs=Publishing.all(context).filter{it.account==session.member?.id&&(if(section=="sermons")it.kind in listOf("video","audio") else it.kind==section)};kotlinx.coroutines.delay(750)}}
 fun edit(j:PublishJob,change:(PublishJob)->PublishJob){Publishing.update(context,j.id,change);jobs=Publishing.all(context).filter{it.account==session.member?.id&&(if(section=="sermons")it.kind in listOf("video","audio") else it.kind==section)}}
 LaunchedEffect(section){if(section=="sermons")runCatching{(Api.get("/admin/sermon-categories")["categories"] as JsonArray).map{it.jsonObject.let{c->c["id"]!!.jsonPrimitive.content to c["name"]!!.jsonPrimitive.content}}}.onSuccess{categories=it;if(category.isBlank())category=it.firstOrNull()?.first.orEmpty()}.onFailure{error=it.message}}
 fun queueFiles(uris:List<Uri>){
  runCatching{
   check(uris.size<=100){"Choose up to 100 files per batch"}
   val queueTime=maxOf(System.currentTimeMillis(),jobs.maxOfOrNull{it.queuedAt}?:0L)+1
   val first=if(publishNow)Instant.now() else Instant.parse(releaseInstant(publishAt));val days=if(uploadMode=="single"||publishNow)0L else spacing.toLongOrNull()?:error("Use a number of days between releases")
   check(days in 0..365){"Release spacing must be between 0 and 365 days"}
   val cost=price.toIntOrNull()?:error("Use a whole-number price");check(cost in 0..1_000_000){"Invalid price"}
   val registration=if(section=="event") buildJsonObject{put("mode",mode);put("formUrl",formUrl);put("price",cost);put("capacity",capacity.toIntOrNull()?:0);putJsonArray("fields"){questions.lines().filter{it.isNotBlank()}.forEachIndexed{i,q->add(buildJsonObject{put("id","q${i+1}");put("label",q.trim().removeSuffix("*"));put("type","text");put("required",q.trim().endsWith("*"))})}}} else null
   uris.forEachIndexed{i,uri->
    val (name,size)=fileInfo(context,uri);val title=name.substringBeforeLast('.').replace('_',' ')
    check(jobs.none{it.uri==uri.toString()&&it.size==size&&it.serviceDate==serviceDate&&it.state!="Cancelled"}){"$name is already in this queue"}
    Publishing.save(context,PublishJob(queuedAt=queueTime+i,account=session.member!!.id,auth=Vault.seal(Api.token?:error("Sign in first")),kind=kind,materialKind=materialKind,uri=uri.toString(),fileName=name,size=size,title=title,speaker=speaker,description=description,category=category,serviceDate=serviceDate,publishAt=first.plusSeconds(days*i*86400).toString(),isPublished=published,publishNow=publishNow,notify=notify,price=cost,location=location,eventTime=eventTime,registration=registration))
   };error=null
  }.onFailure{error=it.message}
 }
 val picker=rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()){queueFiles(it)}
 val singlePicker=rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()){uri->if(uri!=null)queueFiles(listOf(uri))}
 val coverPicker=rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()){uri->if(uri!=null)runCatching{val(name,size)=fileInfo(context,uri);Publishing.get(context,selected)?.let{j->edit(j){it.copy(coverUri=uri.toString(),coverName=name,coverSize=size,coverUploadID=java.util.UUID.randomUUID().toString())}}}.onFailure{error=it.message}}
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  GhostButton(if(visible)"Close publisher" else "Single / batch upload"){visible=!visible}
  if(visible){
   Text("Upload queue",style=Type.Title,color=Brand.White)
   ToolChoices(listOf("single" to "Single upload","batch" to "Batch upload"),uploadMode){uploadMode=it}
   Text("Review each item before starting. Times use Africa/Nairobi; releases run on the server even when this phone is offline.",style=Type.Body,color=Brand.Text2)
   ErrorNote(error)
   if(section=="sermons") Row{listOf("video","audio").forEach{t->Text(t.uppercase(),color=if(kind==t)Brand.Gold else Brand.Text2,modifier=Modifier.clickable{kind=t}.padding(12.dp))}}
   Field(if(section=="book")"DEFAULT AUTHOR" else "DEFAULT SPEAKER",speaker,{speaker=it})
   Field("DEFAULT DESCRIPTION",description,{description=it},singleLine=false,minHeight=90.dp)
   if(section=="sermons")ToolChoices(categories,category){category=it} else if(section=="book")Field("CATEGORY",category,{category=it})
   if(section=="book")ToolChoices(listOf("book" to "Book","journal" to "Journal","devotional" to "Devotional","study" to "Study","magazine" to "Magazine"),materialKind){materialKind=it}
   if(section!="book")CalendarField(if(section=="event")"EVENT DATE" else "SERVICE DATE · PAST DATES ALLOWED",serviceDate,{serviceDate=it})
   PublicationTiming(publishNow,{publishNow=it},publishAt,{publishAt=it})
   if(uploadMode=="batch"&&!publishNow)Field("DAYS BETWEEN RELEASES · 0 TO RELEASE TOGETHER",spacing,{spacing=it})
   ToggleRow("Publish automatically","Turn off to save server drafts",published){published=it}
   ToggleRow("Notify members on release","Keep off when importing older material",notify){notify=it}
   if(section in listOf("book","event")){ToolChoices(listOf("free" to "Free","paid" to "Paid"),if((price.toIntOrNull()?:0)>0)"paid" else "free"){price=if(it=="free")"0" else "1"};if((price.toIntOrNull()?:0)>0)Field("PRICE IN KSH",price,{price=it})}
   if(section=="event"){
    Field("LOCATION",location,{location=it});ClockField("EVENT TIME",eventTime,{eventTime=it})
    Row{listOf("none","form","link").forEach{m->Text(m.uppercase(),color=if(mode==m)Brand.Gold else Brand.Text2,modifier=Modifier.clickable{mode=m}.padding(10.dp))}}
    if(mode=="link")Field("EXTERNAL FORM HTTPS LINK",formUrl,{formUrl=it})
    if(mode=="form")Field("QUESTIONS · ONE PER LINE · * MEANS REQUIRED",questions,{questions=it},singleLine=false,minHeight=90.dp)
    Field("CAPACITY · 0 IS UNLIMITED",capacity,{capacity=it})
   }
   GoldButton(if(uploadMode=="single")"Choose one file" else "Choose files") {val types=when(kind){"book"->arrayOf("application/pdf");"event"->arrayOf("image/jpeg","image/png","image/webp");"audio"->arrayOf("audio/*");else->arrayOf("video/*")};if(uploadMode=="single")singlePicker.launch(types) else picker.launch(types)}
   if(section=="book")Text("The first PDF page becomes the cover automatically. An optional cover image overrides it.",style=Type.Meta,color=Brand.Text2)
   if(section=="event")GhostButton("Add event without poster"){
    runCatching{val cost=price.toInt();check(cost in 0..1_000_000);Publishing.save(context,PublishJob(queuedAt=System.currentTimeMillis(),account=session.member!!.id,auth=Vault.seal(Api.token!!),kind="event",title="New event",description=description,serviceDate=serviceDate,publishAt=if(publishNow)releaseNow() else releaseInstant(publishAt),isPublished=published,publishNow=publishNow,notify=notify,location=location,eventTime=eventTime,price=cost,registration=buildJsonObject{put("mode",mode);put("formUrl",formUrl);put("price",cost);put("capacity",capacity.toIntOrNull()?:0);putJsonArray("fields"){questions.lines().filter{it.isNotBlank()}.forEachIndexed{i,q->add(buildJsonObject{put("id","q${i+1}");put("label",q.trim().removeSuffix("*"));put("type","text");put("required",q.trim().endsWith("*"))})}}}))}.onFailure{error=it.message}
   }
   val drafts=jobs.filter{it.state=="Draft"}
   if(drafts.isNotEmpty())GoldButton(if(drafts.all{it.publishNow})"Upload & publish now · ${drafts.size}" else if(drafts.none{it.publishNow})"Upload & schedule · ${drafts.size}" else "Upload reviewed items · ${drafts.size}"){
    runCatching{drafts.forEach{j->check(j.title.isNotBlank()){ "Each item needs a title" };if(j.kind!="book"){LocalDate.parse(j.serviceDate);check(j.description.isNotBlank()){ "Add each item's description" }};if(j.kind=="event")check(j.location.isNotBlank()&&j.eventTime.isNotBlank()){ "Add event location and time" };Publishing.start(context,j.copy(publishAt=releaseInstant(j.publishAt)))}}.onFailure{error=it.message}
   }
   jobs.forEach{j->Column(Modifier.fillMaxWidth().glass().padding(14.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
    Text(j.title,style=Type.CardTitle,color=Brand.White,modifier=Modifier.clickable{selected=if(selected==j.id)"" else j.id})
    Text("${j.state} · ${(j.progress*100).toInt()}%",style=Type.Label,color=Brand.Gold)
    Text("${j.serviceDate} · ${if(j.publishNow)"Publishes when upload finishes" else "Scheduled: "+releaseLocal(j.publishAt).format(java.time.format.DateTimeFormatter.ofPattern("d MMM yyyy, h:mm a"))+" EAT"}",style=Type.Meta,color=Brand.Text2);ErrorNote(j.error.takeIf{it.isNotBlank()})
    if(selected==j.id&&j.state in listOf("Draft","Failed","Paused")){
     Field("TITLE",j.title,{v->edit(j){it.copy(title=v)}});Field("DESCRIPTION",j.description,{v->edit(j){it.copy(description=v)}},singleLine=false,minHeight=90.dp)
     if(j.kind!="book")CalendarField("SERVICE / EVENT DATE",j.serviceDate,{v->edit(j){it.copy(serviceDate=v)}})
     PublicationTiming(j.publishNow,{v->edit(j){it.copy(publishNow=v)}},j.publishAt,{v->edit(j){it.copy(publishAt=v)}})
     if(j.kind=="video"||j.kind=="audio")ToolChoices(categories,j.category){v->edit(j){it.copy(category=v)}}
     if(j.kind!="event")Field("AUTHOR / SPEAKER",j.speaker,{v->edit(j){it.copy(speaker=v)}})
     if(j.kind in listOf("book","event"))Field("PRICE IN KSH",j.price.toString(),{v->v.toIntOrNull()?.takeIf{it in 0..1_000_000}?.let{n->edit(j){it.copy(price=n,registration=it.registration?.let{r->JsonObject(r.toMutableMap().apply{put("price",JsonPrimitive(n))})})}}})
     if(j.kind=="event"){Field("LOCATION",j.location,{v->edit(j){it.copy(location=v)}});ClockField("TIME",j.eventTime,{v->edit(j){it.copy(eventTime=v)}})}
     ToggleRow("Publish on release","",j.isPublished){v->edit(j){it.copy(isPublished=v)}}
     ToggleRow("Notify on release","",j.notify){v->edit(j){it.copy(notify=v)}}
     if(j.kind!="event")GhostButton(if(j.coverUri.isBlank())"Choose cover" else "Change cover"){selected=j.id;coverPicker.launch(arrayOf("image/*"))}
    }
    Row(horizontalArrangement=Arrangement.spacedBy(16.dp)){
     if(j.state in listOf("Queued","Uploading","Publishing","Waiting to retry"))Text("Pause",color=Brand.Gold,modifier=Modifier.clickable{Publishing.pause(context,j.id)}.padding(8.dp))
     if(j.state in listOf("Paused","Failed"))Text("Resume / retry",color=Brand.Gold,modifier=Modifier.clickable{Publishing.start(context,j)}.padding(8.dp))
     if(j.state!="Complete"&&j.state!="Cancelled")Text("Cancel",color=Brand.Text2,modifier=Modifier.clickable{scope.launch{Publishing.cancel(context,j)}}.padding(8.dp))
    }
   }}
  }
 }
}
