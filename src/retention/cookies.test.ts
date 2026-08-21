import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HistoryCandidate, RetentionRule } from "../shared/types";
import { cookiePermissionOrigin, countCookiesForRule, deleteCookiesForExpiredCandidates } from "./cookies";

const rule: RetentionRule = {
  id: "cookie-rule", name: "Example", kind: "domain", pattern: "example.com",
  duration: 1, unit: "days", enabled: true, deleteCookiesOnExpiry: true, priority: 50, createdAt: 1,
};

describe("opt-in cookie cleanup", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("derives a narrowly requested host origin only for concrete rules", () => {
    expect(cookiePermissionOrigin(rule)).toBe("*://*.example.com/*");
    expect(cookiePermissionOrigin({ kind: "exact", pattern: "https://login.example.org/path" })).toBe("*://*.login.example.org/*");
    expect(cookiePermissionOrigin({ kind: "category", pattern: "social" })).toBeNull();
  });

  it("removes only cookies associated with expired opted-in candidate hosts", async () => {
    const getAll = vi.fn().mockResolvedValue([{ name: "session", domain: ".example.com", path: "/", secure: true, storeId: "default" }]);
    const remove = vi.fn().mockResolvedValue({ name: "session" });
    vi.stubGlobal("browser", { runtime: { getURL: () => "moz-extension://retentia/" }, cookies: { getAll, remove } });
    const candidate: HistoryCandidate = { url: "https://example.com/private", title: "", lastVisitTime: 1, visitCount: 1, rule, expiresAt: 2, expired: true };

    await expect(deleteCookiesForExpiredCandidates([candidate])).resolves.toBe(1);
    expect(getAll).toHaveBeenCalledTimes(1);
    expect(getAll).toHaveBeenCalledWith({ domain: "example.com" });
    expect(remove).toHaveBeenCalledWith({ url: "https://example.com/", name: "session", storeId: "default" });
  });

  it("does nothing unless the rule explicitly opts in", async () => {
    const getAll = vi.fn();
    vi.stubGlobal("browser", { runtime: { getURL: () => "moz-extension://retentia/" }, cookies: { getAll } });
    const candidate: HistoryCandidate = { url: "https://example.com/", title: "", lastVisitTime: 1, visitCount: 1, rule: { ...rule, deleteCookiesOnExpiry: false }, expiresAt: 2, expired: true };
    await expect(deleteCookiesForExpiredCandidates([candidate])).resolves.toBe(0);
    expect(getAll).not.toHaveBeenCalled();
  });

  it("counts cookies for an opted-in rule without reading their values", async () => {
    const getAll = vi.fn().mockResolvedValue([{ name: "a" }, { name: "b" }]);
    vi.stubGlobal("browser", {
      runtime: { getURL: () => "moz-extension://retentia/" },
      permissions: { contains: vi.fn().mockResolvedValue(true) },
      cookies: { getAll },
    });
    await expect(countCookiesForRule(rule)).resolves.toBe(2);
    expect(getAll).toHaveBeenCalledWith({ domain: "example.com" });
  });
});

