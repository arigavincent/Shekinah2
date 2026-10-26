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
    description: "True black, sapphire blue highlights, and the gold of the Shekinah dove",
    swatches: ["#07080A", "#3D7BFF", "#D4A537"]
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
  brandSoft: "Cinzel_600SemiBold"
};

export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 };
export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

// Color roles:
//   gold   -> brand moments (logo, featured, section accents)
//   accent -> anything tappable or active (tabs, links, progress, play)
//   white/text -> content
const SHARED_FONTS = {
  fontDisplay: FONTS.bold,
  fontBody: FONTS.body,
  fontBold: FONTS.semibold,
  fontMedium: FONTS.medium,
  fontBrand: FONTS.brand
};

const PALETTES = {
  shekinah: {
    dark: {
      background: "#07080A",
      backgroundElevated: "#0D0F13",
      surface: "#12151A",
      surface2: "#1A1E25",
      surface3: "#232832",
      card: "#12151A",
      line: "#20252E",
      lineStrong: "#2C323D",
      white: "#F5F3EE",
      black: "#07080A",
      text: "#F5F3EE",
      muted: "#A3A7B0",
      faint: "#6E7380",
      textOnAccent: "#1A1205",
      textOnBrand: "#FFFFFF",
      gold: "#D4A537",
      gold2: "#F1D48A",
      goldDeep: "#8A6519",
      goldSoft: "rgba(212, 165, 55, 0.14)",
      blue: "#0E1F45",
      blue2: "#16306B",
      accent: "#3D7BFF",
      accentPressed: "#2E63D6",
      accentSoft: "rgba(61, 123, 255, 0.16)",
      accentText: "#8FB3FF",
      red: "#E5484D",
      green: "#3FB950",
      overlay: "rgba(7, 8, 10, 0.72)",
      scrim: "rgba(0, 0, 0, 0.6)",
      ...SHARED_FONTS
    },

    light: {
      background: "#F7F5F0",
      backgroundElevated: "#FFFFFF",
      surface: "#FFFFFF",
      surface2: "#EFEBE2",
      surface3: "#E4DFD3",
      card: "#FFFFFF",
      line: "#E2DCCF",
      lineStrong: "#CFC7B6",
      white: "#12151C",
      black: "#0B0D12",
      text: "#12151C",
      muted: "#5D6370",
      faint: "#8D929C",
      textOnAccent: "#1A1205",
      textOnBrand: "#FFFFFF",
      gold: "#A87A12",
      gold2: "#D4A537",
      goldDeep: "#7A570C",
      goldSoft: "rgba(168, 122, 18, 0.12)",
      blue: "#0E1F45",
      blue2: "#16306B",
      accent: "#1F5BE0",
      accentPressed: "#1847B3",
      accentSoft: "rgba(31, 91, 224, 0.10)",
      accentText: "#1F5BE0",
      red: "#C9353A",
      green: "#1F8A3B",
      overlay: "rgba(255, 255, 255, 0.86)",
      scrim: "rgba(0, 0, 0, 0.45)",
      ...SHARED_FONTS
    }
  }
};

// Brand gradient stops for gold accents (hairlines, featured borders).
export const GOLD_GRADIENT = ["#F1D48A", "#D4A537", "#8A6519"];

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
