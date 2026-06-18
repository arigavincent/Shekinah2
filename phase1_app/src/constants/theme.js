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
    description: "Premium black, warm ivory, bronze, and church gold",
    swatches: ["#050505", "#FBF6E8", "#D8A634"]
  }
];

export const DEFAULT_APP_THEME = "dark";
export const DEFAULT_APP_THEME_PALETTE = "memorial";

const PALETTES = {
  memorial: {
    dark: {
      background: "#050505",
      backgroundElevated: "#0A0A09",
      surface: "#10100E",
      surface2: "#171613",
      card: "#10100E",
      line: "#2E281B",
      white: "#F2EFE8",
      black: "#050505",
      text: "#F2EFE8",
      muted: "#A8A08F",
      faint: "#746D60",
      textOnAccent: "#171109",
      textOnBrand: "#FFFFFF",
      gold: "#C99A2E",
      gold2: "#D7B35A",
      goldSoft: "rgba(201, 154, 46, 0.12)",
      blue: "#14120E",
      blue2: "#211B12",
      red: "#C95555",
      green: "#9C7930",
      fontDisplay: "Roboto_700Bold",
      fontBody: "Roboto_400Regular",
      fontBold: "Roboto_900Black"
    },

    light: {
      background: "#FBF6E8",
      backgroundElevated: "#F3E8CF",
      surface: "#FFFDF6",
      surface2: "#F6EBD2",
      card: "#FFFDF6",
      line: "#D8C391",
      white: "#2B2110",
      black: "#1B1305",
      text: "#2B2110",
      muted: "#776846",
      faint: "#A18F62",
      textOnAccent: "#1B1305",
      textOnBrand: "#FFFFFF",
      gold: "#B8860B",
      gold2: "#D9A21B",
      goldSoft: "rgba(184, 134, 11, 0.14)",
      blue: "#3A2E18",
      blue2: "#5C481F",
      red: "#A43C3C",
      green: "#9B741C",
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
