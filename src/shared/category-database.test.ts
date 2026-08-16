import { describe, expect, it } from "vitest";
import { CATEGORY_DATABASE_METADATA, findDatabaseCategories } from "./category-database";

describe("offline category database", () => {
  it("contains the expected generated data without exceeding its category cap", () => {
    expect(CATEGORY_DATABASE_METADATA.counts.adult).toBe(46_016);
    expect(CATEGORY_DATABASE_METADATA.counts.shopping).toBe(18_225);
    expect(Object.values(CATEGORY_DATABASE_METADATA.counts).every((count) => count <= CATEGORY_DATABASE_METADATA.maxDomainsPerCategory)).toBe(true);
  });

  it("matches listed domains and their subdomains", () => {
    expect(findDatabaseCategories("aznude.com")).toContain("adult");
    expect(findDatabaseCategories("media.aznude.com")).toContain("adult");
    expect(findDatabaseCategories("offers.bestbuy.com")).toContain("shopping");
  });

  it("uses the one-time local model audit only to resolve high-confidence source conflicts", () => {
    expect(CATEGORY_DATABASE_METADATA.modelConflictResolutions?.resolvedDomains).toBe(18);
    expect(findDatabaseCategories("10news.com")).toEqual(["news"]);
    expect(findDatabaseCategories("visitpensacolabeach.com")).toEqual(["travel"]);
    expect(findDatabaseCategories("freesexycomics.com")).toEqual(["adult"]);
  });

  it("does not categorize a multi-purpose host from a deep Curlie page", () => {
    expect(findDatabaseCategories("en.wikipedia.org")).toEqual([]);
  });
});
