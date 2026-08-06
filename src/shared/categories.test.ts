import { describe, expect, it } from "vitest";
import { categorizeHistoryEntries, normalizeHostname, suggestCategory } from "./categories";

describe("category suggestions", () => {
  it("recognizes known domains and their subdomains", () => {
    expect(suggestCategory("https://www.youtube.com/watch?v=1")?.id).toBe("streaming");
    expect(suggestCategory("news.bbc.com")?.id).toBe("news");
  });

  it("does not guess a category for unknown domains", () => {
    expect(suggestCategory("https://example.com/products")).toBeUndefined();
  });

  it("normalizes URLs without exposing page content", () => {
    expect(normalizeHostname("WWW.GOOGLE.NL/search?q=private")).toBe("google.nl");
  });

  it("aggregates category totals without retaining URLs", () => {
    const buckets = categorizeHistoryEntries([
      { url: "https://youtube.com/watch?v=private", visitCount: 3 },
      { url: "https://nos.nl/article/1", visitCount: 2 },
      { url: "https://unknown.example/private", visitCount: 1 },
    ]);
    expect(buckets).toEqual([
      { category: "news", urls: 1, visits: 2 },
      { category: "streaming", urls: 1, visits: 3 },
      { category: undefined, urls: 1, visits: 1 },
    ]);
    expect(JSON.stringify(buckets)).not.toContain("private");
  });
});
