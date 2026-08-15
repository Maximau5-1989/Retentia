import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDiagnosticEntry } from "./diagnostics";

describe("privacy-safe diagnostics", () => {
  beforeEach(() => {
    vi.stubGlobal("chrome", { runtime: { getManifest: () => ({ version: "2.0.0" }) } });
    vi.stubGlobal("crypto", { randomUUID: () => "diagnostic-id" });
  });

  it("stores useful crash metadata without messages, URLs, paths, or stack traces", () => {
    const error = new TypeError("Failed while processing https://private.example/path");
    error.stack = "TypeError at C:\\Users\\Max\\private-file.ts";
    const entry = createDiagnosticEntry("dashboard", "https://private.example/secret", error, {
      filename: "chrome-extension://extension-id/assets/dashboard-secret.js",
      line: 42,
      column: 7,
    });

    expect(entry).toMatchObject({
      id: "diagnostic-id",
      source: "dashboard",
      code: "unexpected-error",
      appVersion: "2.0.0",
      errorName: "TypeError",
      file: "dashboard-secret.js",
      line: 42,
      column: 7,
    });
    expect(JSON.stringify(entry)).not.toContain("private.example");
    expect(JSON.stringify(entry)).not.toContain("Users");
    expect(entry).not.toHaveProperty("message");
    expect(entry).not.toHaveProperty("stack");
  });
});
