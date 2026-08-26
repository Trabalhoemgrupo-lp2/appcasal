import {
  applyAppearanceToDocument,
  APPEARANCE_STORAGE_KEY,
  type AccentColor,
  defaultAppearance,
  type AppearanceMode,
  readAppearancePreference,
  resolveAppearanceMode,
  serializeAppearancePreference,
} from "@/lib/appearance";
import React, { createContext, useContext, useEffect, useState } from "react";

interface ThemeContextType {
  accent: AccentColor;
  mode: AppearanceMode;
  setAccent: (accent: AccentColor) => void;
  setMode: (mode: AppearanceMode) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Extract<AppearanceMode, "light" | "dark">;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
}: ThemeProviderProps) {
  const [preference, setPreference] = useState(() => {
    if (typeof window === "undefined") {
      return { ...defaultAppearance, mode: defaultTheme };
    }
    return readAppearancePreference(
      window.localStorage.getItem(APPEARANCE_STORAGE_KEY)
    );
  });
  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false
  );
  const theme = resolveAppearanceMode(preference.mode, systemPrefersDark);

  useEffect(() => {
    applyAppearanceToDocument(document.documentElement, preference.accent, theme);
    window.localStorage.setItem(
      APPEARANCE_STORAGE_KEY,
      serializeAppearancePreference(preference)
    );
  }, [preference, theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mediaQuery) return;
    const handleChange = () => setSystemPrefersDark(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        accent: preference.accent,
        mode: preference.mode,
        setAccent: accent => setPreference(current => ({ ...current, accent })),
        setMode: mode => setPreference(current => ({ ...current, mode })),
        theme,
        toggleTheme: () =>
          setPreference(current => ({
            ...current,
            mode:
              resolveAppearanceMode(current.mode, systemPrefersDark) === "dark"
                ? "light"
                : "dark",
          })),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
