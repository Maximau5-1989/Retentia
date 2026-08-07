import { describe, expect, it } from "vitest";
import type { RetentionRule } from "../shared/types";
import { addManualTarget, matchesManualTarget, normalizeDomain, normalizeHttpUrl, removeManualTarget } from "./manual-targets";

const rule = (): RetentionRule => ({
  id: "rule-1",
  name: "News",
  kind: "category",
  pattern: "news",
  category: "news",
  duration: 7,
  unit: "days",
  enabled: true,
  priority: 40,
  createdAt: 1,
});

describe("manual rule targets", () => {
  it("normalizes regular and encoded Chrome History URLs", () => {
    expect(normalizeHttpUrl(" https://Example.com/path ")).toBe("https://example.com/path");
    expect(normalizeHttpUrl("https%3A%2F%2Fexample.com%2Fprivate%3Fa%3D1")).toBe("https://example.com/private?a=1");
  });

  it("rejects internal browser URLs", () => {
    expect(() => normalizeHttpUrl("chrome://history/")).toThrow(/http:\/\//);
  });

  it("extracts and normalizes a domain from either input style", () => {
    expect(normalizeDomain("Shop.Example.com/path")).toBe("shop.example.com");
    expect(normalizeDomain("https://News.Example.com/article")).toBe("news.example.com");
  });

  it("adds exact URLs and domains without duplicates", () => {
    const withUrl = addManualTarget(rule(), "url", "https://example.com/private");
    expect(withUrl.rule.additionalUrls).toEqual(["https://example.com/private"]);
    expect(addManualTarget(withUrl.rule, "url", "https://example.com/private").alreadyExists).toBe(true);

    const withDomain = addManualTarget(withUrl.rule, "domain", "example.org");
    expect(withDomain.rule.additionalDomains).toEqual(["example.org"]);
  });

  it("matches a specific URL or a domain and its subdomains", () => {
    const configured = { ...rule(), additionalUrls: ["https://example.com/private"], additionalDomains: ["example.org"] };
    expect(matchesManualTarget("https://example.com/private", configured)).toBe(true);
    expect(matchesManualTarget("https://sub.example.org/page", configured)).toBe(true);
    expect(matchesManualTarget("https://example.com/other", configured)).toBe(false);
  });

  it("removes only the selected manual target", () => {
    const configured = { ...rule(), additionalUrls: ["https://example.com/private"], additionalDomains: ["example.org"] };
    expect(removeManualTarget(configured, "url", "https://example.com/private").additionalUrls).toEqual([]);
    expect(removeManualTarget(configured, "domain", "example.org").additionalDomains).toEqual([]);
  });
});
