import { describe, expect, it } from "vitest";
import { durationToMs, findWinningRule, getExpirationTime, matchesRule } from "./matcher";
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
  it("matches category rules with local domain overrides", () => {
    const categoryRule = rule({ kind: "category", pattern: "news", category: "news" });
    expect(matchesRule("https://nos.nl/article", categoryRule)).toBe(true);
    expect(matchesRule("https://example.com/article", categoryRule, { "example.com": "news" })).toBe(true);
  });
  it("excludes a user-classified false positive from category rules", () => {
    const categoryRule = rule({ kind: "category", pattern: "adult", category: "adult", deleteImmediately: true });
    expect(matchesRule("https://aznude.com/example", categoryRule)).toBe(true);
    expect(matchesRule("https://aznude.com/example", categoryRule, { "aznude.com": null })).toBe(false);
  });
  it("uses the highest-priority matching rule", () => {
    const winner = findWinningRule("https://example.com/a", [rule({ id: "low", priority: 1 }), rule({ id: "high", priority: 99 })]);
    expect(winner?.id).toBe("high");
  });
  it("converts durations to milliseconds", () => {
    expect(durationToMs({ duration: 2, unit: "hours" })).toBe(7_200_000);
  });
  it("matches additional exact history URLs attached to any rule", () => {
    const target = "https://another.example/private/item";
    expect(matchesRule(target, rule({ additionalUrls: [target] }))).toBe(true);
    expect(matchesRule("https://another.example/private/other", rule({ additionalUrls: [target] }))).toBe(false);
  });
  it("uses URL and stored-title signals only for high-confidence category matches", () => {
    const categoryRule = rule({ kind: "category", pattern: "adult", category: "adult" });
    expect(matchesRule({ url: "https://media.example/adult/videos", title: "Free porn videos" }, categoryRule)).toBe(true);
    expect(matchesRule({ url: "https://example.com/adult", title: "Adult area" }, categoryRule)).toBe(false);
  });
  it("expires immediate rules at the visit time", () => {
    expect(getExpirationTime(123, rule({ deleteImmediately: true }))).toBe(123);
    expect(getExpirationTime(123, rule({ duration: 2, unit: "hours" }))).toBe(7_200_123);
  });
});
