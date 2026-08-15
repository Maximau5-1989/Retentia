import { beforeEach, describe, expect, it, vi } from "vitest";
import { sessionStorage } from "./storage";
import { findDashboardTab, openDashboardTab } from "./dashboard-tabs";

describe("dashboard tab reuse", () => {
  const get = vi.fn();
  const query = vi.fn();
  const update = vi.fn();
  const create = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    get.mockReset(); query.mockReset(); update.mockReset(); create.mockReset();
    vi.stubGlobal("chrome", {
      runtime: { getURL: (path: string) => `chrome-extension://retentia/${path}` },
      tabs: { get, query, update, create },
    });
  });

  it("reuses the registered dashboard tab", async () => {
    vi.spyOn(sessionStorage, "getDashboardTabId").mockResolvedValue(42);
    get.mockResolvedValue({ id: 42, url: "chrome-extension://retentia/dashboard.html?view=overview" });
    update.mockResolvedValue({ id: 42 });

    await openDashboardTab({ view: "rules" });

    expect(update).toHaveBeenCalledWith(42, {
      url: "chrome-extension://retentia/dashboard.html?view=rules",
      active: true,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("recovers another dashboard tab when the registered tab was closed", async () => {
    vi.spyOn(sessionStorage, "getDashboardTabId").mockResolvedValue(42);
    get.mockRejectedValue(new Error("No tab"));
    query.mockResolvedValue([{ id: 7, url: "chrome-extension://retentia/dashboard.html" }]);

    await expect(findDashboardTab()).resolves.toMatchObject({ id: 7 });
  });

  it("creates one dashboard tab only when none exists", async () => {
    vi.spyOn(sessionStorage, "getDashboardTabId").mockResolvedValue(undefined);
    query.mockResolvedValue([]);
    create.mockResolvedValue({ id: 9 });

    await openDashboardTab({ view: "overview" });

    expect(create).toHaveBeenCalledWith({ url: "chrome-extension://retentia/dashboard.html?view=overview" });
  });
});
