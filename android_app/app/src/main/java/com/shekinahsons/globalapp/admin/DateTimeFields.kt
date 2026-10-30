package com.shekinahsons.globalapp.admin

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.text.format.DateFormat
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import com.shekinahsons.globalapp.ui.components.glass
import com.shekinahsons.globalapp.ui.theme.*
import java.time.*
import java.time.format.DateTimeFormatter
import java.util.Locale

internal val adminZone:ZoneId=ZoneId.of("Africa/Nairobi")
internal fun releaseLocal(value:String):LocalDateTime = runCatching{Instant.parse(value).atZone(adminZone).toLocalDateTime()}.getOrElse{runCatching{OffsetDateTime.parse(value).atZoneSameInstant(adminZone).toLocalDateTime()}.getOrElse{runCatching{LocalDateTime.parse(value)}.getOrElse{LocalDateTime.now(adminZone)}}}
internal fun releaseNow():String=Instant.now().toString()
private fun clock(value:String):LocalTime=runCatching{LocalTime.parse(value)}.getOrElse{runCatching{LocalTime.parse(value.uppercase(Locale.ROOT),DateTimeFormatter.ofPattern("h:mm a",Locale.ENGLISH))}.getOrElse{LocalTime.of(10,0)}}

@Composable internal fun CalendarField(label:String,value:String,onChange:(String)->Unit,modifier:Modifier=Modifier){
 val context=LocalContext.current;val selected=runCatching{LocalDate.parse(value.take(10))}.getOrElse{LocalDate.now(adminZone)}
 Column(modifier,verticalArrangement=Arrangement.spacedBy(6.dp)){
  Text(label,style=Type.Label,color=Brand.Gold)
  Row(Modifier.fillMaxWidth().heightIn(min=56.dp).glass().clickable(role=Role.Button){
   DatePickerDialog(context,android.R.style.Theme_DeviceDefault_Dialog_Alert,{_,year,month,day->onChange(LocalDate.of(year,month+1,day).toString())},selected.year,selected.monthValue-1,selected.dayOfMonth).show()
  }.padding(14.dp),horizontalArrangement=Arrangement.spacedBy(10.dp)){
   Icon(Icons.Rounded.CalendarMonth,null,tint=Brand.Gold,modifier=Modifier.size(22.dp))
   Text(if(value.isBlank())"Choose date" else selected.format(DateTimeFormatter.ofPattern("EEE, d MMM yyyy")),style=Type.Body,color=Brand.White)
  }
 }
}
@Composable internal fun ClockField(label:String,value:String,onChange:(String)->Unit,modifier:Modifier=Modifier){
 val context=LocalContext.current;val selected=clock(value)
 Column(modifier,verticalArrangement=Arrangement.spacedBy(6.dp)){
  Text(label,style=Type.Label,color=Brand.Gold)
  Row(Modifier.fillMaxWidth().heightIn(min=56.dp).glass().clickable(role=Role.Button){
   TimePickerDialog(context,android.R.style.Theme_DeviceDefault_Dialog_Alert,{_,hour,minute->onChange(LocalTime.of(hour,minute).format(DateTimeFormatter.ofPattern("HH:mm")))},selected.hour,selected.minute,DateFormat.is24HourFormat(context)).show()
  }.padding(14.dp),horizontalArrangement=Arrangement.spacedBy(10.dp)){
   Icon(Icons.Rounded.Schedule,null,tint=Brand.Gold,modifier=Modifier.size(22.dp))
   Text(if(value.isBlank())"Choose time" else selected.format(DateTimeFormatter.ofPattern(if(DateFormat.is24HourFormat(context))"HH:mm" else "h:mm a")),style=Type.Body,color=Brand.White)
  }
 }
}
@Composable internal fun CalendarTimeField(label:String,value:String,onChange:(String)->Unit){
 val local=releaseLocal(value)
 Column(verticalArrangement=Arrangement.spacedBy(10.dp)){
  Text(label,style=Type.CardTitle,color=Brand.White)
  CalendarField("DATE",local.toLocalDate().toString(),{date->onChange(LocalDateTime.of(LocalDate.parse(date),local.toLocalTime()).atZone(adminZone).toInstant().toString())})
  ClockField("TIME · NAIROBI",local.toLocalTime().format(DateTimeFormatter.ofPattern("HH:mm")),{time->onChange(LocalDateTime.of(local.toLocalDate(),LocalTime.parse(time)).atZone(adminZone).toInstant().toString())})
 }
}
@Composable internal fun PublicationTiming(publishNow:Boolean,onMode:(Boolean)->Unit,value:String,onChange:(String)->Unit){
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  ToolChoices(listOf("now" to "Publish now","later" to "Schedule for later"),if(publishNow)"now" else "later"){key->val now=key=="now";if(!now&&!releaseLocal(value).isAfter(LocalDateTime.now(adminZone)))onChange(Instant.now().plusSeconds(3600).toString());onMode(now)}
  if(publishNow)Text("Upload now and make the item available as soon as its upload finishes.",style=Type.Meta,color=Brand.Text2)
  else{CalendarTimeField("Publication date & time",value,onChange);Text("Files upload now. Members see them at the chosen time in Africa/Nairobi.",style=Type.Meta,color=Brand.Text2)}
 }
}
