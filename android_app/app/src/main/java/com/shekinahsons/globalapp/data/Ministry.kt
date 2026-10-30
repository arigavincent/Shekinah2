package com.shekinahsons.globalapp.data
import android.content.Context
import androidx.compose.runtime.*
import kotlinx.serialization.Serializable
@Serializable data class MinistryDetails(val phone:String="",val email:String="",val address:String="",val website:String="",val radioUrl:String="",val tvUrl:String="",val appUrl:String="")
object Ministry {
 var details by mutableStateOf(MinistryDetails());private set
 suspend fun load(context:Context){val prefs=context.getSharedPreferences("ministry",0);runCatching{Api.decode<MinistryDetails>(Api.json.parseToJsonElement(prefs.getString("details","{}")!!))}.onSuccess{details=it};runCatching{Api.get("/settings/ministry")["ministry"]}.onSuccess{if(it!=null){details=Api.decode(it);prefs.edit().putString("details",it.toString()).apply()}}}
}
