import type { RetentionRule } from "../shared/types";
import type { CategoryOverrides } from "../shared/types";
import { resolveCategory } from "../shared/categories";

export function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

export function matchesRule(url: string, rule: RetentionRule, categoryOverrides: CategoryOverrides = {}): boolean {
  if (!rule.enabled || !url) return false;
  try {
    switch (rule.kind) {
      case "exact":
        return url === rule.pattern;
      case "domain": {
        const hostname = new URL(url).hostname.toLowerCase();
        const domain = rule.pattern.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
        return hostname === domain || hostname.endsWith(`.${domain}`);
      }
      case "category":
        return resolveCategory(url, categoryOverrides) === rule.pattern;
      case "wildcard":
        return wildcardToRegExp(rule.pattern).test(url);
      case "regex":
        return new RegExp(rule.pattern, "i").test(url);
    }
  } catch {
    return false;
  }
}

export function findWinningRule(url: string, rules: RetentionRule[], categoryOverrides: CategoryOverrides = {}): RetentionRule | undefined {
  return [...rules].sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt).find((rule) => matchesRule(url, rule, categoryOverrides));
}

export function durationToMs(rule: Pick<RetentionRule, "duration" | "unit">): number {
  const multiplier = rule.unit === "minutes" ? 60_000 : rule.unit === "hours" ? 3_600_000 : 86_400_000;
  return Math.max(1, rule.duration) * multiplier;
}
