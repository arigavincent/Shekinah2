package com.shekinahsons.globalapp

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.shekinahsons.globalapp.data.Clip
import com.shekinahsons.globalapp.data.HomeContent
import com.shekinahsons.globalapp.data.Sermon
import com.shekinahsons.globalapp.playback.AudioController
import com.shekinahsons.globalapp.ui.Navigator
import com.shekinahsons.globalapp.ui.Route
import com.shekinahsons.globalapp.ui.Tab
import com.shekinahsons.globalapp.ui.components.BottomBar
import com.shekinahsons.globalapp.ui.components.NavBarHeight
import com.shekinahsons.globalapp.ui.screens.AudioPlayerScreen
import com.shekinahsons.globalapp.ui.screens.BibleScreen
import com.shekinahsons.globalapp.ui.screens.DevotionReader
import com.shekinahsons.globalapp.ui.screens.DevotionsScreen
import com.shekinahsons.globalapp.ui.screens.HomeActions
import com.shekinahsons.globalapp.ui.screens.HomeScreen
import com.shekinahsons.globalapp.ui.screens.LiveScreen
import com.shekinahsons.globalapp.ui.screens.MiniPlayer
import com.shekinahsons.globalapp.ui.screens.SermonsScreen
import com.shekinahsons.globalapp.ui.screens.VideoPlayerScreen
import com.shekinahsons.globalapp.ui.theme.Brand
import com.shekinahsons.globalapp.ui.theme.ShekinahTheme
import com.shekinahsons.globalapp.ui.theme.Type
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private lateinit var audio: AudioController

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(SystemBarStyle.dark(android.graphics.Color.TRANSPARENT), SystemBarStyle.dark(android.graphics.Color.TRANSPARENT))
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= 33) requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        audio = AudioController(applicationContext).also { it.connect() }
        val repo = (application as ShekinahApp).content
        setContent {
            ShekinahTheme {
                val content by repo.content.collectAsState()
                val refreshing by repo.refreshing.collectAsState()
                val scope = rememberCoroutineScope()
                LaunchedEffect(Unit) { repo.refresh() }
                val c = content
                if (c == null) Splash(refreshing) { scope.launch { repo.refresh() } } else AppShell(c, audio)
            }
        }
    }
}

private fun Clip.asSermon() = Sermon(id = id, title = title, thumbnail = image, mediaUrl = mediaUrl, duration = duration, category = "Recap")

@Composable
private fun AppShell(content: HomeContent, audio: AudioController) {
    val nav = remember { Navigator() }
    BackHandler(enabled = nav.stack.size > 1 || nav.tab != Tab.Home) { nav.back() }

    val route = nav.current
    val openVideo = { s: Sermon, q: List<Sermon> -> nav.push(Route.Video(s, q)) }
    val openAudio = { s: Sermon, q: List<Sermon> -> nav.push(Route.Audio(s, q)) }
    val openClip = { c: Clip -> nav.push(Route.Video(c.asSermon(), content.clips.map { it.asSermon() })) }

    Box(Modifier.fillMaxSize().background(Brand.Black)) {
        AnimatedContent(
            targetState = route,
            transitionSpec = {
                val pushing = targetState !is Route.Root
                val popping = initialState !is Route.Root && targetState is Route.Root
                when {
                    pushing -> (slideInHorizontally(tween(320)) { it / 3 } + fadeIn(tween(320))) togetherWith fadeOut(tween(200))
                    popping -> fadeIn(tween(260)) togetherWith (slideOutHorizontally(tween(280)) { it / 3 } + fadeOut(tween(240)))
                    else -> (fadeIn(tween(260)) + scaleIn(tween(260), initialScale = 0.985f)) togetherWith fadeOut(tween(160))
                }
            },
            label = "route",
        ) { r ->
            when (r) {
                is Route.Root -> when (r.tab) {
                    Tab.Home -> HomeScreen(
                        content,
                        HomeActions(
                            openVideo = openVideo, openAudio = openAudio,
                            openDevotion = { nav.push(Route.DevotionRead(it)) }, openClip = openClip,
                            openLive = { nav.select(Tab.Live) },
                            seeSermons = { nav.select(Tab.Sermons) },
                            seeAudio = { nav.stack.clear(); nav.stack.add(Route.Root(Tab.Sermons)); sermonsStartTab = "Audio" },
                            seeDevotions = { nav.select(Tab.Devotions) },
                        ),
                    )
                    Tab.Sermons -> SermonsScreen(content, sermonsStartTab.also { sermonsStartTab = "Video" }, openVideo, openAudio, openClip)
                    Tab.Bible -> BibleScreen(content)
                    Tab.Devotions -> DevotionsScreen(content) { nav.push(Route.DevotionRead(it)) }
                    Tab.Live -> LiveScreen(content)
                }
                is Route.Video -> VideoPlayerScreen(r.sermon, r.queue, onOpen = { nav.back(); nav.push(Route.Video(it, r.queue)) }, onBack = { nav.back() })
                is Route.Audio -> AudioPlayerScreen(r.sermon, r.queue, audio) { nav.back() }
                is Route.DevotionRead -> DevotionReader(r.devotion) { nav.back() }
            }
        }

        if (route is Route.Root) {
            Column(Modifier.align(Alignment.BottomCenter)) {
                MiniPlayer(audio, onOpen = { audio.current?.let { nav.push(Route.Audio(it, content.audioSermons)) } })
                BottomBar(nav.tab, content.live.isLive, onSelect = { nav.select(it) })
            }
        }
    }
}

// Set by "See all" on Home's audio rail so Sermons opens on the Audio tab.
private var sermonsStartTab = "Video"

@Composable
private fun Splash(loading: Boolean, retry: () -> Unit) {
    Box(Modifier.fillMaxSize().background(Brand.Black), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Image(painterResource(R.drawable.dove_mark), "Shekinah Sons Global", Modifier.size(96.dp))
            Spacer(Modifier.height(28.dp))
            if (loading) CircularProgressIndicator(color = Brand.Gold, strokeWidth = 2.dp, modifier = Modifier.size(26.dp))
            else {
                Text("Can't reach the server", style = Type.CardTitle, color = Brand.White)
                Spacer(Modifier.height(10.dp))
                Text(
                    "Try again", style = Type.CardTitle, color = Brand.Black,
                    modifier = Modifier.background(Brand.Gold, androidx.compose.foundation.shape.RoundedCornerShape(50))
                        .clickable(onClick = retry).padding(horizontal = 22.dp, vertical = 10.dp),
                )
            }
        }
    }
}

