import React, { createContext, useContext } from "react";
import { StatusBar, StyleSheet } from "react-native";

export const THEME_OPTIONS = [
  { key: "dark", label: "Dark" },
  { key: "light", label: "Light" }
];

export const THEME_PALETTE_OPTIONS = [
  {
    key: "memorial",
    label: "Memorial Gold",
    description: "Warm ivory, deep navy, champagne gold",
    swatches: ["#FBFAF7", "#FFFFFF", "#D9A21B"]
  }
];

export const DEFAULT_APP_THEME = "dark";
export const DEFAULT_APP_THEME_PALETTE = "memorial";

const PALETTES = {
  memorial: {
    dark: {
      background: "#03060D",
      backgroundElevated: "#07101E",
      surface: "#0B1628",
      surface2: "#111E33",
      card: "#0B1628",
      line: "#243149",
      white: "#F8FAFC",
      black: "#03060D",
      text: "#F8FAFC",
      muted: "#A9B3C4",
      faint: "#6F7D91",
      textOnAccent: "#111827",
      textOnBrand: "#FFFFFF",
      gold: "#D8A634",
      gold2: "#E8C264",
      goldSoft: "rgba(216, 166, 52, 0.14)",
      blue: "#071427",
      blue2: "#123F77",
      red: "#D65A5A",
      green: "#5C9A72",
      fontDisplay: "Roboto_700Bold",
      fontBody: "Roboto_400Regular",
      fontBold: "Roboto_900Black"
    },

    light: {
      background: "#FBFAF7",
      backgroundElevated: "#F7F3EA",
      surface: "#FFFFFF",
      surface2: "#F6F1E8",
      card: "#FFFFFF",
      line: "#E8DFD2",
      white: "#111827",
      black: "#111827",
      text: "#111827",
      muted: "#6B7280",
      faint: "#9CA3AF",
      textOnAccent: "#111827",
      textOnBrand: "#FFFFFF",
      gold: "#D9A21B",
      gold2: "#C89113",
      goldSoft: "rgba(217, 162, 27, 0.12)",
      blue: "#111827",
      blue2: "#1F2937",
      red: "#A43C3C",
      green: "#536B4B",
      fontDisplay: "Roboto_700Bold",
      fontBody: "Roboto_400Regular",
      fontBold: "Roboto_900Black"
    }
  }
};

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
