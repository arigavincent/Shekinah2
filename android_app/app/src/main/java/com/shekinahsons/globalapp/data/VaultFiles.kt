package com.shekinahsons.globalapp.data

import android.content.Context
import android.net.Uri
import androidx.media3.common.C
import androidx.media3.datasource.BaseDataSource
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import okhttp3.Request
import java.io.File
import java.io.RandomAccessFile
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

// Encrypted sermon downloads. Each file is AES-256 in counter mode (so the
// player can jump anywhere without reading from the start) with its own
// random IV in a 16-byte header. They live in the app's private storage,
// which other apps, file managers and USB can't see, and the key itself is
// sealed by the Android Keystore.
object VaultFiles {
    private const val SCHEME = "shekinah-vault"
    @Volatile private var dataKey: SecretKeySpec? = null

    private fun dir(context: Context) = File(context.filesDir, "vault").apply { mkdirs() }
    private fun file(context: Context, id: String) = File(dir(context), id.replace(Regex("[^A-Za-z0-9_-]"), "_") + ".enc")

    fun has(context: Context, id: String) = file(context, id).let { it.exists() && it.length() > 16 }
    fun uri(id: String) = "$SCHEME://$id"
    fun delete(context: Context, id: String) { val f=file(context,id); f.delete(); File(f.path+".part").delete(); File(f.path+".meta").delete() }

    private fun key(context: Context): SecretKeySpec {
        dataKey?.let { return it }
        synchronized(this) {
            dataKey?.let { return it }
            val prefs = context.getSharedPreferences("vault", Context.MODE_PRIVATE)
            val bytes = prefs.getString("key", null)?.let { Vault.openBytes(it) } ?: ByteArray(32).also {
                SecureRandom().nextBytes(it)
                prefs.edit().putString("key", Vault.sealBytes(it)).apply()
            }
            return SecretKeySpec(bytes, "AES").also { dataKey = it }
        }
    }

    private fun cipherAt(context: Context, iv: ByteArray, position: Long): Cipher {
        // Counter mode: advance the IV by the block index to start mid-file.
        val counter = java.math.BigInteger(1, iv).add(java.math.BigInteger.valueOf(position / 16))
        val raw = counter.toByteArray().takeLast(16).toByteArray().let { if (it.size < 16) ByteArray(16 - it.size) + it else it }
        return Cipher.getInstance("AES/CTR/NoPadding").apply { init(Cipher.DECRYPT_MODE, key(context), IvParameterSpec(raw)) }
    }

    // Streams the sermon from the network straight into an encrypted file.
    fun save(context: Context, id: String, url: String, progress: (Float) -> Unit) = save(context, id, url, emptyMap(), progress = progress)

    fun save(context: Context, id: String, url: String, headers: Map<String, String>, stopped: () -> Boolean = { false }, progress: (Float) -> Unit) {
        val target = file(context, id)
        val part = File(target.path + ".part")
        val meta = File(target.path + ".meta")
        val saved=runCatching { org.json.JSONObject(meta.readText()) }.getOrNull()
        var offset=if(part.length()>16 && saved?.optString("url")==url && !saved.optString("validator").isNullOrBlank()) part.length()-16 else 0L
        val request = Request.Builder().url(url).apply {
            headers.forEach { (k,v) -> header(k,v) }
            header("Accept-Encoding","identity")
            if(offset>0) { header("Range","bytes=$offset-"); header("If-Range",saved!!.getString("validator")) }
        }.build()
        Api.http.newBuilder().readTimeout(30, java.util.concurrent.TimeUnit.SECONDS).build().newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw ApiException(response.code,"Download failed (${response.code})")
            val body=response.body ?: throw java.io.IOException("Empty download")
            val type=body.contentType()?.toString().orEmpty()
            check(!type.contains("mpegurl",true) && !url.substringBefore('?').endsWith(".m3u8")) { "Offline replay is not available for this live stream yet." }
            if(response.code!=206) offset=0
            if(offset>0) check(response.header("Content-Range").orEmpty().startsWith("bytes $offset-")) { "Server returned an invalid download range" }
            val length=body.contentLength()
            check(length<0 || target.parentFile!!.usableSpace>length+1024*1024) { "Free up some storage and try again." }
            val iv=if(offset>0) RandomAccessFile(part,"r").use { f -> ByteArray(16).also(f::readFully) } else ByteArray(16).also { SecureRandom().nextBytes(it) }
            val cipher=cipherAt(context,iv,offset)
            if(offset%16>0) cipher.update(ByteArray((offset%16).toInt()))
            meta.writeText(org.json.JSONObject().put("url",url).put("validator",response.header("ETag") ?: response.header("Last-Modified") ?: "").toString())
            RandomAccessFile(part,"rw").use { out ->
                if(offset==0L) { out.setLength(0); out.write(iv) }
                out.seek(16+offset)
                var received=0L
                var report=0L
                val buffer=ByteArray(64*1024)
                body.byteStream().use { input ->
                    while(true) {
                        if(stopped()) throw java.io.InterruptedIOException("Download paused")
                        val n=input.read(buffer)
                        if(n<0) break
                        out.write(cipher.update(buffer,0,n)); received+=n
                        if(received-report>=256*1024) { if(length>0) progress((offset+received).toFloat()/(offset+length)); report=received }
                    }
                }
                if(length>=0 && received!=length) throw java.io.IOException("Download interrupted")
                check(received+offset>0) { "Empty download" }
                cipher.doFinal()?.let(out::write)
                out.fd.sync()
            }
        }
        check(!stopped()) { "Download paused" }
        check(part.renameTo(target)) { "Could not finish saving the download" }
        meta.delete(); progress(1f)
    }

    // Lets the players read shekinah-vault:// addresses, decrypting as they go.
    class Source(private val context: Context) : BaseDataSource(false) {
        private var raf: RandomAccessFile? = null
        private var cipher: Cipher? = null
        private var uri: Uri? = null
        private var remaining = 0L

        override fun open(dataSpec: DataSpec): Long {
            uri = dataSpec.uri
            transferInitializing(dataSpec)
            val f = file(context, dataSpec.uri.host ?: dataSpec.uri.toString().substringAfter("://"))
            val r = RandomAccessFile(f, "r")
            val iv = ByteArray(16).also { r.readFully(it) }
            val length = r.length() - 16
            val start = dataSpec.position
            val c = cipherAt(context, iv, start)
            // Skip into the middle of the first block.
            val skip = (start % 16).toInt()
            r.seek(16 + start - skip)
            if (skip > 0) { val block = ByteArray(skip); r.readFully(block); c.update(block) }
            raf = r; cipher = c
            remaining = if (dataSpec.length != C.LENGTH_UNSET.toLong()) dataSpec.length else length - start
            transferStarted(dataSpec)
            return remaining
        }

        override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
            if (length == 0) return 0
            if (remaining == 0L) return C.RESULT_END_OF_INPUT
            val want = minOf(length.toLong(), remaining).toInt()
            val raw = ByteArray(want)
            val n = raf!!.read(raw, 0, want)
            if (n <= 0) return C.RESULT_END_OF_INPUT
            val plain = cipher!!.update(raw, 0, n)
            System.arraycopy(plain, 0, buffer, offset, plain.size)
            remaining -= plain.size
            bytesTransferred(plain.size)
            return plain.size
        }

        override fun getUri() = uri

        override fun close() {
            uri = null
            raf?.close(); raf = null; cipher = null
            transferEnded()
        }
    }

    // Sends shekinah-vault:// to the decrypting source and everything else
    // (the internet, the cache) to the normal one.
    class Router(private val context: Context, private val normal: DataSource.Factory) : DataSource.Factory {
        override fun createDataSource(): DataSource = object : DataSource {
            private var active: DataSource? = null
            private val listeners = mutableListOf<androidx.media3.datasource.TransferListener>()
            override fun addTransferListener(l: androidx.media3.datasource.TransferListener) { listeners += l }
            override fun open(dataSpec: DataSpec): Long {
                val source = if (dataSpec.uri.scheme == SCHEME) Source(context) else normal.createDataSource()
                listeners.forEach(source::addTransferListener)
                active = source
                return source.open(dataSpec)
            }
            override fun read(buffer: ByteArray, offset: Int, length: Int) = active!!.read(buffer, offset, length)
            override fun getUri() = active?.uri
            override fun close() { active?.close(); active = null }
        }
    }
}

// Opens an encrypted file as a plain temporary copy in the app's private
// cache (for the PDF reader, which needs a real file); delete it when done.
fun VaultFiles.decryptToTemp(context: Context, id: String): File {
    val out = File(context.noBackupFilesDir, "reading").apply { mkdirs() }.let { File(it, "${id.hashCode()}.pdf") }
    val source = VaultFiles.Source(context)
    source.open(DataSpec(Uri.parse(uri(id))))
    out.outputStream().use { o ->
        val buf = ByteArray(64 * 1024)
        while (true) {
            val n = source.read(buf, 0, buf.size)
            if (n == C.RESULT_END_OF_INPUT || n <= 0) break
            o.write(buf, 0, n)
        }
    }
    source.close()
    return out
}
