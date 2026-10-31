package com.shekinahsons.globalapp.admin

import androidx.compose.foundation.clickable
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

@Composable fun AdminSMTPSettings(){
 val scope=rememberCoroutineScope();val values=remember{mutableStateMapOf<String,String>()}
 var enabled by remember{mutableStateOf(false)};var password by remember{mutableStateOf("")};var hasPassword by remember{mutableStateOf(false)};var clearPassword by remember{mutableStateOf(false)}
 var error by remember{mutableStateOf<String?>(null)};var message by remember{mutableStateOf("")};var busy by remember{mutableStateOf(false)};var ready by remember{mutableStateOf(false)}
 fun accept(s:JsonObject){listOf("host","port","username","from","security").forEach{values[it]=s[it]?.jsonPrimitive?.content.orEmpty()};if(values["port"].isNullOrBlank())values["port"]="587";if(values["security"].isNullOrBlank())values["security"]="starttls";enabled=s["enabled"]?.jsonPrimitive?.booleanOrNull==true;hasPassword=s["passwordConfigured"]?.jsonPrimitive?.booleanOrNull==true}
 LaunchedEffect(Unit){runCatching{Api.get("/admin/settings/smtp")["smtp"]!!.jsonObject}.onSuccess{accept(it);ready=true}.onFailure{error=it.message}}
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  Text("Outgoing email · SMTP",style=Type.Title,color=Brand.White)
  Text("Saved settings apply to new password reset and Serve emails. Passwords are encrypted and never shown again.",style=Type.Meta,color=Brand.Text2)
  ErrorNote(error)
  if(ready){
   ToggleRow("Enable outgoing email","",enabled){enabled=it;message=""}
   listOf("host" to "SMTP host","port" to "Port","from" to "Sender email / display name","username" to "Username").forEach{(k,label)->Field(label.uppercase(),values[k].orEmpty(),{values[k]=it;message=""})}
   Text("ENCRYPTION",style=Type.Label,color=Brand.Gold)
   Row(horizontalArrangement=Arrangement.spacedBy(14.dp)){listOf("starttls" to "STARTTLS","tls" to "TLS","none" to "Local test").forEach{(key,label)->Text(label,color=if(values["security"]==key)Brand.Gold else Brand.Text2,modifier=Modifier.clickable{values["security"]=key}.padding(8.dp))}}
   Field(if(hasPassword)"REPLACE PASSWORD · BLANK KEEPS SAVED" else "SMTP PASSWORD",password,{password=it;clearPassword=false;message=""},password=true)
   if(hasPassword)GhostButton("Remove saved login"){values["username"]="";password="";clearPassword=true;message="Login will be removed when you save."}
   GoldButton("Save SMTP settings",busy=busy){scope.launch{busy=true;runCatching{Api.put("/admin/settings/smtp",values.toMap()+mapOf("enabled" to enabled,"password" to password,"clearPassword" to clearPassword))}.onSuccess{accept(it["smtp"]!!.jsonObject);password="";clearPassword=false;message="SMTP settings saved";error=null}.onFailure{error=it.message};busy=false}}
   GhostButton("Check saved SMTP connection"){scope.launch{busy=true;runCatching{Api.post("/admin/settings/smtp/check")}.onSuccess{message=it["message"]!!.jsonPrimitive.content;error=null}.onFailure{error=it.message};busy=false}}
   Text("Connection check sends no email.",style=Type.Meta,color=Brand.Text2)
   if(message.isNotBlank())Text(message,color=Brand.Gold)
  }
 }
}
@Composable fun AdminProductionSettings(){
 val scope=rememberCoroutineScope();val values=remember{mutableStateMapOf<String,String>()};var error by remember{mutableStateOf<String?>(null)};var message by remember{mutableStateOf("")};var busy by remember{mutableStateOf(false)};var ready by remember{mutableStateOf(false)}
 LaunchedEffect(Unit){runCatching{Api.get("/admin/settings/production")["production"]!!.jsonObject}.onSuccess{s->s.forEach{(k,v)->values[k]=v.jsonPrimitive.content};ready=true}.onFailure{error=it.message}}
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  Text("Production links",style=Type.Title,color=Brand.White)
  Text("App download and website links update in the member app. Hosting, HTTPS and signing are completed during deployment. A changed API address applies to the next signed APK.",style=Type.Meta,color=Brand.Text2)
  ErrorNote(error)
  if(ready){listOf("apiUrl" to "Production API origin","dashboardUrl" to "Admin dashboard URL","appUrl" to "App download URL","websiteUrl" to "Ministry website URL").forEach{(k,label)->Field(label.uppercase(),values[k].orEmpty(),{values[k]=it;message=""})}
   GoldButton("Save production links",busy=busy){scope.launch{busy=true;runCatching{Api.put("/admin/settings/production",values.toMap())}.onSuccess{message="Production links saved";error=null}.onFailure{error=it.message};busy=false}}
   if(message.isNotBlank())Text(message,color=Brand.Gold)
  }
 }
}
