import { useSyncExternalStore } from "react";
import { IconButton } from "./ui/IconButton";
import {
  getAppliedTheme,
  subscribeTheme,
  themeToggleAriaLabel,
  themeToggleTooltip,
  toggleTheme,
  type Theme,
} from "../lib/theme";

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 14.5A8.5 8.5 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribeTheme, getAppliedTheme, (): Theme => "dark");
  return (
    <IconButton
      className={className}
      label={themeToggleAriaLabel(theme)}
      tooltip={themeToggleTooltip(theme)}
      aria-pressed={theme === "dark"}
      onClick={() => toggleTheme()}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </IconButton>
  );
}
