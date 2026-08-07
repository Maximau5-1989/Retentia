import { describe, expect, it } from "vitest";
import { CATEGORY_PRESETS } from "./categories";
import { addMissingDefaultCategoryRules } from "./default-rules";
import type { RetentionRule } from "./types";

const customRule: RetentionRule = {
  id: "custom",
  name: "Custom",
  kind: "domain",
  pattern: "example.com",
  duration: 7,
  unit: "days",
  enabled: true,
  priority: 50,
  createdAt: 1,
};

describe("default category rules", () => {
  it("adds one disabled rule for every category", () => {
    let id = 0;
    const result = addMissingDefaultCategoryRules([], { now: 100, createId: () => `default-${id++}` });

    expect(result.additions).toHaveLength(CATEGORY_PRESETS.length);
    expect(result.additions.every((rule) => rule.kind === "category" && !rule.enabled)).toBe(true);
    expect(result.additions.map((rule) => rule.pattern)).toEqual(CATEGORY_PRESETS.map((preset) => preset.id));
    expect(result.additions.map((rule) => rule.name)).toEqual(CATEGORY_PRESETS.map((preset) => preset.label));
    expect(result.additions.find((rule) => rule.pattern === "adult")).toMatchObject({
      name: "18+",
      enabled: false,
      deleteImmediately: true,
    });
  });

  it("preserves existing rules and does not duplicate an existing category", () => {
    const existingCategory: RetentionRule = {
      ...customRule,
      id: "news",
      name: "My news rule",
      kind: "category",
      pattern: "news",
      category: "news",
    };
    const result = addMissingDefaultCategoryRules([customRule, existingCategory], { createId: () => crypto.randomUUID() });

    expect(result.rules.slice(0, 2)).toEqual([customRule, existingCategory]);
    expect(result.rules.filter((rule) => rule.kind === "category" && rule.pattern === "news")).toHaveLength(1);
    expect(result.additions).toHaveLength(CATEGORY_PRESETS.length - 1);
  });

  it("can prepare active defaults for confirmed immediate cleanup", () => {
    const result = addMissingDefaultCategoryRules([], { enabled: true });
    expect(result.additions.every((rule) => rule.enabled)).toBe(true);
  });

  it("removes the legacy default suffix without renaming custom category rules", () => {
    const legacyRule: RetentionRule = {
      ...customRule,
      id: "legacy-social",
      name: "Social media default",
      kind: "category",
      pattern: "social",
      category: "social",
    };
    const customCategoryRule: RetentionRule = {
      ...legacyRule,
      id: "custom-social",
      name: "My social rule",
    };
    const result = addMissingDefaultCategoryRules([legacyRule, customCategoryRule]);

    expect(result.rules[0].name).toBe("Social media");
    expect(result.rules[1].name).toBe("My social rule");
  });
});
