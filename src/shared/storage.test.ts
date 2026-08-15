import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "./defaults";
import { storage } from "./storage";

describe("activity storage", () => {
  let activity: unknown[];

  beforeEach(() => {
    activity = [];
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async () => ({ activity })),
          set: vi.fn(async (values: { activity?: unknown[] }) => {
            await Promise.resolve();
            if (values.activity) activity = values.activity;
          }),
        },
      },
    });
  });

  it("serializes concurrent activity additions so entries are not lost", async () => {
    const first = { id: "first", timestamp: 1, type: "scan" as const, message: "First" };
    const second = { id: "second", timestamp: 2, type: "deleted" as const, message: "Second", count: 1 };

    await Promise.all([storage.addActivity(first, 250), storage.addActivity(second, 250)]);

    expect(activity).toEqual([second, first]);
  });
});

describe("pending changelog storage", () => {
  it("stores, reads, and clears a semantic version", async () => {
    const values: Record<string, unknown> = {};
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({ [key]: values[key] })),
          set: vi.fn(async (updates: Record<string, unknown>) => Object.assign(values, updates)),
          remove: vi.fn(async (key: string) => { delete values[key]; }),
        },
      },
    });

    await storage.setPendingChangelogVersion("2.0.0");
    await expect(storage.getPendingChangelogVersion()).resolves.toBe("2.0.0");

    await storage.clearPendingChangelogVersion();
    await expect(storage.getPendingChangelogVersion()).resolves.toBeNull();
  });

  it("ignores an invalid stored version", async () => {
    vi.stubGlobal("chrome", {
      storage: { local: { get: vi.fn(async (key: string) => ({ [key]: "not-a-version" })) } },
    });

    await expect(storage.getPendingChangelogVersion()).resolves.toBeNull();
  });
});

describe("diagnostic storage", () => {
  it("serializes writes and retains only the newest 50 entries", async () => {
    let diagnostics: unknown[] = [];
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async () => ({ diagnostics })),
          set: vi.fn(async (values: { diagnostics?: unknown[] }) => {
            if (values.diagnostics) diagnostics = values.diagnostics;
          }),
        },
      },
    });

    const entries = Array.from({ length: 55 }, (_, index) => ({
      id: String(index),
      timestamp: index,
      source: "background" as const,
      code: "unexpected-error" as const,
      appVersion: "2.0.0",
    }));
    await Promise.all(entries.map((entry) => storage.addDiagnostic(entry)));

    expect(diagnostics).toHaveLength(50);
    expect(diagnostics[0]).toEqual(entries[54]);
    expect(diagnostics[49]).toEqual(entries[5]);
  });
});

describe("privacy migration", () => {
  it("removes the legacy password bypass from stored settings", async () => {
    const values: Record<string, unknown> = {
      activity: [],
      settings: { ...DEFAULT_SETTINGS, testingBypassPassword: true },
      lastScan: null,
    };
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({ [key]: values[key] })),
          set: vi.fn(async (updates: Record<string, unknown>) => Object.assign(values, updates)),
        },
      },
    });

    await storage.sanitizePrivacyData();

    expect(values.settings).toEqual(DEFAULT_SETTINGS);
    expect(values.settings).not.toHaveProperty("testingBypassPassword");
  });
});
