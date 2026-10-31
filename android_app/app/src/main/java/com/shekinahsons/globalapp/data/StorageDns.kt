package com.shekinahsons.globalapp.data

import okhttp3.Dns
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.net.InetAddress
import java.net.UnknownHostException
import java.util.concurrent.TimeUnit

// Respect system DNS first. Some mobile resolvers fail the storage hostname;
// retry only that provider through authenticated HTTPS, retaining normal TLS
// hostname checks and leaving device/network settings untouched.
object StorageDns : Dns {
    private val resolver = OkHttpClient.Builder().dns(Dns.SYSTEM)
        .connectTimeout(5, TimeUnit.SECONDS).readTimeout(5, TimeUnit.SECONDS).build()
    private data class Answer(val expires: Long, val addresses: List<InetAddress>)
    private val cached = mutableMapOf<String, Answer>()
    override fun lookup(hostname: String): List<InetAddress> {
        synchronized(cached) { cached[hostname]?.takeIf { it.expires > System.currentTimeMillis() }?.let { return it.addresses } }
        try { return Dns.SYSTEM.lookup(hostname) } catch (original: UnknownHostException) {
            if (!hostname.endsWith(".r2.cloudflarestorage.com")) throw original
            try {
                val url = okhttp3.HttpUrl.Builder().scheme("https").host("1.1.1.1").addPathSegment("dns-query")
                    .addQueryParameter("name", hostname).addQueryParameter("type", "A").build()
                resolver.newCall(Request.Builder().url(url).header("Accept", "application/dns-json").build()).execute().use { response ->
                    check(response.isSuccessful)
                    val json = JSONObject(response.body!!.string()); check(json.optInt("Status", -1) == 0)
                    val answers = json.optJSONArray("Answer") ?: throw original
                    var ttl = 300
                    val addresses = mutableListOf<InetAddress>()
                    for (i in 0 until answers.length()) {
                        val entry = answers.getJSONObject(i)
                        if (entry.optInt("type") != 1) continue
                        val parts = entry.optString("data").split('.').map { it.toIntOrNull() }
                        if (parts.size != 4 || parts.any { it == null || it !in 0..255 }) continue
                        addresses.add(InetAddress.getByAddress(hostname, parts.map { it!!.toByte() }.toByteArray()))
                        ttl = minOf(ttl, entry.optInt("TTL", 30).coerceIn(1, 300))
                    }
                    if (addresses.isEmpty()) throw original
                    synchronized(cached) {
                        if (cached.size >= 16) cached.clear()
                        cached[hostname] = Answer(System.currentTimeMillis() + ttl * 1000L, addresses)
                    }
                    return addresses
                }
            } catch (_: Exception) { throw original }
        }
    }
}
