import type { RetentionRule } from "../shared/types";
import type { CategoryOverrides } from "../shared/types";
import { resolveCategory } from "../shared/categories";
import { matchesManualTarget, normalizeDomain } from "./manual-targets";

export type RuleMatchInput = string | { url: string; title?: string };

export function wildcardToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

export function matchesRule(candidate: RuleMatchInput, rule: RetentionRule, categoryOverrides: CategoryOverrides = {}): boolean {
  const url = typeof candidate === "string" ? candidate : candidate.url;
  const title = typeof candidate === "string" ? "" : candidate.title ?? "";
  if (!rule.enabled || !url) return false;
  try {
    if (matchesManualTarget(url, rule)) return true;
    switch (rule.kind) {
      case "exact":
        return url === rule.pattern;
      case "domain": {
        const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
        const domain = normalizeDomain(rule.pattern);
        return hostname === domain || hostname.endsWith(`.${domain}`);
      }
      case "category":
        return resolveCategory(url, categoryOverrides, title) === rule.pattern;
      case "wildcard":
        return wildcardToRegExp(rule.pattern).test(url);
      case "regex":
        return new RegExp(rule.pattern, "i").test(url);
    }
  } catch {
    return false;
  }
}

export function findWinningRule(candidate: RuleMatchInput, rules: RetentionRule[], categoryOverrides: CategoryOverrides = {}): RetentionRule | undefined {
  return [...rules].sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt).find((rule) => matchesRule(candidate, rule, categoryOverrides));
}

export function durationToMs(rule: Pick<RetentionRule, "duration" | "unit">): number {
  const multiplier = rule.unit === "minutes" ? 60_000 : rule.unit === "hours" ? 3_600_000 : 86_400_000;
  return Math.max(1, rule.duration) * multiplier;
}

export function getExpirationTime(lastVisitTime: number, rule: RetentionRule): number {
  return rule.deleteImmediately ? lastVisitTime : lastVisitTime + durationToMs(rule);
}
