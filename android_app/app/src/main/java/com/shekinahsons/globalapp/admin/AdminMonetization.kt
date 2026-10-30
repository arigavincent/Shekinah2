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
import java.time.LocalDate
import java.time.ZoneId

@Composable fun AdminMonetizationPane(){
 val today=remember{LocalDate.now(ZoneId.of("Africa/Nairobi"))};val scope=rememberCoroutineScope()
 var from by remember{mutableStateOf(today.withDayOfMonth(1).toString())};var to by remember{mutableStateOf(today.toString())};var currency by remember{mutableStateOf("KES")}
 var data by remember{mutableStateOf<JsonObject?>(null)};var error by remember{mutableStateOf<String?>(null)};var busy by remember{mutableStateOf(false)}
 fun load(){scope.launch{busy=true;error=null;runCatching{LocalDate.parse(from);LocalDate.parse(to);Api.get("/admin/giving/analytics?from=$from&to=$to&currency=${java.net.URLEncoder.encode(currency,"UTF-8")}")}.onSuccess{data=it}.onFailure{data=null;error=it.message};busy=false}}
 LaunchedEffect(Unit){load()}
 val names=mapOf("donations" to "Donations","books" to "Books & materials","events" to "Event tickets","live" to "Live access","replays" to "Replay access","other" to "Other purchases")
 fun amount(o:JsonObject?,key:String)="$currency ${"%,d".format(o?.get(key)?.jsonPrimitive?.longOrNull?:0L)}"
 Column(verticalArrangement=Arrangement.spacedBy(12.dp)){
  Text("Monetization & analytics",style=Type.Title,color=Brand.White)
  Text("Confirmed income, reported separately from pending, failed and cancelled payments. Dates use Africa/Nairobi.",style=Type.Body,color=Brand.Text2)
  CalendarField("FROM",from,{from=it});CalendarField("TO",to,{to=it});Field("CURRENCY",currency,{currency=it.uppercase().take(3)})
  GoldButton("Refresh income",busy=busy){load()};ErrorNote(error)
  data?.let{d->val totals=d["totals"]?.jsonObject
   Column(Modifier.fillMaxWidth().glass().padding(16.dp),verticalArrangement=Arrangement.spacedBy(8.dp)){
    Text("Confirmed income",style=Type.Meta,color=Brand.Text2);Text(amount(totals,"confirmed"),style=Type.Title,color=Brand.Gold)
    Text("Pending: ${amount(totals,"pending")}",style=Type.Body,color=Brand.Text2)
    Text("Failed: ${amount(totals,"failed")} · Cancelled: ${amount(totals,"cancelled")}",style=Type.Meta,color=Brand.Text2)
   }
   (d["streams"] as? JsonArray)?.forEach{entry->val row=entry.jsonObject;Column(Modifier.fillMaxWidth().glass().padding(16.dp),verticalArrangement=Arrangement.spacedBy(6.dp)){
    Text(names[row["kind"]?.jsonPrimitive?.content].orEmpty(),style=Type.CardTitle,color=Brand.White)
    Text(amount(row,"confirmed"),style=Type.Title,color=Brand.Gold)
    Text("${row["sales"]?.jsonPrimitive?.content?:"0"} confirmed payments · ${amount(row,"pending")} pending",style=Type.Meta,color=Brand.Text2)
   }}
   Text("Item performance",style=Type.Title,color=Brand.White)
   (d["items"] as? JsonArray)?.forEach{entry->val row=entry.jsonObject;Column(Modifier.fillMaxWidth().glass().padding(14.dp)){
    Text(row["title"]?.jsonPrimitive?.content.orEmpty(),style=Type.CardTitle,color=Brand.White)
    Text("${names[row["kind"]?.jsonPrimitive?.content]} · ${amount(row,"confirmed")} · ${row["sales"]?.jsonPrimitive?.content?:"0"} payments",style=Type.Meta,color=Brand.Text2)
   }}
   Text("Live purchasers keep replay access. Included replay access is not counted as another sale. Export detailed CSV reports from the web dashboard.",style=Type.Meta,color=Brand.Text2)
  }
 }
}
