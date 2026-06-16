import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeMode = "dark" | "light";
export type ThemePalette =
  | "amber"
  | "indigo"
  | "emerald"
  | "ocean"
  | "sunset"
  | "noir"
  | "plum";

type ThemeContextValue = {
  mode: ThemeMode;
  palette: ThemePalette;
  setMode: (mode: ThemeMode) => void;
  setPalette: (palette: ThemePalette) => void;
  toggleTheme: () => void;
};

const MODE_KEY = "shekinah.admin.theme";
const PALETTE_KEY = "shekinah.admin.palette";

export const ADMIN_PALETTES: { id: ThemePalette; label: string; swatch: string; description: string }[] = [
  { id: "amber",   label: "Burnt Amber",     swatch: "#c2410c", description: "Warm editorial default" },
  { id: "indigo",  label: "Midnight Indigo", swatch: "#4f46e5", description: "Cool, modern, focused" },
  { id: "emerald", label: "Emerald",         swatch: "#0d7a5f", description: "Calm, premium, trustworthy" },
  { id: "ocean",   label: "Deep Ocean",      swatch: "#2d8a9e", description: "Cool blues, professional" },
  { id: "sunset",  label: "Sunset",          swatch: "#e84393", description: "Vivid, energetic" },
  { id: "noir",    label: "Noir Gold",       swatch: "#c9a84c", description: "Editorial, luxurious" },
  { id: "plum",    label: "Plum",            swatch: "#7c3aed", description: "Rich and unconventional" }
];

const PALETTE_IDS: string[] = ADMIN_PALETTES.map(p => p.id);

function readMode(): ThemeMode {
  if (typeof window === "undefined") return "light";
  return window.localStorage.getItem(MODE_KEY) === "dark" ? "dark" : "light";
}

function readPalette(): ThemePalette {
  if (typeof window === "undefined") return "amber";
  const raw = window.localStorage.getItem(PALETTE_KEY);
  return PALETTE_IDS.includes(raw || "") ? (raw as ThemePalette) : "amber";
}

function applyMode(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode;
}

function applyPalette(palette: ThemePalette) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.palette = palette;
}

// Apply immediately at module load so the first paint already has the
// correct theme + palette — no flash, and it survives provider remounts
// after login / logout / route switches.
if (typeof window !== "undefined") {
  applyMode(readMode());
  applyPalette(readPalette());
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "light",
  palette: "amber",
  setMode: () => {},
  setPalette: () => {},
  toggleTheme: () => {}
});

export function AdminThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readMode());
  const [palette, setPaletteState] = useState<ThemePalette>(() => readPalette());

  useLayoutEffect(() => {
    applyMode(mode);
    if (typeof window !== "undefined") window.localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  useLayoutEffect(() => {
    applyPalette(palette);
    if (typeof window !== "undefined") window.localStorage.setItem(PALETTE_KEY, palette);
  }, [palette]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      palette,
      setMode: (next: ThemeMode) => {
        applyMode(next);
        if (typeof window !== "undefined") window.localStorage.setItem(MODE_KEY, next);
        setModeState(next);
      },
      setPalette: (next: ThemePalette) => {
        applyPalette(next);
        if (typeof window !== "undefined") window.localStorage.setItem(PALETTE_KEY, next);
        setPaletteState(next);
      },
      toggleTheme: () =>
        setModeState(current => {
          const next: ThemeMode = current === "light" ? "dark" : "light";
          applyMode(next);
          if (typeof window !== "undefined") window.localStorage.setItem(MODE_KEY, next);
          return next;
        })
    }),
    [mode, palette]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAdminTheme() {
  return useContext(ThemeContext);
}
