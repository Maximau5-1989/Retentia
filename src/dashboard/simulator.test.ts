import { describe, expect, it } from "vitest";
import type { HistoryCandidate, RetentionRule } from "../shared/types";
import { groupSimulatorCandidates } from "./simulator";

const createRule = (id: string, enabled = true): RetentionRule => ({
  id,
  name: `Rule ${id}`,
  kind: "domain",
  pattern: `${id}.example`,
  duration: 7,
  unit: "days",
  enabled,
  priority: 50,
  createdAt: 1,
});

const createCandidate = (rule: RetentionRule, url: string, expired: boolean): HistoryCandidate => ({
  url,
  title: url,
  lastVisitTime: 1,
  visitCount: 1,
  rule,
  expiresAt: 2,
  expired,
});

describe("simulator rule groups", () => {
  it("shows every enabled rule, including rules without URL matches", () => {
    const first = createRule("first");
    const second = createRule("second");
    const disabled = createRule("disabled", false);
    const groups = groupSimulatorCandidates([first, second, disabled], [
      createCandidate(first, "https://first.example/a", true),
      createCandidate(first, "https://first.example/b", false),
    ]);

    expect(groups.map((group) => group.rule.id)).toEqual(["first", "second"]);
    expect(groups[0]).toMatchObject({ matched: 2, expired: 1 });
    expect(groups[1]).toMatchObject({ matched: 0, expired: 0, candidates: [] });
  });
});
