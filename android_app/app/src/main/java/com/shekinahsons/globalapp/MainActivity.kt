package com.shekinahsons.globalapp

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.lifecycle.repeatOnLifecycle
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
import androidx.compose.runtime.saveable.rememberSaveable
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
        com.shekinahsons.globalapp.notify.OpenLink.receive(intent)
        val app = application as ShekinahApp
        audio = AudioController(applicationContext, app.library::playableUri, { app.library.position(it.id) }, { s, p, d -> app.library.savePosition(s.id, p, d) }).also { it.connect() }
        val repo = app.content
        setContent {
            ShekinahTheme {
                val content by repo.content.collectAsState()
                val refreshing by repo.refreshing.collectAsState()
                val scope = rememberCoroutineScope()
                LaunchedEffect(Unit) { launch { com.shekinahsons.globalapp.data.Ministry.load(this@MainActivity) }; repo.refresh(); app.session.refresh() }
                // Keep Home current (a service going live shows up by itself).
                LaunchedEffect(Unit) { lifecycle.repeatOnLifecycle(androidx.lifecycle.Lifecycle.State.STARTED) { while (true) { kotlinx.coroutines.delay(20_000); repo.refresh() } } }
                val c = content
                // Admin accounts open the admin console; "View app" switches to the member app.
                val session = app.session
                var adminMode by rememberSaveable { mutableStateOf(session.isAdmin) }
                LaunchedEffect(session.member?.id) { adminMode = session.isAdmin }
                LaunchedEffect(com.shekinahsons.globalapp.notify.OpenLink.pending) { if(com.shekinahsons.globalapp.notify.OpenLink.pending!=null)adminMode=false }
                // Staff security rules from the server: idle sign-out, required two-step sign-in.
                androidx.compose.runtime.DisposableEffect(session) {
                    com.shekinahsons.globalapp.data.Api.onSecuritySignal = { code ->
                        if (code == "idle_timeout") {
                            session.signOut()
                            android.widget.Toast.makeText(this@MainActivity, "Signed out after a period without activity. Please sign in again.", android.widget.Toast.LENGTH_LONG).show()
                        } else com.shekinahsons.globalapp.notify.OpenLink.pending = com.shekinahsons.globalapp.notify.OpenLink.Target("security", "")
                    }
                    onDispose { com.shekinahsons.globalapp.data.Api.onSecuritySignal = null }
                }
                if (session.member?.passwordResetRequired == true) com.shekinahsons.globalapp.ui.screens.AccountPage(session)
                else if (adminMode && session.hasStaffTools) com.shekinahsons.globalapp.admin.StaffConsole(
                    session,
                    openApp = { adminMode = false },
                    openLive = { startOnLive = true; adminMode = false },
                )
                else if (c == null) Splash(refreshing) { scope.launch { repo.refresh() } }
                else AppShell(c, audio, app.library, session, refreshing, openAdmin = { adminMode = true }) { scope.launch { repo.refresh() } }
            }
        }
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        com.shekinahsons.globalapp.notify.OpenLink.receive(intent)
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
    Route.GoLive -> "golive"
}


@Composable
private fun AppShell(content: HomeContent, audio: AudioController, library: Library, session: com.shekinahsons.globalapp.data.Session, refreshing: Boolean, openAdmin: () -> Unit, refresh: () -> Unit) {
    val nav = remember(session.member?.id) { Navigator() }
    val context = LocalContext.current
    var menuOpen by remember { mutableStateOf(false) }
    BackHandler(enabled = menuOpen) { menuOpen = false }
    BackHandler(enabled = !menuOpen && (nav.stack.size > 1 || nav.tab != Tab.Home)) { nav.back() }

    LaunchedEffect(Unit) { if (startOnLive) { startOnLive = false; nav.select(Tab.Live) } }
    LaunchedEffect(com.shekinahsons.globalapp.notify.OpenLink.pending) {
        val target=com.shekinahsons.globalapp.notify.OpenLink.pending ?: return@LaunchedEffect
        val repo=(context.applicationContext as ShekinahApp).content
        if(target.id.isNotBlank())repo.refresh()
        val linked=repo.content.value ?: content
        com.shekinahsons.globalapp.notify.OpenLink.pending=null
        when(target.screen) {
            "live" -> nav.select(Tab.Live)
            "sermons" -> linked.sermons.firstOrNull { it.id==target.id }?.let { nav.push(if(it.type=="audio") Route.Audio(it,content.audioSermons) else Route.Video(it,content.sermons)) } ?: nav.select(Tab.Sermons)
            "devotion" -> linked.devotions.firstOrNull { it.id==target.id }?.let { nav.push(Route.DevotionRead(it)) } ?: nav.select(Tab.Devotions)
            "events" -> { com.shekinahsons.globalapp.notify.OpenLink.eventId=target.id; nav.push(Route.Page("Events")) }
            "plans" -> { com.shekinahsons.globalapp.notify.OpenLink.planId=target.id; nav.push(Route.Page("ReadingPlans")) }
            "library" -> { com.shekinahsons.globalapp.notify.OpenLink.bookId=target.id; nav.push(Route.Page("Library")) }
            "updates" -> nav.push(Route.Page("Updates"))
            "security" -> nav.push(Route.Page("Security"))
            else -> nav.push(Route.Page("Notifications"))
        }
    }
    LaunchedEffect(session.member?.id) { audio.close() }
    val route = nav.current
    val saveable = rememberSaveableStateHolder()
    val openVideo = { s: Sermon, q: List<Sermon> -> nav.push(Route.Video(s, q)) }
    val openAudio = { s: Sermon, q: List<Sermon> -> library.opened(s.id); nav.push(Route.Audio(s, q)) }
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
                            seeHistory = { nav.push(Route.Page("History")) },
                            openNotifications = { nav.push(Route.Page("Notifications")) },
                        ),
                        session = session,
                    )
                    Tab.Sermons -> SermonsScreen(content, library, sermonsStartTab, sermonsStartCategory.also { sermonsStartCategory = null }, { menuOpen = true }, openVideo, openAudio, openClip)
                    Tab.Bible -> BibleScreen()
                    Tab.Devotions -> DevotionsScreen(content) { nav.push(Route.DevotionRead(it)) }
                    Tab.Live -> com.shekinahsons.globalapp.live.LiveTab(content, session, openGoLive = { nav.push(Route.GoLive) }, openProfile = { nav.push(Route.Page("Profile")) })
                }
                is Route.Video -> VideoPlayerScreen(r.sermon, r.queue, library, onOpen = { nav.back(); nav.push(Route.Video(it, r.queue)) }, onBack = { nav.back() })
                is Route.Audio -> AudioPlayerScreen(r.sermon, r.queue, audio) { nav.back() }
                is Route.DevotionRead -> DevotionReader(r.devotion) { nav.back() }
                Route.GoLive -> com.shekinahsons.globalapp.live.GoLiveScreen(session) { nav.back(); refresh() }
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
                if (item.page == "Admin") openAdmin()
                else if (item.page == "Share") {
                    val send = android.content.Intent(android.content.Intent.ACTION_SEND).setType("text/plain")
                        .putExtra(android.content.Intent.EXTRA_TEXT, "Get the Shekinah Sons Global app for sermons, devotions and live services."+com.shekinahsons.globalapp.data.Ministry.details.appUrl.takeIf { it.isNotBlank() }?.let { "\n$it" }.orEmpty())
                    context.startActivity(android.content.Intent.createChooser(send, "Share app"))
                } else nav.push(Route.Page(item.page))
            },
            version = BuildConfig.VERSION_NAME,
            admin = session.hasStaffTools,
            scanner = session.canScan,
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

// Set by the admin console's live card so the app opens on the Live tab.
private var startOnLive = false

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

