import type { Settings } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  scanIntervalMinutes: 15,
  historyWindowDays: 365,
  maxLogEntries: 250,
  onboardingComplete: false,
  theme: "light",
};

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

export function normalizeSettings(value: Partial<Settings> = {}): Settings {
  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : DEFAULT_SETTINGS.enabled,
    scanIntervalMinutes: boundedInteger(value.scanIntervalMinutes, DEFAULT_SETTINGS.scanIntervalMinutes, 1, 1_440),
    historyWindowDays: boundedInteger(value.historyWindowDays, DEFAULT_SETTINGS.historyWindowDays, 1, 3_650),
    maxLogEntries: boundedInteger(value.maxLogEntries, DEFAULT_SETTINGS.maxLogEntries, 10, 5_000),
    onboardingComplete: typeof value.onboardingComplete === "boolean" ? value.onboardingComplete : DEFAULT_SETTINGS.onboardingComplete,
    theme: value.theme === "dark" || value.theme === "light" ? value.theme : DEFAULT_SETTINGS.theme,
  };
}

export const STORAGE_KEYS = {
  rules: "rules",
  settings: "settings",
  activity: "activity",
  diagnostics: "diagnostics",
  lastScan: "lastScan",
  password: "password",
  authThrottle: "authThrottle",
  categoryOverrides: "categoryOverrides",
  categoryRejections: "categoryRejections",
  protectedDomains: "protectedDomains",
  defaultCategoryRulesVersion: "defaultCategoryRulesVersion",
  pendingChangelogVersion: "pendingChangelogVersion",
} as const;

export const SESSION_KEYS = {
  unlocked: "sessionUnlocked",
  dashboardTabId: "dashboardTabId",
} as const;
