import { describe, expect, it } from "vitest";
import { CATEGORY_DATABASE_METADATA, findDatabaseCategories } from "./category-database";

describe("offline category database", () => {
  it("contains the expected generated data without exceeding its category cap", () => {
    expect(CATEGORY_DATABASE_METADATA.counts.adult).toBe(46_021);
    expect(CATEGORY_DATABASE_METADATA.counts.shopping).toBe(18_226);
    expect(Object.values(CATEGORY_DATABASE_METADATA.counts).every((count) => count <= CATEGORY_DATABASE_METADATA.maxDomainsPerCategory)).toBe(true);
  });

  it("matches listed domains and their subdomains", () => {
    expect(findDatabaseCategories("aznude.com")).toContain("adult");
    expect(findDatabaseCategories("media.aznude.com")).toContain("adult");
    expect(findDatabaseCategories("offers.bestbuy.com")).toContain("shopping");
  });

  it("keeps conflicting source assignments visible to the classifier", () => {
    expect(findDatabaseCategories("10news.com")).toEqual(expect.arrayContaining(["news", "entertainment"]));
  });

  it("does not categorize a multi-purpose host from a deep Curlie page", () => {
    expect(findDatabaseCategories("en.wikipedia.org")).toEqual([]);
  });
});
