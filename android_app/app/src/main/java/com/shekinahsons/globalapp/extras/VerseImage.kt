package com.shekinahsons.globalapp.extras

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.Shader
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.content.res.ResourcesCompat
import com.shekinahsons.globalapp.R
import java.io.File

// "Today's Word": the verse of the day drawn as a branded 4:5 picture
// (made for WhatsApp Status and Instagram) and handed to the share sheet.
object VerseImage {
    private const val W = 1080
    private const val H = 1350

    fun share(context: Context, verse: String, reference: String) {
        val file = File(context.cacheDir, "share").apply { mkdirs() }.let { File(it, "todays-word.png") }
        file.outputStream().use { draw(context, verse, reference).compress(Bitmap.CompressFormat.PNG, 100, it) }
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.files", file)
        val send = Intent(Intent.ACTION_SEND).setType("image/png")
            .putExtra(Intent.EXTRA_STREAM, uri)
            .putExtra(Intent.EXTRA_TEXT, "“$verse” — $reference\n\nShekinah Sons Global")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        context.startActivity(Intent.createChooser(send, "Share today's word"))
    }

    private fun draw(context: Context, verse: String, reference: String): Bitmap {
        val bmp = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        c.drawRect(0f, 0f, W.toFloat(), H.toFloat(), Paint().apply {
            shader = LinearGradient(0f, 0f, W.toFloat(), H.toFloat(), intArrayOf(0xFF3A2A06.toInt(), 0xFF0C0B0A.toInt(), 0xFF0A1838.toInt()), floatArrayOf(0f, 0.55f, 1f), Shader.TileMode.CLAMP)
        })
        // Warm light from the top, cool from the bottom.
        c.drawCircle(W * 0.25f, H * 0.12f, W * 0.7f, Paint().apply { shader = RadialGradient(W * 0.25f, H * 0.12f, W * 0.7f, 0x55D4AF37, 0x00D4AF37, Shader.TileMode.CLAMP) })
        c.drawCircle(W * 0.85f, H * 0.95f, W * 0.6f, Paint().apply { shader = RadialGradient(W * 0.85f, H * 0.95f, W * 0.6f, 0x444A8BFF, 0x004A8BFF, Shader.TileMode.CLAMP) })

        val dove = ContextCompat.getDrawable(context, R.drawable.dove_mark)!!.mutate()
        dove.setBounds(W - 760, H - 820, W + 60, H + 0); dove.alpha = 18; dove.draw(c)
        dove.setBounds(W / 2 - 75, 110, W / 2 + 75, 260); dove.alpha = 255; dove.draw(c)

        val inter = ResourcesCompat.getFont(context, R.font.inter_bold)
        val label = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { typeface = inter; textSize = 30f; color = 0xFFD4AF37.toInt(); letterSpacing = 0.25f; textAlign = Paint.Align.CENTER }
        c.drawText("TODAY'S WORD", W / 2f, 330f, label)

        // The verse, shrunk until it fits the space comfortably.
        val serif = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { typeface = ResourcesCompat.getFont(context, R.font.playfair_italic); color = 0xFFFFFFFF.toInt() }
        var size = 76f
        var layout: StaticLayout
        do {
            serif.textSize = size
            layout = StaticLayout.Builder.obtain("“$verse”", 0, verse.length + 2, serif, W - 180)
                .setAlignment(Layout.Alignment.ALIGN_CENTER).setLineSpacing(0f, 1.18f).build()
            size -= 4f
        } while (layout.height > 600 && size > 36f)
        c.save(); c.translate(90f, 400f + (600 - layout.height) / 2f); layout.draw(c); c.restore()

        val rule = Paint().apply { shader = LinearGradient(W / 2f - 90, 0f, W / 2f + 90, 0f, intArrayOf(0x00D4AF37, 0xFFF0D27A.toInt(), 0x00D4AF37), null, Shader.TileMode.CLAMP) }
        c.drawRect(W / 2f - 90, 1050f, W / 2f + 90, 1054f, rule)
        val ref = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { typeface = ResourcesCompat.getFont(context, R.font.inter_semibold); textSize = 42f; color = 0xFFF0D27A.toInt(); textAlign = Paint.Align.CENTER }
        c.drawText(reference, W / 2f, 1115f, ref)

        val brand = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { typeface = ResourcesCompat.getFont(context, R.font.cinzel_bold); textSize = 36f; color = 0xFFD4AF37.toInt(); letterSpacing = 0.12f; textAlign = Paint.Align.CENTER }
        c.drawText("SHEKINAH", W / 2f, 1240f, brand)
        val sub = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { typeface = inter; textSize = 18f; color = 0xFFB8B8BD.toInt(); letterSpacing = 0.5f; textAlign = Paint.Align.CENTER }
        c.drawText("SONS GLOBAL", W / 2f, 1272f, sub)
        return bmp
    }
}
