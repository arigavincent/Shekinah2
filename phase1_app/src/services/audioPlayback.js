import { createAudioPlayer, setAudioModeAsync } from "expo-audio";

import { AUDIO_COVER } from "../content";
import {
  resolveMediaUrl,
  sermonMediaUrl,
  sermonThumbnail
} from "../utils/mediaUrl";
import {
  clearPlaybackProgress,
  getPlaybackProgress,
  savePlaybackProgress
} from "./playbackProgressStore";

// One shared player for the whole app (mini player, full player, lists).
// Built on expo-audio: keeps playing in the background and shows the
// sermon on the lock screen / notification with play, pause and skip.

let activePlayer = null;
let activeSubscription = null;
let activeMediaUrl = "";
let activeSermon = null;
let repeatEnabled = false;
let lastPersistBucket = -1;
let restoredForUrl = "";
let audioModeReady = false;

const listeners = new Set();

let state = {
  sermon: null,
  mediaUrl: "",
  loaded: false,
  loading: false,
  playing: false,
  positionMs: 0,
  durationMs: 0,
  repeatEnabled: false,
  error: ""
};

function emit() {
  for (const listener of listeners) {
    listener(state);
  }
}

function setState(patch) {
  state = { ...state, ...patch };
  emit();
}

function lockScreenMetadata(sermon) {
  return {
    title: sermon?.code ? `${sermon.code} ${sermon.title || ""}`.trim() : sermon?.title || "Audio Sermon",
    artist: sermon?.speaker || "Shekinah Sons Global",
    albumTitle: "Shekinah Sons Global",
    artworkUrl: sermonThumbnail(sermon, AUDIO_COVER)
  };
}

function handlePlaybackStatus(status) {
  if (!status?.isLoaded) {
    return;
  }

  const positionMs = Math.round((status.currentTime || 0) * 1000);
  const durationMs = Math.round((status.duration || 0) * 1000);

  setState({
    loaded: true,
    loading: Boolean(status.isBuffering && !status.playing),
    playing: Boolean(status.playing),
    positionMs,
    durationMs,
    error: ""
  });

  if (restoredForUrl !== activeMediaUrl) {
    restoredForUrl = activeMediaUrl;
    restoreSavedPosition(durationMs).catch(() => {});
    // Once loaded, the file's own ID3 tags replace the lock-screen text;
    // put the sermon's title, speaker and artwork back.
    try {
      activePlayer?.updateLockScreenMetadata(lockScreenMetadata(activeSermon));
    } catch {
      // Lock screen controls are best-effort.
    }
  }

  if (activeSermon) {
    persistPlaybackStatus(positionMs, durationMs).catch(() => {});
  }

  if (status.didJustFinish && !repeatEnabled) {
    setState({ playing: false });
  }
}

async function persistPlaybackStatus(positionMs, durationMs, { force = false } = {}) {
  if (!activeSermon?.id) {
    return;
  }

  if (durationMs > 0 && positionMs >= durationMs * 0.98) {
    lastPersistBucket = -1;
    await clearPlaybackProgress(activeSermon.id);
    return;
  }

  if (positionMs < 5000) {
    return;
  }

  const bucket = Math.floor(positionMs / 30000);
  if (!force && bucket <= lastPersistBucket) {
    return;
  }

  lastPersistBucket = bucket;

  await savePlaybackProgress({
    sermonId: activeSermon.id,
    title: activeSermon.title || "",
    speaker: activeSermon.speaker || "",
    type: activeSermon.type || "",
    thumbnail: activeSermon.thumbnail || activeSermon.image || "",
    positionMs,
    durationMs,
    updatedAt: new Date().toISOString()
  });
}

async function restoreSavedPosition(durationMs) {
  if (!activePlayer || !activeSermon?.id) {
    return;
  }

  const saved = await getPlaybackProgress(activeSermon.id);
  if (!saved?.positionMs) {
    lastPersistBucket = -1;
    return;
  }

  const knownDuration = durationMs || Number(saved.durationMs || 0);
  const maxPosition = knownDuration > 3000 ? knownDuration - 3000 : knownDuration;
  const target = Math.min(Math.max(0, Number(saved.positionMs || 0)), maxPosition || Number(saved.positionMs || 0));

  if (target < 5000) {
    lastPersistBucket = -1;
    return;
  }

  await activePlayer.seekTo(target / 1000);
  lastPersistBucket = Math.floor(target / 30000);
  setState({ positionMs: target });
}

async function configureAudio() {
  if (audioModeReady) return;
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: "doNotMix"
  });
  audioModeReady = true;
}

export function subscribeAudioPlayback(listener) {
  listeners.add(listener);
  listener(state);

  return () => {
    listeners.delete(listener);
  };
}

export function getAudioPlaybackState() {
  return state;
}

function resetAudioState() {
  activePlayer = null;
  activeSubscription = null;
  activeMediaUrl = "";
  activeSermon = null;
  lastPersistBucket = -1;
  restoredForUrl = "";

  setState({
    sermon: null,
    mediaUrl: "",
    loaded: false,
    loading: false,
    playing: false,
    positionMs: 0,
    durationMs: 0,
    error: ""
  });
}

export async function unloadAudio() {
  const player = activePlayer;

  if (!player) {
    resetAudioState();
    return;
  }

  try {
    await persistPlaybackStatus(state.positionMs, state.durationMs, { force: true }).catch(() => {});
    activeSubscription?.remove();
    try {
      player.pause();
      player.clearLockScreenControls();
    } catch {
      // The player may already be released.
    }
    player.remove();
  } finally {
    resetAudioState();
  }
}

export async function ensureAudio(sermon) {
  const mediaUrl = resolveMediaUrl(sermonMediaUrl(sermon));

  if (!mediaUrl) {
    throw new Error("No audio URL found.");
  }

  if (activePlayer && activeMediaUrl === mediaUrl) {
    return activePlayer;
  }

  if (activePlayer) {
    await unloadAudio();
  }

  activeSermon = sermon;
  activeMediaUrl = mediaUrl;
  restoredForUrl = "";

  setState({
    sermon,
    mediaUrl,
    loading: true,
    loaded: false,
    playing: false,
    positionMs: 0,
    durationMs: 0,
    repeatEnabled,
    error: ""
  });

  await configureAudio();

  try {
    const player = createAudioPlayer({ uri: mediaUrl }, { updateInterval: 500 });
    player.loop = repeatEnabled;
    activeSubscription = player.addListener("playbackStatusUpdate", handlePlaybackStatus);
    activePlayer = player;
    player.setActiveForLockScreen(true, lockScreenMetadata(sermon), {
      showSeekForward: true,
      showSeekBackward: true
    });
  } catch (error) {
    setState({ loading: false, error: error?.message || "Could not load this audio." });
    throw error;
  }

  return activePlayer;
}

export async function playAudio(sermon) {
  const player = await ensureAudio(sermon);
  player.play();
}

export async function pauseAudio() {
  if (!activePlayer) return;
  activePlayer.pause();
  await persistPlaybackStatus(state.positionMs, state.durationMs, { force: true }).catch(() => {});
}

export async function toggleAudio(sermon) {
  const player = await ensureAudio(sermon);

  if (player.playing) {
    player.pause();
    await persistPlaybackStatus(state.positionMs, state.durationMs, { force: true }).catch(() => {});
    return;
  }

  player.play();
}

export async function seekAudioBy(deltaMs) {
  if (!activePlayer) return;

  const durationMs = state.durationMs || Math.round((activePlayer.duration || 0) * 1000);
  const nextPosition = Math.max(0, Math.min(state.positionMs + deltaMs, durationMs || state.positionMs + deltaMs));

  await activePlayer.seekTo(nextPosition / 1000);
  setState({ positionMs: nextPosition });
}

export async function restartAudio(sermon) {
  const player = await ensureAudio(sermon);
  await player.seekTo(0);
  player.play();
}

export async function setAudioRepeat(nextValue) {
  repeatEnabled = nextValue;

  if (activePlayer) {
    activePlayer.loop = nextValue;
  }

  setState({ repeatEnabled: nextValue });
}

export async function stopAudioCompletely() {
  await unloadAudio();
}
