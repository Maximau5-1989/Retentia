import type { RetentionRule } from "./types";

export function formatDate(timestamp?: number): string {
  if (!timestamp) return "Never";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(timestamp);
}

export function formatDuration(rule: Pick<RetentionRule, "duration" | "unit">): string {
  return `${rule.duration} ${rule.duration === 1 ? rule.unit.replace(/s$/, "") : rule.unit}`;
}

export function shortenUrl(url: string, max = 62): string {
  try {
    const parsed = new URL(url);
    const value = `${parsed.hostname}${parsed.pathname}${parsed.search}`;
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
  } catch { return url; }
}
