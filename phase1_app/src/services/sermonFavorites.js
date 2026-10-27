import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { STORAGE_KEYS } from "../constants/storage";

// Saved sermons, kept on the device. Each entry keeps a small snapshot so
// the Favourites list still renders if the sermon list has not loaded yet.
let favourites = {};
let loaded = false;
let loading = null;
const listeners = new Set();

function emit() {
  for (const listener of listeners) listener(favourites);
}

async function ensureLoaded() {
  if (loaded) return;
  if (!loading) {
    loading = AsyncStorage.getItem(STORAGE_KEYS.favouriteSermons)
      .then(raw => {
        const parsed = raw ? JSON.parse(raw) : {};
        favourites = parsed && typeof parsed === "object" ? parsed : {};
      })
      .catch(() => {
        favourites = {};
      })
      .finally(() => {
        loaded = true;
        emit();
      });
  }
  await loading;
}

function persist() {
  AsyncStorage.setItem(STORAGE_KEYS.favouriteSermons, JSON.stringify(favourites)).catch(() => {});
}

export async function toggleSermonFavourite(sermon) {
  if (!sermon?.id) return false;
  await ensureLoaded();

  const next = { ...favourites };
  let saved;
  if (next[sermon.id]) {
    delete next[sermon.id];
    saved = false;
  } else {
    next[sermon.id] = {
      id: sermon.id,
      type: sermon.type,
      code: sermon.code || "",
      title: sermon.title || "",
      speaker: sermon.speaker || "",
      date: sermon.date || sermon.sermonDate || "",
      thumbnail: sermon.thumbnail || sermon.thumbnailUrl || sermon.image || "",
      mediaUrl: sermon.mediaUrl || "",
      savedAt: new Date().toISOString()
    };
    saved = true;
  }

  favourites = next;
  persist();
  emit();
  return saved;
}

export function useSermonFavourites() {
  const [state, setState] = useState(favourites);

  useEffect(() => {
    listeners.add(setState);
    ensureLoaded().then(() => setState(favourites));
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return {
    favourites: state,
    isFavourite: id => Boolean(id && state[id]),
    // Newest saved first.
    list: Object.values(state).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)))
  };
}
