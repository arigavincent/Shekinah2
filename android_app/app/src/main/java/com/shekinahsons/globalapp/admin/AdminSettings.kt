package com.shekinahsons.globalapp.admin
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.shekinahsons.globalapp.data.Api
import com.shekinahsons.globalapp.ui.components.*
import com.shekinahsons.globalapp.ui.theme.*
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*
@Composable fun AdminMinistrySettings(){
 val scope=rememberCoroutineScope();val fields=remember{mutableStateMapOf<String,String>()};var error by remember{mutableStateOf<String?>(null)};var saved by remember{mutableStateOf(false)};var busy by remember{mutableStateOf(false)}
 LaunchedEffect(Unit){runCatching{Api.get("/admin/settings/ministry")["ministry"]?.jsonObject}.onSuccess{it?.forEach{(k,v)->fields[k]=(v as? JsonPrimitive)?.content.orEmpty()}}.onFailure{error=it.message}}
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  AdminNextService()
  Text("Ministry details",style=Type.Title,color=Brand.White);Text("Use the ministry's confirmed details. Blank links stay unavailable in the app.",style=Type.Meta,color=Brand.Text2)
  listOf("phone" to "Phone","email" to "Email","address" to "Address","website" to "Website URL","radioUrl" to "Radio stream URL","tvUrl" to "TV stream URL","appUrl" to "App download URL").forEach{(k,label)->Field(label.uppercase(),fields[k].orEmpty(),{fields[k]=it;saved=false})}
  ErrorNote(error);if(saved)Text("Saved",color=Brand.Gold)
  GoldButton("Save ministry details",busy=busy){scope.launch{busy=true;runCatching{Api.put("/admin/settings/ministry",fields.toMap())}.onSuccess{saved=true;error=null}.onFailure{error=it.message};busy=false}}
  AdminPodcastSettings()
  AdminSMTPSettings()
  AdminProductionSettings()
  AdminGivingSettings()
 }
}
@Composable private fun AdminGivingSettings(){
 val scope=rememberCoroutineScope();var details by remember{mutableStateOf(JsonObject(emptyMap()))};var error by remember{mutableStateOf<String?>(null)};var busy by remember{mutableStateOf(false)};var saved by remember{mutableStateOf(false)}
 LaunchedEffect(Unit){runCatching{Api.get("/giving/details")["details"]!!.jsonObject}.onSuccess{details=it}.onFailure{error=it.message}}
 fun section(key:String)=details[key] as? JsonObject ?: JsonObject(emptyMap())
 fun update(key:String,field:String,value:JsonElement){details=JsonObject(details.toMutableMap().apply{put(key,JsonObject(section(key).toMutableMap().apply{put(field,value)}))});saved=false}
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  Text("Giving instructions",style=Type.Title,color=Brand.White)
  listOf("mpesa" to "M-Pesa","airtel" to "Airtel Money","bank" to "Bank transfer").forEach{(key,label)->
   Text(label,style=Type.CardTitle,color=Brand.Gold)
   val group=section(key)
   ToggleRow("Available","",(group["enabled"] as? JsonPrimitive)?.booleanOrNull==true){update(key,"enabled",JsonPrimitive(it))}
   val names=if(key=="bank")listOf("bankName" to "Bank name","accountName" to "Account name","accountNumber" to "Account number","branch" to "Branch","swiftCode" to "SWIFT code","reference" to "Reference")else listOf("paybill" to "Paybill","account" to "Account","accountHint" to "Account hint","name" to "Recipient name")
   names.forEach{(field,text)->Field(text.uppercase(),(group[field] as? JsonPrimitive)?.content.orEmpty(),{update(key,field,JsonPrimitive(it))})}
  }
  Field("NOTE",(details["note"] as? JsonPrimitive)?.content.orEmpty(),{details=JsonObject(details.toMutableMap().apply{put("note",JsonPrimitive(it))})},singleLine=false)
  ErrorNote(error);if(saved)Text("Giving details saved",color=Brand.Gold)
  GoldButton("Save giving instructions",busy=busy){scope.launch{busy=true;runCatching{Api.put("/admin/giving/details",details.toMap())}.onSuccess{saved=true;error=null}.onFailure{error=it.message};busy=false}}
 }
}
@Composable fun AdminReportsPane(){
 val scope=rememberCoroutineScope();var rows by remember{mutableStateOf(emptyList<JsonObject>())};var tick by remember{mutableIntStateOf(0)};var error by remember{mutableStateOf<String?>(null)}
 LaunchedEffect(tick){runCatching{(Api.get("/admin/community/reports")["reports"] as JsonArray).map{it.jsonObject}}.onSuccess{rows=it}.onFailure{error=it.message}}
 Column(verticalArrangement=Arrangement.spacedBy(10.dp)){Text("Member reports (${rows.size})",style=Type.Title,color=Brand.Gold);ErrorNote(error);rows.forEach{row->Column(Modifier.fillMaxWidth().glass().padding(14.dp)){
  Text(row["message"]?.jsonPrimitive?.content.orEmpty(),style=Type.Body,color=Brand.White);Text("Reported: "+row["reason"]?.jsonPrimitive?.content.orEmpty(),style=Type.Meta,color=Brand.Text2)
  GoldButton("Hide message & resolve"){scope.launch{runCatching{Api.patch("/admin/community/messages/${row["messageId"]!!.jsonPrimitive.content}",mapOf("status" to "hidden","hiddenReason" to "Reviewed member report"));Api.patch("/admin/community/reports/${row["id"]!!.jsonPrimitive.content}")}.onSuccess{tick++}.onFailure{error=it.message}}}
  GhostButton("Dismiss report"){scope.launch{runCatching{Api.patch("/admin/community/reports/${row["id"]!!.jsonPrimitive.content}")}.onSuccess{tick++}.onFailure{error=it.message}}}
 }}}
}

@Composable private fun AdminPodcastSettings(){
 val scope=rememberCoroutineScope();var feed by remember{mutableStateOf("")};var error by remember{mutableStateOf<String?>(null)};var busy by remember{mutableStateOf(false)};var result by remember{mutableStateOf("")}
 LaunchedEffect(Unit){runCatching{Api.get("/admin/settings/podcast")["feedUrl"]?.jsonPrimitive?.content.orEmpty()}.onSuccess{feed=it}.onFailure{error=it.message}}
 Column(verticalArrangement=Arrangement.spacedBy(10.dp)){
 Text("Podcast feed",style=Type.Title,color=Brand.White);Field("RSS FEED URL",feed,{feed=it;result=""});ErrorNote(error);if(result.isNotBlank())Text(result,color=Brand.Gold)
 GoldButton("Save podcast feed",busy=busy){scope.launch{busy=true;runCatching{Api.patch("/admin/settings/podcast",mapOf("feedUrl" to feed.trim()))}.onSuccess{result="Feed saved";error=null}.onFailure{error=it.message};busy=false}}
 GoldButton("Sync media now",busy=busy){scope.launch{busy=true;runCatching{Api.post("/admin/sermons/sync")}.onSuccess{result="Media sync completed";error=null}.onFailure{error=it.message};busy=false}}
 }
}
