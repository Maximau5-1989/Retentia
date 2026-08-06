import { describe, expect, it } from "vitest";
import { durationToMs, findWinningRule, matchesRule } from "./matcher";
import type { RetentionRule } from "../shared/types";

const rule = (overrides: Partial<RetentionRule>): RetentionRule => ({ id: "1", name: "Test", kind: "domain", pattern: "example.com", duration: 7, unit: "days", enabled: true, priority: 10, createdAt: 1, ...overrides });

describe("rule matcher", () => {
  it("matches domains and subdomains without matching impostors", () => {
    expect(matchesRule("https://news.example.com/a", rule({}))).toBe(true);
    expect(matchesRule("https://notexample.com/a", rule({}))).toBe(false);
  });
  it("supports exact URLs, wildcards and regex", () => {
    expect(matchesRule("https://a.test/x", rule({ kind: "exact", pattern: "https://a.test/x" }))).toBe(true);
    expect(matchesRule("https://a.test/private/42", rule({ kind: "wildcard", pattern: "https://a.test/private/*" }))).toBe(true);
    expect(matchesRule("https://a.test/item/42", rule({ kind: "regex", pattern: "/item/\\d+$" }))).toBe(true);
  });
  it("uses the highest-priority matching rule", () => {
    const winner = findWinningRule("https://example.com/a", [rule({ id: "low", priority: 1 }), rule({ id: "high", priority: 99 })]);
    expect(winner?.id).toBe("high");
  });
  it("converts durations to milliseconds", () => {
    expect(durationToMs({ duration: 2, unit: "hours" })).toBe(7_200_000);
  });
});
