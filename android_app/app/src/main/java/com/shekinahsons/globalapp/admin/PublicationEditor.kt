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
import java.time.*

@Composable fun PublicationEditor(path:String,initialTime:String,initialPublished:Boolean,initialNotify:Boolean=false,changed:()->Unit={}){
 val scope=rememberCoroutineScope();var time by remember(path){mutableStateOf(initialTime)};var publishNow by remember(path){mutableStateOf(!releaseLocal(initialTime).isAfter(java.time.LocalDateTime.now(adminZone)))};var published by remember(path){mutableStateOf(initialPublished)};var notify by remember(path){mutableStateOf(initialNotify)}
 var error by remember{mutableStateOf<String?>(null)};var busy by remember{mutableStateOf(false)};var saved by remember{mutableStateOf(false)}
 Column(Modifier.fillMaxWidth().glass().padding(14.dp),verticalArrangement=Arrangement.spacedBy(10.dp)){
  Text("Publication",style=Type.CardTitle,color=Brand.Gold)
  PublicationTiming(publishNow,{publishNow=it;saved=false},time,{time=it;saved=false})
  ToggleRow("Publish on release","Turn off to keep a draft",published){published=it;saved=false}
  ToggleRow("Notify members","Keep off for older material",notify){notify=it;saved=false}
  ErrorNote(error)
  GoldButton(if(saved)"Publication saved" else "Save publication",busy=busy){scope.launch{busy=true;runCatching{val release=if(publishNow)Instant.now() else runCatching{Instant.parse(time)}.getOrElse{LocalDateTime.parse(time).atZone(ZoneId.of("Africa/Nairobi")).toInstant()};Api.patch(path,mapOf("publishedAt" to release.toString(),"isPublished" to published,"notifyOnPublish" to notify))}.onSuccess{saved=true;error=null;changed()}.onFailure{error=it.message};busy=false}}
 }
}
