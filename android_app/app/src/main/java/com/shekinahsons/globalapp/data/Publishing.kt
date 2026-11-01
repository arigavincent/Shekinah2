package com.shekinahsons.globalapp.data

import android.content.Context
import android.net.Uri
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.*
import com.shekinahsons.globalapp.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.UUID
import java.util.concurrent.TimeUnit

@Serializable data class PublishJob(
 val id:String=UUID.randomUUID().toString(),val queuedAt:Long=0,val account:String="",val auth:String="",
 val kind:String="video",val materialKind:String="book",val uri:String="",val fileName:String="",val size:Long=0,
 val title:String="",val speaker:String="Shekinah Sons Global",val description:String="",val category:String="",
 val serviceDate:String="",val publishAt:String="",val publishNow:Boolean=false,val isPublished:Boolean=true,val notify:Boolean=false,
 val price:Int=0,val location:String="",val eventTime:String="",val registration:JsonObject?=null,
 val coverUri:String="",val coverName:String="",val coverSize:Long=0,val coverUploadID:String="",
 val state:String="Draft",val progress:Float=0f,val error:String="",val mediaUrl:String="",val coverUrl:String=""
)
object Publishing {
 private fun prefs(c:Context)=c.getSharedPreferences("publishing-jobs",0)
 @Synchronized fun all(c:Context):List<PublishJob> = prefs(c).all.values.filterIsInstance<String>().mapNotNull{runCatching{Api.json.decodeFromString<PublishJob>(it)}.getOrNull()}.sortedWith(compareBy<PublishJob>{it.queuedAt}.thenBy{it.id})
 @Synchronized fun get(c:Context,id:String)=prefs(c).getString(id,null)?.let{Api.json.decodeFromString<PublishJob>(it)}
 @Synchronized fun save(c:Context,j:PublishJob){prefs(c).edit().putString(j.id,Api.json.encodeToString(j)).commit()}
 @Synchronized fun update(c:Context,id:String,change:(PublishJob)->PublishJob){get(c,id)?.let{save(c,change(it))}}
 fun start(c:Context,j:PublishJob){
  check(j.account==Accounts.current){"Sign in as the publisher to resume"}
  save(c,j.copy(state="Queued",error="",auth=Vault.seal(Api.token?:error("Sign in first"))))
  val request=OneTimeWorkRequestBuilder<PublishWorker>().setInputData(workDataOf("job" to j.id))
   .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).setRequiresStorageNotLow(true).build())
   .setBackoffCriteria(BackoffPolicy.EXPONENTIAL,15,TimeUnit.SECONDS).addTag("publishing").build()
  WorkManager.getInstance(c).enqueueUniqueWork("publish-${j.id}",ExistingWorkPolicy.REPLACE,request)
 }
 fun pause(c:Context,id:String){update(c,id){it.copy(state="Paused")};WorkManager.getInstance(c).cancelUniqueWork("publish-$id")}
 suspend fun cancel(c:Context,j:PublishJob){
  update(c,j.id){it.copy(state="Cancelled")};withContext(Dispatchers.IO){WorkManager.getInstance(c).cancelUniqueWork("publish-${j.id}").result.get()}
  runCatching{withContext(Dispatchers.IO){PublishTransfer(c,Vault.open(j.auth)){false}.let{t->t.request("DELETE","/uploads/${j.id}");if(j.coverUri.isNotBlank())t.request("DELETE","/uploads/${j.coverUploadID.ifBlank{UUID.nameUUIDFromBytes((j.id+"cover").toByteArray()).toString()}}")}}}
 }
}
internal class PublishTransfer(private val context:Context,private val token:String,private val callTimeoutSeconds:Long=0,private val stopped:()->Boolean){
 private val http=Api.http.newBuilder().readTimeout(30,TimeUnit.MINUTES).writeTimeout(2,TimeUnit.MINUTES).apply{if(callTimeoutSeconds>0)callTimeout(callTimeoutSeconds,TimeUnit.SECONDS)}.build()
 fun request(method:String,path:String,body:RequestBody?=null,headers:Map<String,String> = emptyMap()):JsonObject {
  check(!stopped()){ "Upload paused" }
  val r=Request.Builder().url(BuildConfig.API_BASE+"/api/v1"+path).header("Authorization","Bearer $token")
  headers.forEach{(k,v)->r.header(k,v)}
  r.method(method,if(method=="GET"||method=="DELETE")null else body?:"{}".toRequestBody("application/json".toMediaType()))
  val call=http.newCall(r.build())
  call.execute().use{res->val json=runCatching{Api.json.parseToJsonElement(res.body?.string().orEmpty()).jsonObject}.getOrDefault(JsonObject(emptyMap()))
   if(!res.isSuccessful)throw ApiException(res.code,json["message"]?.jsonPrimitive?.content?:"Upload failed (${res.code})")
   return json
  }
 }
 fun json(method:String,path:String,fields:Map<String,JsonElement>)=request(method,path,JsonObject(fields).toString().toRequestBody("application/json".toMediaType()))
 fun upload(id:String,uri:String,name:String,size:Long,kind:String,progress:(Float)->Unit):String {
  val state=json("POST","/uploads",mapOf("id" to JsonPrimitive(id),"kind" to JsonPrimitive(kind),"fileName" to JsonPrimitive(name),"sizeBytes" to JsonPrimitive(size)))
  if(state["status"]?.jsonPrimitive?.content=="ready")return state["publicUrl"]?.jsonPrimitive?.content.orEmpty()
  var offset=state["offset"]?.jsonPrimitive?.long?:0L
  context.contentResolver.openInputStream(Uri.parse(uri)).use{input->checkNotNull(input){"File is no longer available. Select it again."}
   var skipped=0L
   while(skipped<offset){val n=input.skip(offset-skipped);if(n>0)skipped+=n else {check(input.read()!=-1){"File changed since selection"};skipped++}}
   val buffer=ByteArray(4*1024*1024)
   while(offset<size){check(!stopped()){ "Upload paused" };val need=minOf(buffer.size.toLong(),size-offset).toInt();var count=0
    while(count<need){val n=input.read(buffer,count,need-count);check(n>0){"File changed since selection"};count+=n}
    val result=request("PATCH","/uploads/$id",buffer.toRequestBody("application/octet-stream".toMediaType(),0,count),mapOf("Upload-Offset" to offset.toString()))
    offset=result["offset"]!!.jsonPrimitive.long;progress(offset.toFloat()/size)
   }
  }
  return request("POST","/uploads/$id/finish")["publicUrl"]?.jsonPrimitive?.content.orEmpty()
 }
}
class PublishWorker(c:Context,p:WorkerParameters):CoroutineWorker(c,p){
 companion object {private val serial=Mutex()}
 override suspend fun doWork():Result=withContext(Dispatchers.IO){serial.withLock{
  val id=inputData.getString("job")?:return@withLock Result.failure()
  val job=Publishing.get(applicationContext,id)?:return@withLock Result.failure()
  if(job.state in listOf("Paused","Cancelled","Complete"))return@withLock Result.success()
  try{
   val manager=applicationContext.getSystemService(NotificationManager::class.java)
   manager.createNotificationChannel(NotificationChannel("publishing","Content uploads",NotificationManager.IMPORTANCE_LOW))
   val notification=NotificationCompat.Builder(applicationContext,"publishing").setContentTitle("Uploading ministry content").setContentText(job.title).setSmallIcon(android.R.drawable.stat_sys_upload).setOngoing(true).build()
   setForeground(if(Build.VERSION.SDK_INT>=29)ForegroundInfo(4801,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)else ForegroundInfo(4801,notification))
   Publishing.update(applicationContext,id){it.copy(state="Uploading",error="")}
   val transfer=PublishTransfer(applicationContext,Vault.open(job.auth)){isStopped || Publishing.get(applicationContext,id)?.state in listOf("Paused","Cancelled")}
   val media=if(job.uri.isBlank())"" else transfer.upload(id,job.uri,job.fileName,job.size,if(job.kind=="event")"image" else job.kind){p->Publishing.update(applicationContext,id){it.copy(progress=p)}}
   val cover=if(job.coverUri.isBlank())"" else transfer.upload(job.coverUploadID.ifBlank{UUID.nameUUIDFromBytes((id+"cover").toByteArray()).toString()},job.coverUri,job.coverName,job.coverSize,"image"){}
   Publishing.update(applicationContext,id){it.copy(state="Publishing",mediaUrl=media,coverUrl=cover)}
   val body=mutableMapOf<String,JsonElement>("title" to JsonPrimitive(job.title),"description" to JsonPrimitive(job.description),"publishedAt" to JsonPrimitive(if(job.publishNow)java.time.Instant.now().toString() else job.publishAt),"isPublished" to JsonPrimitive(job.isPublished),"notifyOnPublish" to JsonPrimitive(job.notify))
   when(job.kind){
    "book"->{val form=MultipartBody.Builder().setType(MultipartBody.FORM);body.forEach{(k,v)->form.addFormDataPart(k,v.jsonPrimitive.content)};form.addFormDataPart("uploadedFile",id).addFormDataPart("author",job.speaker).addFormDataPart("category",job.category).addFormDataPart("kind",job.materialKind).addFormDataPart("price",job.price.toString()).addFormDataPart("coverUrl",cover);transfer.request("POST","/library",form.build())}
    "event"->{body.putAll(mapOf("id" to JsonPrimitive("evt-$id"),"eventDate" to JsonPrimitive(job.serviceDate),"eventTime" to JsonPrimitive(job.eventTime),"location" to JsonPrimitive(job.location),"imageUrl" to JsonPrimitive(media)));job.registration?.let{body["registrationSetup"]=it};transfer.json("POST","/admin/events",body)}
    else->{body.putAll(mapOf("id" to JsonPrimitive("ser-$id"),"externalId" to JsonPrimitive("upload-$id"),"type" to JsonPrimitive(job.kind),"speaker" to JsonPrimitive(job.speaker),"sermonDate" to JsonPrimitive(job.serviceDate),"mediaUrl" to JsonPrimitive(media),"thumbnailUrl" to JsonPrimitive(cover),"categoryId" to JsonPrimitive(job.category),"source" to JsonPrimitive("manual"),"status" to JsonPrimitive("ready")));transfer.json("POST","/admin/sermons",body)}
   }
   Publishing.update(applicationContext,id){it.copy(state="Complete",progress=1f,error="",auth="")};Result.success()
  }catch(e:Exception){
   if(e is kotlinx.coroutines.CancellationException)throw e
   val retry=(e is IOException || e is ApiException && (e.status>=500||e.status in listOf(408,409,429))) && runAttemptCount<8
   Publishing.update(applicationContext,id){if(it.state in listOf("Paused","Cancelled"))it else it.copy(state=if(retry)"Waiting to retry" else "Failed",error=e.message.orEmpty())}
   if(retry)Result.retry()else Result.failure()
  }
 }}
}
