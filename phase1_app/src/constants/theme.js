import React, { createContext, useContext } from "react";
import { StatusBar, StyleSheet } from "react-native";

export const THEME_OPTIONS = [
  { key: "dark", label: "Dark" },
  { key: "light", label: "Light" }
];

export const DEFAULT_APP_THEME = "dark";

const PALETTES = {
  dark: {
    background: "#000000",
    backgroundElevated: "#080808",
    surface: "#101010",
    surface2: "#181818",
    card: "#101010",
    line: "#252525",
    white: "#FFFFFF",
    black: "#000000",
    text: "#FFFFFF",
    muted: "#A7A7A7",
    faint: "#666666",
    textOnAccent: "#000000",
    textOnBrand: "#FFFFFF",
    gold: "#D8A634",
    gold2: "#F0C766",
    blue: "#092B57",
    blue2: "#123F77",
    red: "#F13B3B",
    green: "#43B66F"
  },
  light: {
    background: "#F7F3EA",
    backgroundElevated: "#EFE6D5",
    surface: "#FFFFFF",
    surface2: "#F2E9D9",
    card: "#FFFFFF",
    line: "#D7C7A8",
    white: "#1A1712",
    black: "#111111",
    text: "#1A1712",
    muted: "#665A45",
    faint: "#8C7E67",
    textOnAccent: "#111111",
    textOnBrand: "#FFFFFF",
    gold: "#C18C18",
    gold2: "#E2B54B",
    blue: "#163D72",
    blue2: "#245189",
    red: "#C23B3B",
    green: "#2F8E58"
  }
};

let currentMode = DEFAULT_APP_THEME;
let currentColors = PALETTES[currentMode];

const listeners = new Set();

export const ThemeContext = createContext({
  mode: DEFAULT_APP_THEME,
  setMode: () => {},
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

export function subscribeTheme(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setThemeMode(mode) {
  const nextMode = mode === "light" ? "light" : "dark";
  currentMode = nextMode;
  currentColors = PALETTES[nextMode];
  listeners.forEach(listener => listener(currentColors, currentMode));
}

export const C = new Proxy(
  {},
  {
    get(_target, prop) {
      return currentColors[prop] ?? PALETTES.dark[prop];
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
