import { describe, expect, it } from "vitest";
import { CATEGORY_PRESETS, categorizeHistoryEntries, classifyCategory, normalizeHostname, resolveCategory, suggestCategory } from "./categories";

describe("local category classifier", () => {
  it("recognizes known domains and their subdomains with high confidence", () => {
    expect(suggestCategory("https://www.youtube.com/watch?v=1")?.id).toBe("streaming");
    expect(suggestCategory("news.bbc.com")?.id).toBe("news");
    expect(classifyCategory("https://www.pornhub.com/view_video.php")).toMatchObject({
      category: "adult",
      confidence: "high",
      source: "domain",
    });
  });

  it("combines URL structure and the stored title without opening the page", () => {
    expect(classifyCategory("https://media.example/adult/123", "Free porn videos")).toMatchObject({
      category: "adult",
      confidence: "high",
      source: "signals",
    });
    expect(resolveCategory("https://media.example/adult/123", {}, "Free porn videos")).toBe("adult");
  });

  it("returns uncertain matches as suggestions instead of automatic categories", () => {
    const result = classifyCategory("https://example.com/adult", "Adult area");
    expect(result).toMatchObject({
      suggestedCategory: "adult",
      confidence: "medium",
    });
    expect(result.category).toBeUndefined();
  });

  it("keeps a rejected domain uncategorized without repeating that category suggestion", () => {
    const bucket = categorizeHistoryEntries(
      [{ url: "https://example.com/adult", title: "Adult area", visitCount: 1 }],
      {},
      { "example.com": ["adult"] },
    ).find((item) => !item.category);
    expect(bucket?.domains[0]).toMatchObject({
      domain: "example.com",
      confidence: "none",
      score: 0,
    });
    expect(bucket?.domains[0].suggestedCategory).toBeUndefined();
  });

  it("does not classify weak or misleading text", () => {
    expect(suggestCategory("https://example.com/products")).toBeUndefined();
    expect(classifyCategory("https://sussex.example/about", "University information").category).toBeUndefined();
  });

  it("normalizes URLs without returning path or query content", () => {
    expect(normalizeHostname("WWW.GOOGLE.NL/search?q=private")).toBe("google.nl");
  });

  it("always returns every category and keeps possible matches uncategorized", () => {
    const buckets = categorizeHistoryEntries([
      { url: "https://youtube.com/watch?v=private", title: "Video", visitCount: 3 },
      { url: "https://nos.nl/article/1", title: "News", visitCount: 2 },
      { url: "https://example.com/adult", title: "Adult area", visitCount: 1 },
    ]);
    expect(buckets).toHaveLength(CATEGORY_PRESETS.length + 1);
    expect(buckets.filter((bucket) => bucket.category).map((bucket) => bucket.category)).toEqual(CATEGORY_PRESETS.map((preset) => preset.id));
    expect(buckets.find((bucket) => bucket.category === "adult")?.urls).toBe(0);
    expect(buckets.find((bucket) => !bucket.category)?.domains[0]).toMatchObject({
      domain: "example.com",
      suggestedCategory: "adult",
      confidence: "medium",
    });
    expect(JSON.stringify(buckets)).not.toContain("private");
    expect(JSON.stringify(buckets)).not.toContain("Adult area");
  });

  it("lets local overrides take precedence over every classifier signal", () => {
    expect(resolveCategory("youtube.com", { "youtube.com": "entertainment" })).toBe("entertainment");
    const bucket = categorizeHistoryEntries(
      [{ url: "https://media.example/adult/videos", title: "Porn videos", visitCount: 1 }],
      { "media.example": "news" },
    ).find((item) => item.category === "news");
    expect(bucket?.domains[0]).toMatchObject({ domain: "media.example", overridden: true, confidence: "high" });
  });

  it("keeps the 18+ preset opt-in and configured for immediate deletion", () => {
    const preset = suggestCategory("xvideos.com");
    expect(preset?.label).toBe("18+");
    expect(preset?.deleteImmediately).toBe(true);
  });
});
