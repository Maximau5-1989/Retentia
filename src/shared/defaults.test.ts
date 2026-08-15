import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, normalizeSettings } from "./defaults";

describe("settings normalization", () => {
  it("preserves valid settings", () => {
    expect(normalizeSettings({ ...DEFAULT_SETTINGS, theme: "dark" })).toEqual({
      ...DEFAULT_SETTINGS,
      theme: "dark",
    });
  });

  it("ignores the removed legacy password bypass", () => {
    const legacySettings = { ...DEFAULT_SETTINGS, testingBypassPassword: true } as Partial<typeof DEFAULT_SETTINGS>;
    expect(normalizeSettings(legacySettings)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings(legacySettings)).not.toHaveProperty("testingBypassPassword");
  });

  it("repairs invalid and out-of-range numeric settings", () => {
    expect(normalizeSettings({ scanIntervalMinutes: 0, historyWindowDays: 99_999, maxLogEntries: Number.NaN })).toMatchObject({
      scanIntervalMinutes: 1,
      historyWindowDays: 3_650,
      maxLogEntries: DEFAULT_SETTINGS.maxLogEntries,
    });
  });

  it("rounds numeric settings to integers", () => {
    expect(normalizeSettings({ scanIntervalMinutes: 14.6, historyWindowDays: 10.4, maxLogEntries: 249.7 })).toMatchObject({
      scanIntervalMinutes: 15,
      historyWindowDays: 10,
      maxLogEntries: 250,
    });
  });
});
