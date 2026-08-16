import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";
import chromeManifest from "../../manifests/chrome.json";
import firefoxManifest from "../../manifests/firefox.json";

describe("browser manifests", () => {
  it("keeps package and browser versions synchronized", () => {
    expect(chromeManifest.version).toBe(packageJson.version);
    expect(firefoxManifest.version).toBe(packageJson.version);
  });

  it("uses the background model supported by each browser", () => {
    expect(chromeManifest.background).toEqual({ service_worker: "background.js", type: "module" });
    expect(firefoxManifest.background).toEqual({ scripts: ["background.js"], type: "module" });
  });

  it("keeps Firefox permissions minimal and declares no data collection", () => {
    expect(firefoxManifest.permissions).toEqual(["history", "storage", "alarms", "tabs"]);
    expect(firefoxManifest.browser_specific_settings.gecko).toMatchObject({
      id: "{77b5fe30-ca69-401c-8367-34947d2e21ef}",
      strict_min_version: "140.0",
      data_collection_permissions: { required: ["none"] },
    });
  });

  it("retains Chrome's history-page context menu permission", () => {
    expect(chromeManifest.permissions).toContain("contextMenus");
  });
});
