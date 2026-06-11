import { Audio } from "expo-av";

import {
  resolveMediaUrl,
  sermonMediaUrl
} from "../utils/mediaUrl";
import {
  clearPlaybackProgress,
  getPlaybackProgress,
  savePlaybackProgress
} from "./playbackProgressStore";

let activeSound = null;
let activeMediaUrl = "";
let activeSermon = null;
let repeatEnabled = false;
let lastPersistBucket = -1;

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

function handlePlaybackStatus(status) {
  if (!status.isLoaded) {
    if (status.error) {
      setState({ error: status.error });
    }
    return;
  }

  setState({
    loaded: true,
    loading: false,
    playing: Boolean(status.isPlaying),
    positionMs: status.positionMillis || 0,
    durationMs: status.durationMillis || 0,
    error: ""
  });

  if (activeSermon) {
    persistPlaybackStatus(status).catch(() => {});
  }

  if (status.didJustFinish && !repeatEnabled) {
    setState({ playing: false });
  }
}

async function persistPlaybackStatus(status, { force = false } = {}) {
  if (!activeSermon?.id || !status?.isLoaded) {
    return;
  }

  const positionMs = Math.max(0, Number(status.positionMillis || 0));
  const durationMs = Math.max(0, Number(status.durationMillis || 0));

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

async function restoreSavedPosition(sound, sermon) {
  if (!sound || !sermon?.id) {
    return;
  }

  const saved = await getPlaybackProgress(sermon.id);
  if (!saved?.positionMs) {
    lastPersistBucket = -1;
    return;
  }

  const status = await sound.getStatusAsync();
  if (!status.isLoaded) {
    return;
  }

  const durationMs = Math.max(0, Number(status.durationMillis || saved.durationMs || 0));
  const maxPosition = durationMs > 3000 ? durationMs - 3000 : durationMs;
  const targetPosition = Math.min(Math.max(0, Number(saved.positionMs || 0)), maxPosition || Number(saved.positionMs || 0));

  if (targetPosition < 5000) {
    lastPersistBucket = -1;
    return;
  }

  await sound.setPositionAsync(targetPosition);
  lastPersistBucket = Math.floor(targetPosition / 30000);

  setState({
    positionMs: targetPosition,
    durationMs: durationMs || state.durationMs
  });
}

async function configureAudio() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    staysActiveInBackground: true,
    playsInSilentModeIOS: true,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false
  });
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
  activeSound = null;
  activeMediaUrl = "";
  activeSermon = null;
  lastPersistBucket = -1;

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
  const sound = activeSound;

  if (!sound) {
    resetAudioState();
    return;
  }

  try {
    sound.setOnPlaybackStatusUpdate(null);

    const status = await sound.getStatusAsync().catch(() => null);

    if (status?.isLoaded) {
      await persistPlaybackStatus(status, { force: true }).catch(() => {});

      if (status.isPlaying) {
        await sound.pauseAsync().catch(() => {});
      }

      await sound.stopAsync().catch(() => {});
    }

    await sound.unloadAsync().catch(() => {});
  } finally {
    resetAudioState();

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false
    }).catch(() => {});
  }
}

export async function ensureAudio(sermon) {
  const rawUrl = sermonMediaUrl(sermon);
  const mediaUrl = resolveMediaUrl(rawUrl);

  if (!mediaUrl) {
    throw new Error("No audio URL found.");
  }

  if (activeSound && activeMediaUrl === mediaUrl) {
    activeSound.setOnPlaybackStatusUpdate(handlePlaybackStatus);
    return activeSound;
  }

  if (activeSound && activeMediaUrl !== mediaUrl) {
    await unloadAudio();
  }

  activeSermon = sermon;
  activeMediaUrl = mediaUrl;

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

  const { sound } = await Audio.Sound.createAsync(
    { uri: mediaUrl },
    {
      shouldPlay: false,
      isLooping: repeatEnabled,
      progressUpdateIntervalMillis: 500
    },
    handlePlaybackStatus
  );

  activeSound = sound;

  await restoreSavedPosition(sound, sermon).catch(() => {});

  setState({
    sermon: activeSermon,
    mediaUrl: activeMediaUrl,
    loaded: true,
    loading: false
  });

  return sound;
}

export async function playAudio(sermon) {
  const sound = await ensureAudio(sermon);
  await sound.playAsync();
}

export async function pauseAudio() {
  if (!activeSound) return;
  await activeSound.pauseAsync();
  const status = await activeSound.getStatusAsync().catch(() => null);
  if (status?.isLoaded) {
    await persistPlaybackStatus(status, { force: true }).catch(() => {});
  }
}

export async function toggleAudio(sermon) {
  const sound = await ensureAudio(sermon);
  const status = await sound.getStatusAsync();

  if (status.isLoaded && status.isPlaying) {
    await sound.pauseAsync();
    const pausedStatus = await sound.getStatusAsync().catch(() => null);
    if (pausedStatus?.isLoaded) {
      await persistPlaybackStatus(pausedStatus, { force: true }).catch(() => {});
    }
    return;
  }

  await sound.playAsync();
}

export async function seekAudioBy(deltaMs) {
  if (!activeSound) return;

  const status = await activeSound.getStatusAsync();
  if (!status.isLoaded) return;

  const nextPosition = Math.max(
    0,
    Math.min((status.positionMillis || 0) + deltaMs, status.durationMillis || 0)
  );

  await activeSound.setPositionAsync(nextPosition);
}

export async function restartAudio(sermon) {
  const sound = await ensureAudio(sermon);
  await sound.setPositionAsync(0);
  await sound.playAsync();
}

export async function setAudioRepeat(nextValue) {
  repeatEnabled = nextValue;

  if (activeSound) {
    await activeSound.setIsLoopingAsync(nextValue);
  }

  setState({ repeatEnabled: nextValue });
}

export async function stopAudioCompletely() {
  await unloadAudio();
}
