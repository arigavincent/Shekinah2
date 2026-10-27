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
    fun delete(context: Context, id: String) { file(context, id).delete() }

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
    fun save(context: Context, id: String, url: String, progress: (Float) -> Unit) {
        val target = file(context, id)
        val part = File(target.path + ".part")
        val iv = ByteArray(16).also { SecureRandom().nextBytes(it) }
        val cipher = Cipher.getInstance("AES/CTR/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key(context), IvParameterSpec(iv)) }
        Api.http.newCall(Request.Builder().url(url).build()).execute().use { response ->
            if (!response.isSuccessful) error("HTTP ${response.code}")
            val body = response.body ?: error("empty")
            val total = body.contentLength()
            part.outputStream().use { out ->
                out.write(iv)
                val buffer = ByteArray(64 * 1024)
                var done = 0L
                var lastReport = 0L
                body.byteStream().use { input ->
                    while (true) {
                        val n = input.read(buffer)
                        if (n < 0) break
                        out.write(cipher.update(buffer, 0, n))
                        done += n
                        if (total > 0 && done - lastReport > 256 * 1024) { progress(done.toFloat() / total); lastReport = done }
                    }
                }
                cipher.doFinal()?.let { out.write(it) }
            }
        }
        part.renameTo(target)
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
