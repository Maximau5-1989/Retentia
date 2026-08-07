import { CATEGORY_PRESETS } from "./categories";
import type { RetentionRule } from "./types";

export const DEFAULT_CATEGORY_RULES_VERSION = 2;

interface DefaultRuleOptions {
  enabled?: boolean;
  now?: number;
  createId?: () => string;
}

export function addMissingDefaultCategoryRules(
  existingRules: RetentionRule[],
  options: DefaultRuleOptions = {},
): { rules: RetentionRule[]; additions: RetentionRule[] } {
  const enabled = options.enabled ?? false;
  const now = options.now ?? Date.now();
  const createId = options.createId ?? (() => crypto.randomUUID());
  const normalizedRules = existingRules.map((rule) => {
    if (rule.kind !== "category") return rule;
    const preset = CATEGORY_PRESETS.find((item) => item.id === rule.pattern);
    return preset && rule.name === `${preset.label} default`
      ? { ...rule, name: preset.label }
      : rule;
  });
  const existingCategories = new Set(
    normalizedRules
      .filter((rule) => rule.kind === "category")
      .map((rule) => rule.pattern),
  );
  const additions = CATEGORY_PRESETS
    .filter((preset) => !existingCategories.has(preset.id))
    .map((preset, index): RetentionRule => ({
      id: createId(),
      name: preset.label,
      kind: "category",
      pattern: preset.id,
      category: preset.id,
      duration: preset.duration,
      unit: preset.unit,
      enabled,
      priority: 40 - index,
      createdAt: now + index,
    }));

  return { rules: [...normalizedRules, ...additions], additions };
}
