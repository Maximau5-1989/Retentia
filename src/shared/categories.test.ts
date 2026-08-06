import { describe, expect, it } from "vitest";
import { normalizeHostname, suggestCategory } from "./categories";

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
});
