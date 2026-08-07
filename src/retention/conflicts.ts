import { normalizeHostname, resolveCategory } from "../shared/categories";
import type { CategoryOverrides, RetentionRule } from "../shared/types";

export interface RuleConflict {
  first: RetentionRule;
  second: RetentionRule;
  winner: RetentionRule;
  reason: string;
}

export function detectRuleConflicts(rules: RetentionRule[], overrides: CategoryOverrides = {}): RuleConflict[] {
  const enabled = rules.filter((rule) => rule.enabled);
  const conflicts: RuleConflict[] = [];
  for (let firstIndex = 0; firstIndex < enabled.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < enabled.length; secondIndex += 1) {
      const first = enabled[firstIndex];
      const second = enabled[secondIndex];
      const reason = overlapReason(first, second, overrides);
      if (!reason) continue;
      conflicts.push({ first, second, winner: pickWinner(first, second), reason });
    }
  }
  return conflicts;
}

function overlapReason(first: RetentionRule, second: RetentionRule, overrides: CategoryOverrides): string | undefined {
  if (first.kind === second.kind && first.pattern.toLowerCase() === second.pattern.toLowerCase()) return "Both rules use the same match pattern.";
  if (first.kind === "domain" && second.kind === "domain" && domainsOverlap(first.pattern, second.pattern)) return "The domain rules include the same website hierarchy.";
  if (first.kind === "exact" && second.kind === "domain" && exactBelongsToDomain(first.pattern, second.pattern)) return "The exact URL is also covered by the domain rule.";
  if (second.kind === "exact" && first.kind === "domain" && exactBelongsToDomain(second.pattern, first.pattern)) return "The exact URL is also covered by the domain rule.";
  if (first.kind === "category" && ruleBelongsToCategory(second, first.pattern, overrides)) return "The specific rule is also covered by the category rule.";
  if (second.kind === "category" && ruleBelongsToCategory(first, second.pattern, overrides)) return "The specific rule is also covered by the category rule.";
  return undefined;
}

function domainsOverlap(first: string, second: string): boolean {
  const a = normalizeHostname(first);
  const b = normalizeHostname(second);
  return Boolean(a && b && (a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`)));
}

function exactBelongsToDomain(exact: string, domain: string): boolean {
  const exactDomain = normalizeHostname(exact);
  const ruleDomain = normalizeHostname(domain);
  return Boolean(exactDomain && ruleDomain && (exactDomain === ruleDomain || exactDomain.endsWith(`.${ruleDomain}`)));
}

function ruleBelongsToCategory(rule: RetentionRule, category: string, overrides: CategoryOverrides): boolean {
  if (rule.kind === "category") return rule.pattern === category;
  if (rule.kind !== "domain" && rule.kind !== "exact") return false;
  return resolveCategory(rule.pattern, overrides) === category;
}

function pickWinner(first: RetentionRule, second: RetentionRule): RetentionRule {
  return first.priority > second.priority || (first.priority === second.priority && first.createdAt < second.createdAt) ? first : second;
}
