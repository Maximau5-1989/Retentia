import { beforeEach, describe, expect, it, vi } from "vitest";
import { storage } from "../shared/storage";
import { scanHistoryCategories } from "./engine";

describe("category history scanning", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("chrome", {
      history: {
        search: vi.fn().mockResolvedValue([
          { url: "https://example.com/adult", title: "Adult area", visitCount: 1 },
        ]),
      },
    });
    vi.spyOn(storage, "getCategoryOverrides").mockResolvedValue({});
  });

  it("filters locally rejected category suggestions from future scans", async () => {
    vi.spyOn(storage, "getCategoryRejections").mockResolvedValue({ "example.com": ["adult"] });
    const result = await scanHistoryCategories();
    const domain = result.buckets.find((bucket) => !bucket.category)?.domains[0];
    expect(domain).toMatchObject({ domain: "example.com", confidence: "none" });
    expect(domain?.suggestedCategory).toBeUndefined();
  });
});
