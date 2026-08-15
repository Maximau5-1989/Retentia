import { describe, expect, it } from "vitest";
import manifest from "../../public/manifest.json";
import { getReleaseNotes, RELEASE_NOTES } from "./changelog";

describe("release notes", () => {
  it("keeps the current extension release first", () => {
    expect(RELEASE_NOTES[0].version).toBe(manifest.version);
    expect(getReleaseNotes(manifest.version)).toBe(RELEASE_NOTES[0]);
  });

  it("uses unique semantic versions and contains no payment release messaging", () => {
    const versions = RELEASE_NOTES.map((release) => release.version);
    expect(new Set(versions).size).toBe(versions.length);
    expect(versions.every((version) => /^\d+\.\d+\.\d+$/.test(version))).toBe(true);
    expect(versions).toEqual(["2.0.0", "1.9.1", "1.9.0", "1.8.0", "1.7.1"]);
    expect(JSON.stringify(RELEASE_NOTES)).not.toMatch(/paypal|donat|coffee|contribution/i);
  });
});
