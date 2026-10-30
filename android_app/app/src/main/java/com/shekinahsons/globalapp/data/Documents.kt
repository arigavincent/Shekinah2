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
    private suspend fun receipt(context: Context, id: String): File = withContext(Dispatchers.IO) {
            val request = Request.Builder().url("${BuildConfig.API_BASE}/api/v1/giving/transactions/$id/receipt.pdf")
            Api.token?.let { request.header("Authorization", "Bearer $it") }
            context.getSharedPreferences("giving", Context.MODE_PRIVATE).getString("receipt-$id", null)?.let { request.header("X-Receipt-Token", it) }
            Api.http.newCall(request.build()).execute().use { response ->
                check(response.isSuccessful) { "Could not open receipt. A confirmed payment and payer or finance access are required." }
                val folder = File(context.cacheDir,"share").apply { mkdirs() }
                File(folder,"receipt-${id.replace(Regex("[^a-zA-Z0-9_-]"),"_")}.pdf").also { f ->
                    response.body!!.byteStream().use { input -> f.outputStream().use { input.copyTo(it) } }
                }
            }
        }
    suspend fun openReceipt(context: Context, id: String) {
        val file = receipt(context, id)
        withContext(Dispatchers.Main) {
            val uri = FileProvider.getUriForFile(context,"${context.packageName}.files",file)
            context.startActivity(Intent.createChooser(Intent(Intent.ACTION_VIEW).setDataAndType(uri,"application/pdf").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION),"Open receipt"))
        }
    }

    suspend fun printReceipt(context: Context, id: String) {
        val file = receipt(context, id)
        val pages = android.graphics.pdf.PdfRenderer(android.os.ParcelFileDescriptor.open(file, android.os.ParcelFileDescriptor.MODE_READ_ONLY)).use { it.pageCount }
        withContext(Dispatchers.Main) {
            val manager = context.getSystemService(Context.PRINT_SERVICE) as android.print.PrintManager
            manager.print("Shekinah receipt $id", object : android.print.PrintDocumentAdapter() {
                override fun onLayout(old: android.print.PrintAttributes?, new: android.print.PrintAttributes?, cancellation: android.os.CancellationSignal, callback: LayoutResultCallback, extras: android.os.Bundle?) {
                    if (cancellation.isCanceled) { callback.onLayoutCancelled(); return }
                    callback.onLayoutFinished(android.print.PrintDocumentInfo.Builder("receipt-$id.pdf")
                        .setContentType(android.print.PrintDocumentInfo.CONTENT_TYPE_DOCUMENT).setPageCount(pages).build(), old != new)
                }
                override fun onWrite(ranges: Array<android.print.PageRange>, destination: android.os.ParcelFileDescriptor, cancellation: android.os.CancellationSignal, callback: WriteResultCallback) {
                    try {
                        if (cancellation.isCanceled) { callback.onWriteCancelled(); return }
                        file.inputStream().use { input -> java.io.FileOutputStream(destination.fileDescriptor).use { input.copyTo(it) } }
                        if (cancellation.isCanceled) callback.onWriteCancelled() else callback.onWriteFinished(arrayOf(android.print.PageRange.ALL_PAGES))
                    } catch (e: Exception) { callback.onWriteFailed("Could not prepare this receipt for printing") }
                }
            }, android.print.PrintAttributes.Builder().setMediaSize(android.print.PrintAttributes.MediaSize.ISO_A4).build())
        }
    }
}
