import { beforeEach, describe, expect, it, vi } from "vitest";
import { storage } from "../shared/storage";
import type { RetentionRule } from "../shared/types";
import { deleteVisitedUrlImmediately } from "./engine";

const immediateRule: RetentionRule = {
  id: "immediate",
  name: "Private portal",
  kind: "domain",
  pattern: "private.example",
  duration: 1,
  unit: "days",
  enabled: true,
  deleteImmediately: true,
  priority: 50,
  createdAt: 1,
};

describe("immediate history removal", () => {
  const deleteUrl = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    deleteUrl.mockReset().mockResolvedValue(undefined);
    vi.stubGlobal("chrome", { history: { deleteUrl } });
    vi.spyOn(storage, "getRules").mockResolvedValue([immediateRule]);
    vi.spyOn(storage, "getSettings").mockResolvedValue({
      enabled: true,
      scanIntervalMinutes: 15,
      historyWindowDays: 365,
      maxLogEntries: 250,
      onboardingComplete: true,
      theme: "light",
    });
    vi.spyOn(storage, "getCategoryOverrides").mockResolvedValue({});
    vi.spyOn(storage, "getProtectedDomains").mockResolvedValue([]);
    vi.spyOn(storage, "addActivity").mockResolvedValue(undefined);
  });

  it("removes a newly visited URL when the winning rule is immediate", async () => {
    await expect(deleteVisitedUrlImmediately("https://private.example/account")).resolves.toBe(true);
    expect(deleteUrl).toHaveBeenCalledWith({ url: "https://private.example/account" });
    expect(storage.addActivity).toHaveBeenCalledWith(expect.objectContaining({ count: 1, type: "deleted" }), 250);
  });

  it("does not remove a visit for a normal retention rule", async () => {
    vi.mocked(storage.getRules).mockResolvedValue([{ ...immediateRule, deleteImmediately: false }]);
    await expect(deleteVisitedUrlImmediately("https://private.example/account")).resolves.toBe(false);
    expect(deleteUrl).not.toHaveBeenCalled();
  });

  it("never removes protected websites", async () => {
    vi.mocked(storage.getProtectedDomains).mockResolvedValue(["private.example"]);
    await expect(deleteVisitedUrlImmediately("https://private.example/account")).resolves.toBe(false);
    expect(deleteUrl).not.toHaveBeenCalled();
  });
});
