export const THEME_STORAGE_KEY = "livepad.theme";
export const LEGACY_THEME_KEY = "lp-theme";

export type Theme = "light" | "dark";

const THEME_CHANGE = "livepad:theme-change";

export function readStoredTheme(): Theme {
  if (typeof localStorage === "undefined") return "dark";
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  const legacy = localStorage.getItem(LEGACY_THEME_KEY);
  if (legacy === "light" || legacy === "dark") {
    localStorage.setItem(THEME_STORAGE_KEY, legacy);
    return legacy;
  }
  return "dark";
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  window.dispatchEvent(new Event(THEME_CHANGE));
}

export function getAppliedTheme(): Theme {
  const attr = document.documentElement.dataset.theme;
  return attr === "light" ? "light" : "dark";
}

export function toggleTheme(): Theme {
  const next: Theme = getAppliedTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}

export function subscribeTheme(onChange: () => void) {
  const handler = () => onChange();
  window.addEventListener(THEME_CHANGE, handler);
  return () => window.removeEventListener(THEME_CHANGE, handler);
}

export function themeToggleLabel(current: Theme): string {
  return current === "dark" ? "Переключить на светлую" : "Переключить на тёмную";
}
