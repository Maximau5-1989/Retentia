import type { Settings } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  scanIntervalMinutes: 15,
  historyWindowDays: 365,
  maxLogEntries: 250,
  onboardingComplete: false,
  theme: "light",
};

export const STORAGE_KEYS = {
  rules: "rules",
  settings: "settings",
  activity: "activity",
  lastScan: "lastScan",
  password: "password",
  authThrottle: "authThrottle",
  categoryOverrides: "categoryOverrides",
} as const;

export const SESSION_KEYS = {
  unlocked: "sessionUnlocked",
  dashboardTabId: "dashboardTabId",
} as const;
