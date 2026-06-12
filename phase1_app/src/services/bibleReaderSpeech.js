import * as Speech from "expo-speech";

const LANGUAGE_BY_VERSION = {
  eng_msb: "en-US",
  swh_neno: "sw-KE",
  engmsb: "en-US",
  swhonen: "sw-KE",
  kik: "ki",
  luo: "luo"
};

let speaking = false;
let stopListener = null;

export function isBibleSpeechActive() {
  return speaking;
}

export async function stopBibleSpeech() {
  stopListener?.();
  stopListener = null;
  speaking = false;
  await Speech.stop();
}

export function bibleSpeechLanguage(versionId) {
  const key = String(versionId || "").trim().toLowerCase();
  return LANGUAGE_BY_VERSION[key] || key.slice(0, 2) || "en";
}

export function speakBibleText({
  text,
  versionId,
  rate = 0.92,
  pitch = 1,
  onStart,
  onDone,
  onStopped,
  onError
}) {
  const nextText = String(text || "").trim();
  if (!nextText) {
    onError?.(new Error("No Bible text available to read."));
    return;
  }

  stopListener?.();
  stopListener = null;
  speaking = false;
  Speech.stop();

  const handleFinish = callback => () => {
    speaking = false;
    stopListener = null;
    callback?.();
  };

  stopListener = handleFinish(onStopped);

  Speech.speak(nextText, {
    language: bibleSpeechLanguage(versionId),
    rate,
    pitch,
    onStart: () => {
      speaking = true;
      onStart?.();
    },
    onDone: handleFinish(onDone),
    onStopped: handleFinish(onStopped),
    onError: error => {
      speaking = false;
      stopListener = null;
      onError?.(error instanceof Error ? error : new Error("Bible audio reader failed."));
    }
  });
}
