package com.shekinahsons.globalapp.notify

import android.content.Intent
import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

object OpenLink {
    data class Target(val screen: String, val id: String = "")
    var pending by mutableStateOf<Target?>(null)
    var eventId by mutableStateOf<String?>(null)
    var planId by mutableStateOf<String?>(null)
    var bookId by mutableStateOf<String?>(null)
    fun uri(screen: String,id: String=""): Uri = Uri.Builder().scheme("shekinah").authority("open").appendQueryParameter("screen",screen).appendQueryParameter("id",id).build()
    fun receive(intent: Intent?) {
        if(intent==null)return
        val uri=intent.data
        if(uri!=null && (uri.scheme!="shekinah" || uri.host!="open"))return
        val screen=uri?.getQueryParameter("screen") ?: intent.getStringExtra("open") ?: intent.getStringExtra("category") ?: return
        if(screen in listOf("live","sermons","devotion","events","plans","library","updates","notifications")) pending=Target(screen,uri?.getQueryParameter("id") ?: intent.getStringExtra("id").orEmpty())
    }
}
