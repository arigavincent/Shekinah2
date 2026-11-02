package com.shekinahsons.globalapp.playback

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

// True while the app floats as a mini player (picture-in-picture).
object PipState {
    var active by mutableStateOf(false)
}

// True while a video fills the screen (live full screen): the app's own bars hide.
object ImmersiveState {
    var active by mutableStateOf(false)
}
