import { beforeEach, describe, expect, it, vi } from "vitest";
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
