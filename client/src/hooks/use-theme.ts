import { useEffect } from "react";
import { create } from "zustand";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "theme"; // also read by the inline script in index.html
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // storage blocked (private mode etc.) — fall back to system
  }
  return "system";
}

function applyTheme(theme: Theme) {
  const isDark = theme === "dark" || (theme === "system" && darkQuery.matches);
  document.documentElement.classList.toggle("dark", isDark);
}

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: readStoredTheme(),
  setTheme: (theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // not persisted, still applied for this session
    }
    set({ theme });
  },
}));

/** Mount once (App) — keeps the <html> class in sync with the chosen theme and the OS. */
export function useApplyTheme() {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const onChange = () => applyTheme("system");
    darkQuery.addEventListener("change", onChange);
    return () => darkQuery.removeEventListener("change", onChange);
  }, [theme]);
}
