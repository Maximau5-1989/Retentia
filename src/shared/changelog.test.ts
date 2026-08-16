import { describe, expect, it } from "vitest";
import chromeManifest from "../../manifests/chrome.json";
import firefoxManifest from "../../manifests/firefox.json";
import { CHROME_RELEASE_NOTES } from "./release-notes/chrome";
import { FIREFOX_RELEASE_NOTES } from "./release-notes/firefox";

function versionParts(version: string): readonly number[] {
  return version.split(".").map(Number);
}

function isNewer(left: string, right: string): boolean {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] > rightParts[index];
  }
  return false;
}

describe("browser-specific release notes", () => {
  it("keeps each browser's current release first", () => {
    expect(CHROME_RELEASE_NOTES[0].version).toBe(chromeManifest.version);
    expect(FIREFOX_RELEASE_NOTES[0].version).toBe(firefoxManifest.version);
  });

  it.each([
    ["Chrome", CHROME_RELEASE_NOTES],
    ["Firefox", FIREFOX_RELEASE_NOTES],
  ] as const)("keeps the %s history valid and newest-first", (_browser, releases) => {
    const versions = releases.map((release) => release.version);
    expect(new Set(versions).size).toBe(versions.length);
    expect(versions.every((version) => /^\d+\.\d+\.\d+$/.test(version))).toBe(true);
    expect(versions.slice(0, -1).every((version, index) => isNewer(version, versions[index + 1]))).toBe(true);
    expect(JSON.stringify(releases)).not.toMatch(/paypal|donat|coffee|contribution/i);
  });

  it("starts Firefox history at its first Firefox release", () => {
    expect(FIREFOX_RELEASE_NOTES.at(-1)?.version).toBe("2.2.0");
    expect(CHROME_RELEASE_NOTES.some((release) => release.version === "2.1.0")).toBe(true);
    expect(FIREFOX_RELEASE_NOTES.some((release) => release.version === "2.1.0")).toBe(false);
  });
});
