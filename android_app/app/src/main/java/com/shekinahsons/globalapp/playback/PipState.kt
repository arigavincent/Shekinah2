package com.shekinahsons.globalapp.playback

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

// True while the app floats as a mini player (picture-in-picture).
object PipState {
    var active by mutableStateOf(false)
}
