package com.shekinahsons.globalapp.data

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import com.shekinahsons.globalapp.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Request
import java.io.File

object Documents {
    suspend fun openReceipt(context: Context, id: String) {
        val file = withContext(Dispatchers.IO) {
            val request = Request.Builder().url("${BuildConfig.API_BASE}/api/v1/giving/transactions/$id/receipt.pdf")
            Api.token?.let { request.header("Authorization", "Bearer $it") }
            context.getSharedPreferences("giving", Context.MODE_PRIVATE).getString("receipt-$id", null)?.let { request.header("X-Receipt-Token", it) }
            Api.http.newCall(request.build()).execute().use { response ->
                check(response.isSuccessful) { "Could not open receipt. Sign in as the payer and try again." }
                val folder = File(context.cacheDir,"share").apply { mkdirs() }
                File(folder,"receipt-${id.replace(Regex("[^a-zA-Z0-9_-]"),"_")}.pdf").also { f ->
                    response.body!!.byteStream().use { input -> f.outputStream().use { input.copyTo(it) } }
                }
            }
        }
        withContext(Dispatchers.Main) {
            val uri = FileProvider.getUriForFile(context,"${context.packageName}.files",file)
            context.startActivity(Intent.createChooser(Intent(Intent.ACTION_VIEW).setDataAndType(uri,"application/pdf").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION),"Open receipt"))
        }
    }
}
