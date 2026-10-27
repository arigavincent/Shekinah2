package com.shekinahsons.globalapp.bible

import android.content.Context
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import java.util.Locale

// Reads Scripture aloud like a person would: the best natural voice the
// phone has for the version's language, a short breath between verses,
// the chapter announced first, and it carries on into the next chapter.
// Compose screens watch `verse` to highlight and follow along.
class Narrator(private val context: Context) {
    private val prefs = context.getSharedPreferences("narrator", Context.MODE_PRIVATE)
    private var tts: TextToSpeech? = null
    private var ready = false
    private var pending: (() -> Unit)? = null

    var playing by mutableStateOf(false); private set
    var active by mutableStateOf(false); private set
    // The verse being read right now (0 = the chapter heading).
    var verse by mutableIntStateOf(0); private set
    var rate by mutableFloatStateOf(prefs.getFloat("rate", 0.95f)); private set
    var voices by mutableStateOf<List<Voice>>(emptyList()); private set
    var voice by mutableStateOf<Voice?>(null); private set
    var missingLanguage by mutableStateOf(false); private set

    private var language = "en"
    private var heading = ""
    private var verses: List<Verse> = emptyList()
    private var onChapterEnd: (() -> Unit)? = null

    private fun engine(): TextToSpeech = tts ?: run {
        // Google's engine has the neural voices; fall back to the phone default.
        val google = "com.google.android.tts"
        val installed = runCatching { context.packageManager.getPackageInfo(google, 0) }.isSuccess
        val listener = TextToSpeech.OnInitListener { status ->
            ready = status == TextToSpeech.SUCCESS
            if (ready) { pending?.invoke(); pending = null }
        }
        (if (installed) TextToSpeech(context, listener, google) else TextToSpeech(context, listener)).also { t ->
            t.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(id: String) {
                    id.removePrefix("v").toIntOrNull()?.let { verse = it }
                }
                override fun onDone(id: String) {
                    if (id == "end") {
                        playing = false
                        onChapterEnd?.invoke()
                    }
                }
                @Deprecated("Deprecated in Java")
                override fun onError(id: String) { playing = false }
            })
            tts = t
        }
    }

    private fun matches(v: Voice, lang: String): Boolean {
        val l = v.locale
        return l.language.equals(lang, true) || runCatching { l.isO3Language.equals(lang, true) }.getOrDefault(false)
    }

    // Best first: highest quality, offline before network, fewest latency issues.
    private fun pickVoices(lang: String) {
        val all = runCatching { engine().voices.orEmpty() }.getOrDefault(emptySet())
        val list = all.filter { matches(it, lang) && !it.features.contains("notInstalled") }
            .sortedWith(compareByDescending<Voice> { it.quality }.thenBy { it.isNetworkConnectionRequired }.thenBy { it.latency })
        voices = list
        // An empty list before the engine has loaded its voices is not "missing".
        missingLanguage = list.isEmpty() && all.isNotEmpty()
        val saved = prefs.getString("voice-$lang", null)
        voice = list.firstOrNull { it.name == saved } ?: list.firstOrNull()
    }

    // KJV and others carry editorial marks ("[is]", "¶") that sound wrong spoken.
    private fun clean(text: String) = text.replace(Regex("[\\[\\]¶]"), "").replace(Regex("\\s+"), " ").trim()

    fun read(language: String, heading: String, verses: List<Verse>, from: Int, onChapterEnd: () -> Unit) {
        this.language = language; this.heading = heading; this.verses = verses; this.onChapterEnd = onChapterEnd
        active = true
        val start = {
            pickVoices(language)
            speakFrom(from)
        }
        if (ready) start() else { pending = start; engine() }
    }

    private fun speakFrom(from: Int) {
        val t = engine()
        t.stop()
        voice?.let { t.voice = it } ?: run { t.language = Locale(language) }
        t.setSpeechRate(rate)
        t.setPitch(1f)
        val params = Bundle().apply { putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, 1f) }
        var first = true
        if (from <= 1 && heading.isNotBlank()) {
            t.speak(heading, TextToSpeech.QUEUE_FLUSH, params, "v0")
            t.playSilentUtterance(700, TextToSpeech.QUEUE_ADD, "pause-h")
            first = false
        }
        verses.filter { it.number >= from }.forEach { v ->
            t.speak(clean(v.text), if (first) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD, params, "v${v.number}")
            t.playSilentUtterance(420, TextToSpeech.QUEUE_ADD, "pause-${v.number}")
            first = false
        }
        t.playSilentUtterance(10, TextToSpeech.QUEUE_ADD, "end")
        verse = if (from <= 1) 0 else from
        playing = true
    }

    // One verse only (tap a verse, then Listen).
    fun readOne(language: String, v: Verse) {
        this.language = language
        active = true
        onChapterEnd = { stop() }
        val run = {
            pickVoices(language)
            val t = engine()
            t.stop()
            voice?.let { t.voice = it } ?: run { t.language = Locale(language) }
            t.setSpeechRate(rate)
            t.speak(clean(v.text), TextToSpeech.QUEUE_FLUSH, null, "v${v.number}")
            t.playSilentUtterance(10, TextToSpeech.QUEUE_ADD, "end")
            playing = true
        }
        if (ready) run() else { pending = run; engine() }
    }

    fun pause() { tts?.stop(); playing = false }
    fun resume() { if (verses.isNotEmpty()) speakFrom(verse.coerceAtLeast(1)) }
    fun toggle() = if (playing) pause() else resume()
    fun next() { if (verses.isNotEmpty()) speakFrom((verse + 1).coerceAtMost(verses.last().number)) }
    fun previous() { if (verses.isNotEmpty()) speakFrom((verse - 1).coerceAtLeast(1)) }

    fun changeRate(value: Float) {
        rate = value
        prefs.edit().putFloat("rate", value).apply()
        if (playing) speakFrom(verse.coerceAtLeast(1))
    }

    fun chooseVoice(v: Voice) {
        voice = v
        prefs.edit().putString("voice-$language", v.name).apply()
        if (playing) speakFrom(verse.coerceAtLeast(1))
    }

    fun stop() {
        tts?.stop()
        playing = false; active = false; verse = 0
    }

    fun shutdown() { tts?.shutdown(); tts = null; ready = false }

    // Friendly names for voice ids like "en-us-x-iom-local".
    fun label(v: Voice, index: Int): String {
        val country = v.locale.displayCountry.ifBlank { v.locale.displayLanguage }
        val kind = if (v.isNetworkConnectionRequired) "online, most natural" else "works offline"
        return "Voice ${index + 1} · $country · $kind"
    }
}
