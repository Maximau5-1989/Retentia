import type { RetentionRule, RuleKind } from "../shared/types";

export type ManualTargetKind = "url" | "domain";

export interface ManualTargetUpdate {
  rule: RetentionRule;
  normalized: string;
  alreadyExists: boolean;
}

export function normalizeHttpUrl(input: string): string {
  let candidate = input.trim();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.href;
    } catch {
      // A browser History handoff can contain an encoded URL. Decode it below and try again.
    }

    try {
      const decoded = decodeURIComponent(candidate);
      if (decoded === candidate) break;
      candidate = decoded.trim();
    } catch {
      break;
    }
  }
  throw new Error("Only http:// and https:// history URLs are supported");
}

export function normalizeDomain(input: string): string {
  const candidate = input.trim();
  if (!candidate) throw new Error("Enter a domain or website URL");
  try {
    const parsed = new URL(/^https?:\/\//i.test(candidate) ? normalizeHttpUrl(candidate) : `https://${candidate}`);
    if (!parsed.hostname) throw new Error();
    return parsed.hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
  } catch {
    throw new Error("Enter a valid domain, such as example.com");
  }
}

export function normalizeRulePattern(kind: RuleKind, input: string): string {
  if (kind === "domain") return normalizeDomain(input);
  if (kind === "exact") return normalizeHttpUrl(input);
  const pattern = input.trim();
  if (!pattern) throw new Error("Enter a match pattern");
  if (kind === "regex") {
    try {
      new RegExp(pattern, "i");
    } catch {
      throw new Error("This legacy regular expression is invalid");
    }
  }
  return pattern;
}

export function addManualTarget(rule: RetentionRule, kind: ManualTargetKind, input: string): ManualTargetUpdate {
  const normalized = kind === "url" ? normalizeHttpUrl(input) : normalizeDomain(input);
  const property = kind === "url" ? "additionalUrls" : "additionalDomains";
  const current = rule[property] ?? [];
  const alreadyExists = current.includes(normalized);
  return {
    rule: alreadyExists ? rule : { ...rule, [property]: [...current, normalized] },
    normalized,
    alreadyExists,
  };
}

export function removeManualTarget(rule: RetentionRule, kind: ManualTargetKind, target: string): RetentionRule {
  if (kind === "url") return { ...rule, additionalUrls: (rule.additionalUrls ?? []).filter((item) => item !== target) };
  return { ...rule, additionalDomains: (rule.additionalDomains ?? []).filter((item) => item !== target) };
}

export function matchesManualTarget(url: string, rule: RetentionRule): boolean {
  try {
    const normalizedUrl = normalizeHttpUrl(url);
    if (rule.additionalUrls?.includes(normalizedUrl)) return true;
    const hostname = new URL(normalizedUrl).hostname.toLowerCase().replace(/^www\./, "");
    return rule.additionalDomains?.some((storedDomain) => {
      const domain = storedDomain.toLowerCase().replace(/^www\./, "");
      return hostname === domain || hostname.endsWith(`.${domain}`);
    }) ?? false;
  } catch {
    return false;
  }
}
