package com.shekinahsons.globalapp.ui.screens

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.shekinahsons.globalapp.data.ApiException
import com.shekinahsons.globalapp.data.Api
import com.shekinahsons.globalapp.data.Session
import com.shekinahsons.globalapp.ui.components.*
import com.shekinahsons.globalapp.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import java.util.UUID

@Serializable private data class GatewayTransaction(val id:String="",val status:String="",val checkoutUrl:String="",val amount:Int=0,val message:String="",val resultDescription:String="")

@Composable internal fun GatewayPayments(session:Session,details:GivingDetails,purchase:Purchase?,onSettled:()->Unit){
 key(session.member?.id,purchase?.itemId){GatewayPaymentForm(session,details,purchase,onSettled)}
}
@Composable private fun GatewayPaymentForm(session:Session,details:GivingDetails,purchase:Purchase?,onSettled:()->Unit){
 val context=LocalContext.current
 val account=session.member?.id.orEmpty()
 val prefs=remember(account){context.getSharedPreferences("gateway-$account",Context.MODE_PRIVATE)}
 val slot=remember(account,purchase?.itemId){"payment-${purchase?.itemId?:"giving"}"}
 var method by remember{mutableStateOf(prefs.getString("$slot-method",null)?:if(details.mpesaPrompt)"mpesa" else "card")}
 var amount by remember{mutableStateOf(prefs.getString("$slot-amount",null)?:purchase?.price?.toString()?:"")}
 var category by remember{mutableStateOf(prefs.getString("$slot-category",null)?:purchase?.kind?:details.categories.firstOrNull()?:"Offering")}
 var phone by remember{mutableStateOf(prefs.getString("$slot-phone",null).orEmpty())}
 var email by remember{mutableStateOf(prefs.getString("$slot-email",null)?:session.member?.email.orEmpty())}
 var transaction by remember(slot){mutableStateOf<GatewayTransaction?>(null)}
 var requestID by remember(slot){mutableStateOf(prefs.getString("$slot-request",null).orEmpty())}
 var error by remember{mutableStateOf<String?>(null)}
 var busy by remember{mutableStateOf(false)}
 var checking by remember{mutableStateOf(false)}
 val scope=rememberCoroutineScope()
 suspend fun check(id:String){transaction=Api.decode(Api.get("/giving/transactions/$id")["transaction"])}
 LaunchedEffect(slot){prefs.getString(slot,null)?.let{id->runCatching{check(id)}.onFailure{error=it.message}}}
 LaunchedEffect(transaction?.id,transaction?.status){val id=transaction?.id?:return@LaunchedEffect;if(transaction?.status=="pending"){repeat(24){delay(5000);runCatching{check(id)};if(transaction?.status!="pending")return@LaunchedEffect}}else if(transaction?.status=="success"){prefs.edit().remove(slot).remove("$slot-request").remove("$slot-method").remove("$slot-amount").remove("$slot-category").remove("$slot-phone").remove("$slot-email").apply();onSettled()}}
 Column(Modifier.fillMaxWidth().glass().padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
  Text("Pay securely",style=Type.CardTitle,color=Brand.Gold)
  if(account.isBlank()){Text("Sign in to use an M-Pesa prompt or secure card checkout.",style=Type.Body,color=Brand.Text2)}else{
   val tx=transaction
   if(tx==null){
    if(details.mpesaPrompt&&details.cards)Row(horizontalArrangement=Arrangement.spacedBy(8.dp)){GhostButton(if(method=="mpesa")"✓ M-Pesa prompt" else "M-Pesa prompt",Modifier.weight(1f)){if(requestID.isBlank())method="mpesa"};GhostButton(if(method=="card")"✓ Card" else "Card",Modifier.weight(1f)){if(requestID.isBlank())method="card"}}
    if(purchase!=null)Text("${purchase.title} · KSh ${purchase.price}",style=Type.Body,color=Brand.White)
    else{Field("AMOUNT · KSH",amount,{if(requestID.isBlank())amount=it.filter(Char::isDigit).take(7)},keyboard=KeyboardType.Number);Field("GIVING TOWARDS",category,{if(requestID.isBlank())category=it})}
    Field("M-PESA / CONTACT PHONE",phone,{if(requestID.isBlank())phone=it},keyboard=KeyboardType.Phone)
    if(method=="card")Field("EMAIL",email,{if(requestID.isBlank())email=it},keyboard=KeyboardType.Email)
    Text(if(method=="mpesa")"A payment request will appear on your phone. Enter your PIN only in the M-Pesa prompt." else "Open the provider's secure checkout after creating your payment. Your card details stay with the provider.",style=Type.Meta,color=Brand.Text2)
    GoldButton(if(busy)"Preparing…" else if(requestID.isNotBlank())"Recover payment request" else if(method=="mpesa")"Send M-Pesa prompt" else "Create secure checkout",enabled=!busy&&(amount.toIntOrNull()?:0)>0){
     busy=true;error=null
     if(requestID.isBlank()){requestID=UUID.randomUUID().toString();prefs.edit().putString("$slot-request",requestID).putString("$slot-method",method).putString("$slot-amount",amount).putString("$slot-category",category).putString("$slot-phone",phone).putString("$slot-email",email).apply()}
     scope.launch{runCatching{val result=Api.post(if(method=="mpesa")"/giving/mpesa/stk-push" else "/giving/card/checkout",mapOf("requestId" to requestID,"itemId" to purchase?.itemId.orEmpty(),"amount" to (amount.toIntOrNull()?:0),"category" to category,"phone" to phone,"email" to email,"name" to session.member?.name.orEmpty()));transaction=Api.decode(result["transaction"]);prefs.edit().putString(slot,transaction!!.id).apply()}.onFailure{error=it.message;if(it is ApiException&&it.status==400){requestID="";prefs.edit().remove("$slot-request").apply()}};busy=false}
    }
   }else{
    Text("Payment ${tx.id} · ${tx.status.replace('_',' ')}",style=Type.Body,color=Brand.White)
    Text(when(tx.status){"success"->"Payment confirmed. Your purchase access is ready.";"failed"->"Payment was not completed. Check your payment history before creating another request.";else->"Waiting for provider confirmation. You can safely leave this page and check your payment history."},style=Type.Meta,color=Brand.Text2)
    if(tx.checkoutUrl.isNotBlank()&&tx.status=="pending")GoldButton("Open secure checkout"){runCatching{val uri=Uri.parse(tx.checkoutUrl);check(uri.scheme=="https"&&uri.host!=null){"The provider returned an invalid checkout address"};context.startActivity(Intent(Intent.ACTION_VIEW,uri))}.onFailure{error=it.message}}
    if(tx.status=="pending")GhostButton(if(checking)"Checking…" else "Check payment status"){if(!checking){checking=true;scope.launch{runCatching{check(tx.id)}.onFailure{error=it.message};checking=false}}}
    if(tx.status in listOf("failed","success"))GhostButton("Start another payment"){prefs.edit().remove(slot).remove("$slot-request").remove("$slot-method").remove("$slot-amount").remove("$slot-category").remove("$slot-phone").remove("$slot-email").apply();requestID="";transaction=null}
   }
   ErrorNote(error)
  }
 }
 Spacer(Modifier.height(16.dp))
}
