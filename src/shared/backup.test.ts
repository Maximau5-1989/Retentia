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

  it("never exports or restores an active password bypass", () => {
    const testingBackup = createBackup({
      appVersion: backup.appVersion,
      rules: [],
      settings: { ...backup.settings, testingBypassPassword: true },
      categoryOverrides: {},
      protectedDomains: [],
    });
    expect(testingBackup.settings.testingBypassPassword).toBe(false);
    const tampered = { ...testingBackup, settings: { ...testingBackup.settings, testingBypassPassword: true } };
    expect(parseBackup(JSON.stringify(tampered)).settings.testingBypassPassword).toBe(false);
  });

  it("rejects unsupported files", () => {
    expect(() => parseBackup('{"format":"other"}')).toThrow("supported Retentia backup");
  });

  it("rejects unsafe numeric settings instead of restoring them", () => {
    const invalid = { ...backup, settings: { ...backup.settings, scanIntervalMinutes: 0 } };
    expect(() => parseBackup(JSON.stringify(invalid))).toThrow("invalid settings");
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

  it("accepts local 18+ category overrides", () => {
    const adultBackup = createBackup({
      appVersion: backup.appVersion,
      rules: [],
      settings: backup.settings,
      categoryOverrides: { "private.example": "adult" },
      protectedDomains: backup.protectedDomains,
    });
    expect(parseBackup(JSON.stringify(adultBackup)).categoryOverrides).toEqual({ "private.example": "adult" });
  });

  it("preserves user-classified uncategorized domains", () => {
    const uncategorizedBackup = createBackup({
      appVersion: backup.appVersion,
      rules: [],
      settings: backup.settings,
      categoryOverrides: { "false-positive.example": null },
      protectedDomains: [],
    });
    expect(parseBackup(JSON.stringify(uncategorizedBackup)).categoryOverrides).toEqual({ "false-positive.example": null });
  });

  it("preserves rejected category suggestions and supports older backups", () => {
    const rejectedBackup = createBackup({
      appVersion: backup.appVersion,
      rules: [],
      settings: backup.settings,
      categoryOverrides: {},
      categoryRejections: { "example.com": ["adult", "entertainment"] },
      protectedDomains: [],
    });
    expect(parseBackup(JSON.stringify(rejectedBackup)).categoryRejections).toEqual({ "example.com": ["adult", "entertainment"] });

    const { categoryRejections: _legacyMissing, ...legacyBackup } = rejectedBackup;
    expect(parseBackup(JSON.stringify(legacyBackup)).categoryRejections).toEqual({});
  });

  it("preserves additional URLs and domains attached to existing rules", () => {
    const ruleWithAdditionalUrl: RetentionRule = {
      id: "grouped",
      name: "Grouped rule",
      kind: "domain",
      pattern: "example.com",
      additionalUrls: ["https://another.example/private"],
      additionalDomains: ["another.example"],
      duration: 7,
      unit: "days",
      enabled: true,
      priority: 50,
      createdAt: 1,
    };
    const groupedBackup = createBackup({
      appVersion: backup.appVersion,
      rules: [ruleWithAdditionalUrl],
      settings: backup.settings,
      categoryOverrides: backup.categoryOverrides,
      protectedDomains: backup.protectedDomains,
    });
    expect(parseBackup(JSON.stringify(groupedBackup)).rules[0].additionalUrls).toEqual(["https://another.example/private"]);
    expect(parseBackup(JSON.stringify(groupedBackup)).rules[0].additionalDomains).toEqual(["another.example"]);
  });
});
