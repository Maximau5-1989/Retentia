import { beforeEach, describe, expect, it, vi } from "vitest";
import { storage } from "../shared/storage";
import { scanHistoryCategories } from "./engine";

describe("category history scanning", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.stubGlobal("chrome", {
      runtime: { getURL: () => "chrome-extension://retentia/" },
      history: {
        search: vi.fn().mockResolvedValue([
          { url: "https://example.com/adult", title: "Adult area", visitCount: 1 },
        ]),
      },
    });
    vi.spyOn(storage, "getCategoryOverrides").mockResolvedValue({});
    vi.spyOn(storage, "getCategoryRejections").mockResolvedValue({});
  });

  it("filters locally rejected category suggestions from future scans", async () => {
    vi.spyOn(storage, "getCategoryRejections").mockResolvedValue({ "example.com": ["adult"] });
    const result = await scanHistoryCategories();
    const domain = result.buckets.find((bucket) => !bucket.category)?.domains[0];
    expect(domain).toMatchObject({ domain: "example.com", confidence: "none" });
    expect(domain?.suggestedCategory).toBeUndefined();
    expect(globalThis.chrome.history.search).toHaveBeenCalledWith({ text: "", startTime: 0, maxResults: 1_000_000 });
  });

  it("scans Firefox history entries whose database title is null", async () => {
    const search = vi.fn().mockResolvedValue([
      { url: "https://unknown-example.invalid/path", title: null, visitCount: 2 },
    ]);
    vi.stubGlobal("browser", {
      runtime: { getURL: () => "moz-extension://retentia/" },
      history: { search },
    });

    const result = await scanHistoryCategories();

    expect(result).toMatchObject({ scanned: 1, categorized: 0, uncategorized: 1 });
    expect(result.buckets.find((bucket) => !bucket.category)).toMatchObject({ urls: 1, visits: 2 });
    expect(search).toHaveBeenCalledWith({ text: "", startTime: 0, maxResults: 100_000 });
  });
});
