import { describe, expect, it } from "vitest";
import { detectRuleConflicts } from "./conflicts";
import type { RetentionRule } from "../shared/types";

const rule = (id: string, kind: RetentionRule["kind"], pattern: string, priority: number): RetentionRule => ({ id, name: id, kind, pattern, duration: 7, unit: "days", enabled: true, priority, createdAt: priority, });

describe("rule conflict detection", () => {
  it("finds domain and exact URL overlaps and identifies the winner", () => {
    const conflicts = detectRuleConflicts([rule("domain", "domain", "example.com", 10), rule("exact", "exact", "https://news.example.com/a", 50)]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].winner.id).toBe("exact");
  });

  it("finds category overlaps and ignores disabled rules", () => {
    const category = rule("news", "category", "news", 40);
    const specific = rule("nos", "domain", "nos.nl", 50);
    expect(detectRuleConflicts([category, specific])).toHaveLength(1);
    expect(detectRuleConflicts([category, { ...specific, enabled: false }])).toHaveLength(0);
  });
});
