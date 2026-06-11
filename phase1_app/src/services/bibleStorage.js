import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "shekinah:bible:v1";

export const DEFAULT_BIBLE_STATE = {
  bookmarks: [],
  highlights: [],
  notes: {},
  recent: [],
  preferences: {
    readingMode: "parallel",
    fontScaleIndex: 1,
    installedVersions: ["eng_msb", "swh_neno"],
    selectedVersionId: "eng_msb"
  }
};

function normalizeBibleState(value) {
  if (!value || typeof value !== "object") {
    return DEFAULT_BIBLE_STATE;
  }

  return {
    bookmarks: Array.isArray(value.bookmarks) ? value.bookmarks : [],
    highlights: Array.isArray(value.highlights) ? value.highlights : [],
    notes: value.notes && typeof value.notes === "object" ? value.notes : {},
    recent: Array.isArray(value.recent) ? value.recent : [],
    preferences:
      value.preferences && typeof value.preferences === "object"
        ? {
            ...DEFAULT_BIBLE_STATE.preferences,
            ...value.preferences,
            installedVersions: Array.isArray(value.preferences.installedVersions)
              ? value.preferences.installedVersions
              : DEFAULT_BIBLE_STATE.preferences.installedVersions,
            selectedVersionId:
              typeof value.preferences.selectedVersionId === "string" &&
              value.preferences.selectedVersionId.trim()
                ? value.preferences.selectedVersionId.trim()
                : DEFAULT_BIBLE_STATE.preferences.selectedVersionId
          }
        : DEFAULT_BIBLE_STATE.preferences
  };
}

export async function loadBibleState() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return DEFAULT_BIBLE_STATE;
    }

    return normalizeBibleState(JSON.parse(raw));
  } catch {
    return DEFAULT_BIBLE_STATE;
  }
}

export async function saveBibleState(state) {
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(normalizeBibleState(state))
  );
}

export async function clearBibleState() {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
