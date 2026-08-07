import { describe, expect, it } from "vitest";
import { createBackup, parseBackup } from "./backup";
import { DEFAULT_SETTINGS } from "./defaults";

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
});
