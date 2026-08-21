import { describe, expect, it } from "vitest";
import chromeManifest from "../../manifests/chrome.json";
import firefoxManifest from "../../manifests/firefox.json";

describe("browser manifests", () => {
  it("uses independent semantic versions for each browser", () => {
    expect(chromeManifest.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(firefoxManifest.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("uses the background model supported by each browser", () => {
    expect(chromeManifest.background).toEqual({ service_worker: "background.js", type: "module" });
    expect(firefoxManifest.background).toEqual({ scripts: ["background.js"], type: "module" });
  });

  it("keeps Firefox permissions minimal and declares no data collection", () => {
    expect(firefoxManifest.permissions).toEqual(["history", "storage", "alarms", "tabs"]);
    expect(firefoxManifest.optional_permissions).toEqual(["cookies"]);
    expect(firefoxManifest.optional_host_permissions).toEqual(["*://*/*"]);
    expect(firefoxManifest.browser_specific_settings.gecko).toMatchObject({
      id: "{77b5fe30-ca69-401c-8367-34947d2e21ef}",
      strict_min_version: "142.0",
      data_collection_permissions: { required: ["none"] },
    });
  });

  it("retains Chrome's history-page context menu permission", () => {
    expect(chromeManifest.permissions).toContain("contextMenus");
  });
});

