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
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.shekinahsons.globalapp.data.Clip
import com.shekinahsons.globalapp.data.asSermon
import com.shekinahsons.globalapp.data.HomeContent
import com.shekinahsons.globalapp.data.Sermon
import com.shekinahsons.globalapp.playback.AudioController
import com.shekinahsons.globalapp.ui.Navigator
import com.shekinahsons.globalapp.ui.Route
import com.shekinahsons.globalapp.ui.Tab
import com.shekinahsons.globalapp.ui.components.BottomBar
import com.shekinahsons.globalapp.ui.components.NavBarHeight
import com.shekinahsons.globalapp.ui.screens.AudioPlayerScreen
import com.shekinahsons.globalapp.bible.BibleScreen
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
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import com.shekinahsons.globalapp.data.Library
import com.shekinahsons.globalapp.ui.components.AppDrawer
import com.shekinahsons.globalapp.ui.components.LocalOpenMenu
import com.shekinahsons.globalapp.ui.screens.MenuPage

class MainActivity : ComponentActivity() {
    private lateinit var audio: AudioController

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(SystemBarStyle.dark(android.graphics.Color.TRANSPARENT), SystemBarStyle.dark(android.graphics.Color.TRANSPARENT))
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= 33) requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        val app = application as ShekinahApp
        audio = AudioController(applicationContext, app.library::playableUri, { app.library.position(it.id) }, { s, p, d -> app.library.savePosition(s.id, p, d) }).also { it.connect() }
        val repo = app.content
        setContent {
            ShekinahTheme {
                val content by repo.content.collectAsState()
                val refreshing by repo.refreshing.collectAsState()
                val scope = rememberCoroutineScope()
                LaunchedEffect(Unit) { repo.refresh(); app.session.refresh() }
                val c = content
                if (c == null) Splash(refreshing) { scope.launch { repo.refresh() } } else AppShell(c, audio, app.library, app.session, refreshing) { scope.launch { repo.refresh() } }
            }
        }
    }

    override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean, newConfig: android.content.res.Configuration) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        com.shekinahsons.globalapp.playback.PipState.active = isInPictureInPictureMode
    }
}

private fun Route.key(): String = when (this) {
    is Route.Root -> "tab:${tab.name}"
    is Route.Video -> "video:${sermon.id}"
    is Route.Audio -> "audio:${sermon.id}"
    is Route.DevotionRead -> "devotion:${devotion.id}"
    is Route.Page -> "page:$page"
}


@Composable
private fun AppShell(content: HomeContent, audio: AudioController, library: Library, session: com.shekinahsons.globalapp.data.Session, refreshing: Boolean, refresh: () -> Unit) {
    val nav = remember { Navigator() }
    val context = LocalContext.current
    var menuOpen by remember { mutableStateOf(false) }
    BackHandler(enabled = menuOpen) { menuOpen = false }
    BackHandler(enabled = !menuOpen && (nav.stack.size > 1 || nav.tab != Tab.Home)) { nav.back() }

    val route = nav.current
    val saveable = rememberSaveableStateHolder()
    val openVideo = { s: Sermon, q: List<Sermon> -> nav.push(Route.Video(s, q)) }
    val openAudio = { s: Sermon, q: List<Sermon> -> nav.push(Route.Audio(s, q)) }
    val openClip = { c: Clip -> nav.push(Route.Video(c.asSermon(), content.clips.map { it.asSermon() })) }
    val context2 = context
    // Opens the Bible tab at a written reference ("Matthew 6:6").
    val openReference = { reference: String ->
        com.shekinahsons.globalapp.bible.BibleLink.pending = com.shekinahsons.globalapp.bible.BibleLink.parse(com.shekinahsons.globalapp.bible.BibleDb.get(context2), reference)
        saveable.removeState("tab:Bible")
        nav.select(Tab.Bible)
    }
    val openSermons = { tab: String -> sermonsStartTab = tab; saveable.removeState("tab:Sermons"); nav.select(Tab.Sermons) }

    CompositionLocalProvider(LocalOpenMenu provides { menuOpen = true }) {
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
          // Each screen keeps its scroll position and rail page when you come back to it.
          saveable.SaveableStateProvider(r.key()) {
            when (r) {
                is Route.Root -> when (r.tab) {
                    Tab.Home -> HomeScreen(
                        content, library, session.firstName, refreshing,
                        HomeActions(
                            openMenu = { menuOpen = true },
                            openVideo = openVideo, openAudio = openAudio,
                            openDevotion = { nav.push(Route.DevotionRead(it)) }, openClip = openClip,
                            openLive = { nav.select(Tab.Live) },
                            seeVideos = { openSermons("Video") },
                            seeAudio = { openSermons("Audio") },
                            seeRecaps = { openSermons("Recaps") },
                            seeDevotions = { nav.select(Tab.Devotions) },
                            seeEvents = { nav.push(Route.Page("Events")) },
                            seeUpdates = { nav.push(Route.Page("Updates")) },
                            openCategory = { sermonsStartCategory = it; openSermons("Video") },
                            refresh = refresh,
                            openReference = openReference,
                            openProfile = { nav.push(Route.Page("Profile")) },
                        ),
                    )
                    Tab.Sermons -> SermonsScreen(content, library, sermonsStartTab, sermonsStartCategory.also { sermonsStartCategory = null }, { menuOpen = true }, openVideo, openAudio, openClip)
                    Tab.Bible -> BibleScreen()
                    Tab.Devotions -> DevotionsScreen(content) { nav.push(Route.DevotionRead(it)) }
                    Tab.Live -> LiveScreen(content)
                }
                is Route.Video -> VideoPlayerScreen(r.sermon, r.queue, library, onOpen = { nav.back(); nav.push(Route.Video(it, r.queue)) }, onBack = { nav.back() })
                is Route.Audio -> AudioPlayerScreen(r.sermon, r.queue, audio) { nav.back() }
                is Route.DevotionRead -> DevotionReader(r.devotion) { nav.back() }
                is Route.Page -> MenuPage(
                    r.page, content, library, session, openVideo, openAudio,
                    openProfile = { nav.push(Route.Page("Profile")) },
                    openReference = openReference,
                ) { nav.back() }
            }
          }
        }

        AppDrawer(
            open = menuOpen,
            onClose = { menuOpen = false },
            onSelect = { item ->
                menuOpen = false
                if (item.page == "Share") {
                    val send = android.content.Intent(android.content.Intent.ACTION_SEND).setType("text/plain")
                        .putExtra(android.content.Intent.EXTRA_TEXT, "Get the Shekinah Sons Global app for sermons, devotions and live services.")
                    context.startActivity(android.content.Intent.createChooser(send, "Share app"))
                } else nav.push(Route.Page(item.page))
            },
            version = BuildConfig.VERSION_NAME,
        )

        if (route is Route.Root) {
            Column(Modifier.align(Alignment.BottomCenter)) {
                if (!menuOpen) MiniPlayer(audio, onOpen = { audio.current?.let { nav.push(Route.Audio(it, content.audioSermons)) } })
                BottomBar(nav.tab, content.live.isLive, onSelect = { menuOpen = false; nav.select(it) })
            }
        }
    }
    }
}

// Set by "View All" on Home so Sermons opens on the matching tab.
private var sermonsStartTab = "Video"
private var sermonsStartCategory: String? = null

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

