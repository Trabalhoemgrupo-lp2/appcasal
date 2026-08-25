export const APPEARANCE_STORAGE_KEY = "appcasal-appearance";

export const ACCENT_OPTIONS = [
  { id: "hibiscus", label: "Hibisco", swatch: "#b94759" },
  { id: "plum", label: "Ameixa", swatch: "#6e3e50" },
  { id: "sage", label: "Sálvia", swatch: "#4d7564" },
] as const;

export type AccentColor = (typeof ACCENT_OPTIONS)[number]["id"];
export type AppearanceMode = "light" | "dark" | "system";
export type ResolvedAppearance = Exclude<AppearanceMode, "system">;

export type AppearancePreference = {
  accent: AccentColor;
  mode: AppearanceMode;
};

export const defaultAppearance: AppearancePreference = {
  accent: "hibiscus",
  mode: "light",
};

function isAccentColor(value: unknown): value is AccentColor {
  return ACCENT_OPTIONS.some(option => option.id === value);
}

function isAppearanceMode(value: unknown): value is AppearanceMode {
  return value === "light" || value === "dark" || value === "system";
}

export function readAppearancePreference(
  value: string | null
): AppearancePreference {
  if (!value) return defaultAppearance;
  try {
    const parsed = JSON.parse(value) as Partial<AppearancePreference>;
    return {
      accent: isAccentColor(parsed.accent)
        ? parsed.accent
        : defaultAppearance.accent,
      mode: isAppearanceMode(parsed.mode) ? parsed.mode : defaultAppearance.mode,
    };
  } catch {
    return defaultAppearance;
  }
}

export function resolveAppearanceMode(
  mode: AppearanceMode,
  systemPrefersDark: boolean
): ResolvedAppearance {
  if (mode === "system") return systemPrefersDark ? "dark" : "light";
  return mode;
}

export function serializeAppearancePreference(
  preference: AppearancePreference
) {
  return JSON.stringify(preference);
}

type AppearanceRoot = {
  classList: { toggle: (name: string, force?: boolean) => void };
  dataset: Record<string, string | undefined>;
  style: { colorScheme: string };
};

export function applyAppearanceToDocument(
  root: AppearanceRoot,
  accent: AccentColor,
  resolvedMode: ResolvedAppearance
) {
  root.classList.toggle("dark", resolvedMode === "dark");
  root.dataset.accent = accent;
  root.style.colorScheme = resolvedMode;
}
