import { CATEGORY_PRESETS } from "./categories";
import type { RetentionRule } from "./types";

export const DEFAULT_CATEGORY_RULES_VERSION = 1;

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
  const existingCategories = new Set(
    existingRules
      .filter((rule) => rule.kind === "category")
      .map((rule) => rule.pattern),
  );
  const additions = CATEGORY_PRESETS
    .filter((preset) => !existingCategories.has(preset.id))
    .map((preset, index): RetentionRule => ({
      id: createId(),
      name: `${preset.label} default`,
      kind: "category",
      pattern: preset.id,
      category: preset.id,
      duration: preset.duration,
      unit: preset.unit,
      enabled,
      priority: 40 - index,
      createdAt: now + index,
    }));

  return { rules: [...existingRules, ...additions], additions };
}
