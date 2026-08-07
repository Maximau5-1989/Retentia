import { describe, expect, it } from "vitest";
import { createBackup, parseBackup } from "./backup";
import { DEFAULT_SETTINGS } from "./defaults";
import type { RetentionRule } from "./types";

describe("Retentia backups", () => {
  const backup = createBackup({ appVersion: "1.4.0", rules: [], settings: DEFAULT_SETTINGS, categoryOverrides: { "example.com": "news" }, protectedDomains: ["bank.example"] });

  it("round-trips privacy-safe configuration", () => {
    expect(parseBackup(JSON.stringify(backup))).toEqual(backup);
    expect(backup).not.toHaveProperty("activity");
    expect(backup).not.toHaveProperty("password");
    expect(backup).not.toHaveProperty("history");
  });

  it("rejects unsupported files", () => {
    expect(() => parseBackup('{"format":"other"}')).toThrow("supported Retentia backup");
  });

  it("preserves immediate-deletion rules", () => {
    const immediateRule: RetentionRule = {
      id: "immediate",
      name: "Private portal",
      kind: "domain",
      pattern: "private.example",
      duration: 1,
      unit: "days",
      enabled: true,
      deleteImmediately: true,
      priority: 50,
      createdAt: 1,
    };
    const immediateBackup = createBackup({
      appVersion: backup.appVersion,
      rules: [immediateRule],
      settings: backup.settings,
      categoryOverrides: backup.categoryOverrides,
      protectedDomains: backup.protectedDomains,
    });
    expect(parseBackup(JSON.stringify(immediateBackup)).rules[0].deleteImmediately).toBe(true);
  });
});
