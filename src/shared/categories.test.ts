import { describe, expect, it } from "vitest";
import { categorizeHistoryEntries, normalizeHostname, resolveCategory, suggestCategory } from "./categories";

describe("category suggestions", () => {
  it("recognizes known domains and their subdomains", () => {
    expect(suggestCategory("https://www.youtube.com/watch?v=1")?.id).toBe("streaming");
    expect(suggestCategory("news.bbc.com")?.id).toBe("news");
    expect(suggestCategory("https://www.pornhub.com/view_video.php")?.id).toBe("adult");
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
      { category: "news", urls: 1, visits: 2, domains: [{ domain: "nos.nl", urls: 1, visits: 2, overridden: false }] },
      { category: "streaming", urls: 1, visits: 3, domains: [{ domain: "youtube.com", urls: 1, visits: 3, overridden: false }] },
      { category: undefined, urls: 1, visits: 1, domains: [{ domain: "unknown.example", urls: 1, visits: 1, overridden: false }] },
    ]);
    expect(JSON.stringify(buckets)).not.toContain("private");
  });

  it("lets local overrides move a domain into another category", () => {
    expect(resolveCategory("youtube.com", { "youtube.com": "entertainment" })).toBe("entertainment");
    expect(categorizeHistoryEntries([{ url: "https://youtube.com/watch", visitCount: 1 }], { "youtube.com": "entertainment" })[0].domains[0].overridden).toBe(true);
  });

  it("keeps the 18+ preset opt-in and configured for immediate deletion", () => {
    const preset = suggestCategory("xvideos.com");
    expect(preset?.label).toBe("18+");
    expect(preset?.deleteImmediately).toBe(true);
  });
});
