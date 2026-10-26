import React, { createContext, useContext } from "react";
import { StatusBar, StyleSheet } from "react-native";

export const THEME_OPTIONS = [
  { key: "dark", label: "Dark" },
  { key: "light", label: "Light" }
];

export const THEME_PALETTE_OPTIONS = [
  {
    key: "shekinah",
    label: "Shekinah Gold",
    description: "Black and white with Shekinah gold, blue highlights and red for live moments",
    swatches: ["#000000", "#D4AF37", "#4A8BFF"]
  }
];

export const DEFAULT_APP_THEME = "dark";
export const DEFAULT_APP_THEME_PALETTE = "shekinah";

// Font families registered in AppShell. Each weight is its own family on
// Android, so styles pick a family instead of setting fontWeight.
export const FONTS = {
  body: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  brand: "Cinzel_700Bold",
  brandSoft: "Cinzel_600SemiBold",
  scripture: "PlayfairDisplay_500Medium_Italic"
};

export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };
export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

// Color roles (modelled on how Phaneroo uses its green):
//   gold   -> the dominant brand colour: primary buttons, icons, brand marks
//   accent -> blue highlights only: active tab, selected pills, tags, progress
//   red    -> live, badges and favourites
//   neutrals -> true black with neutral (not tinted) greys
const SHARED_FONTS = {
  fontDisplay: FONTS.bold,
  fontBody: FONTS.body,
  fontBold: FONTS.semibold,
  fontMedium: FONTS.medium,
  fontBrand: FONTS.brand,
  fontScripture: FONTS.scripture
};

const PALETTES = {
  shekinah: {
    dark: {
      background: "#000000",
      backgroundElevated: "#0B0B0B",
      surface: "#141414",
      surface2: "#1E1E1E",
      surface3: "#2A2A2A",
      card: "#161616",
      line: "#1F1F1F",
      lineStrong: "#2C2C2C",
      white: "#FFFFFF",
      black: "#000000",
      text: "#FFFFFF",
      muted: "#A6A6A6",
      faint: "#6B6B6B",
      textOnAccent: "#1A1405",
      textOnBrand: "#FFFFFF",
      gold: "#D4AF37",
      gold2: "#F0D27A",
      goldDeep: "#A8841F",
      goldSoft: "rgba(212, 175, 55, 0.14)",
      blue: "#1A1A1A",
      blue2: "#262626",
      accent: "#4A8BFF",
      accentPressed: "#2F6FE6",
      accentSoft: "rgba(74, 139, 255, 0.16)",
      accentText: "#6EA2FF",
      red: "#E53935",
      redSoft: "rgba(229, 57, 53, 0.16)",
      green: "#43A047",
      overlay: "rgba(0, 0, 0, 0.62)",
      scrim: "rgba(0, 0, 0, 0.62)",
      ...SHARED_FONTS
    },

    light: {
      background: "#FFFFFF",
      backgroundElevated: "#FFFFFF",
      surface: "#F5F5F5",
      surface2: "#EDEDED",
      surface3: "#E0E0E0",
      card: "#F7F7F7",
      line: "#EBEBEB",
      lineStrong: "#DCDCDC",
      white: "#111111",
      black: "#000000",
      text: "#111111",
      muted: "#5F5F5F",
      faint: "#8F8F8F",
      textOnAccent: "#1A1405",
      textOnBrand: "#FFFFFF",
      gold: "#B08A1E",
      gold2: "#D4AF37",
      goldDeep: "#8A6B12",
      goldSoft: "rgba(176, 138, 30, 0.12)",
      blue: "#F2F2F2",
      blue2: "#E6E6E6",
      accent: "#1F63E0",
      accentPressed: "#174FB8",
      accentSoft: "rgba(31, 99, 224, 0.10)",
      accentText: "#1F63E0",
      red: "#D32F2F",
      redSoft: "rgba(211, 47, 47, 0.10)",
      green: "#2E7D32",
      overlay: "rgba(0, 0, 0, 0.55)",
      scrim: "rgba(0, 0, 0, 0.45)",
      ...SHARED_FONTS
    }
  }
};

// Metallic gold stops (hairlines, featured borders).
export const GOLD_GRADIENT = ["#F0D27A", "#D4AF37", "#A8841F"];

let currentMode = DEFAULT_APP_THEME;
let currentPalette = DEFAULT_APP_THEME_PALETTE;
let currentColors = PALETTES[currentPalette][currentMode];

const listeners = new Set();

export const ThemeContext = createContext({
  mode: DEFAULT_APP_THEME,
  palette: DEFAULT_APP_THEME_PALETTE,
  setMode: () => {},
  setPalette: () => {},
  toggleTheme: () => {}
});

export function useAppTheme() {
  return useContext(ThemeContext);
}

export function getThemeColors() {
  return currentColors;
}

export function getThemeMode() {
  return currentMode;
}

export function getThemePalette() {
  return currentPalette;
}

export function subscribeTheme(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function normalizeMode(mode) {
  return mode === "light" ? "light" : "dark";
}

function normalizePalette() {
  return DEFAULT_APP_THEME_PALETTE;
}

export function setThemeMode(mode, palette = DEFAULT_APP_THEME_PALETTE) {
  const nextMode = normalizeMode(mode);
  const nextPalette = normalizePalette(palette);

  currentMode = nextMode;
  currentPalette = nextPalette;
  currentColors = PALETTES[nextPalette][nextMode];

  listeners.forEach(listener => listener(currentColors, currentMode, currentPalette));
}

export function setThemePalette() {
  setThemeMode(currentMode, DEFAULT_APP_THEME_PALETTE);
}

export const C = new Proxy(
  {},
  {
    get(_target, prop) {
      return currentColors[prop] ?? PALETTES[DEFAULT_APP_THEME_PALETTE].dark[prop];
    }
  }
);

export function makeThemedStyles(factory) {
  let styles = StyleSheet.create(factory(currentColors));

  subscribeTheme(colors => {
    styles = StyleSheet.create(factory(colors));
  });

  return new Proxy(
    {},
    {
      get(_target, prop) {
        return styles[prop];
      }
    }
  );
}

export const ANDROID_STATUS_BAR_HEIGHT = StatusBar.currentHeight || 0;
