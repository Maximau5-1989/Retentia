import { describe, expect, it } from "vitest";
import { isFirefox, resolveWebExtensionApi } from "./web-extension";

describe("cross-browser WebExtension API", () => {
  const chromeApi = { runtime: { id: "chrome", getURL: () => "chrome-extension://retentia/" } } as unknown as typeof chrome;
  const chromeBrowserApi = { runtime: { id: "chrome-browser", getURL: () => "chrome-extension://retentia/" } } as unknown as typeof chrome;
  const firefoxApi = { runtime: { id: "firefox", getURL: () => "moz-extension://retentia/" } } as unknown as typeof chrome;

  it("uses Firefox's promise-based browser namespace when available", () => {
    expect(resolveWebExtensionApi({ browser: firefoxApi, chrome: chromeApi })).toBe(firefoxApi);
    expect(isFirefox({ browser: firefoxApi, chrome: chromeApi })).toBe(true);
  });

  it("falls back to Chrome's namespace", () => {
    expect(resolveWebExtensionApi({ chrome: chromeApi })).toBe(chromeApi);
    expect(isFirefox({ chrome: chromeApi })).toBe(false);
  });

  it("does not misidentify Chrome when it also exposes a browser namespace", () => {
    expect(resolveWebExtensionApi({ browser: chromeBrowserApi, chrome: chromeApi })).toBe(chromeApi);
    expect(isFirefox({ browser: chromeBrowserApi, chrome: chromeApi })).toBe(false);
  });

  it("fails clearly outside a WebExtension context", () => {
    expect(() => resolveWebExtensionApi({})).toThrow("WebExtension API is unavailable");
  });
});
