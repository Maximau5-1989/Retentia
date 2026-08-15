import type { CategoryId, CategoryOverrides, CategoryRejections, RetentiaBackup, RetentionRule, RuleKind, Settings, TimeUnit } from "./types";

const RULE_KINDS = new Set<RuleKind>(["exact", "domain", "category", "wildcard", "regex"]);
const TIME_UNITS = new Set<TimeUnit>(["minutes", "hours", "days"]);
const CATEGORY_IDS = new Set<CategoryId>(["social", "shopping", "news", "streaming", "search", "travel", "entertainment", "adult"]);

export function createBackup(data: Omit<RetentiaBackup, "format" | "schemaVersion" | "exportedAt">): RetentiaBackup {
  return {
    format: "retentia-backup",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    ...data,
    categoryRejections: data.categoryRejections ?? {},
  };
}

export function parseBackup(input: string): RetentiaBackup {
  const value: unknown = JSON.parse(input);
  if (!isRecord(value) || value.format !== "retentia-backup" || value.schemaVersion !== 1) throw new Error("This is not a supported Retentia backup.");
  if (!Array.isArray(value.rules) || !value.rules.every(isRule)) throw new Error("The backup contains invalid retention rules.");
  if (!isSettings(value.settings)) throw new Error("The backup contains invalid settings.");
  if (!isOverrides(value.categoryOverrides)) throw new Error("The backup contains invalid category overrides.");
  if (value.categoryRejections !== undefined && !isRejections(value.categoryRejections)) throw new Error("The backup contains invalid rejected category suggestions.");
  if (!Array.isArray(value.protectedDomains) || !value.protectedDomains.every((domain) => typeof domain === "string")) throw new Error("The backup contains invalid protected websites.");
  if (typeof value.exportedAt !== "string" || typeof value.appVersion !== "string") throw new Error("The backup metadata is incomplete.");
  const { testingBypassPassword: _legacyPasswordBypass, ...settings } = value.settings as Settings & { testingBypassPassword?: unknown };
  return { ...value, categoryRejections: value.categoryRejections ?? {}, settings } as unknown as RetentiaBackup;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isRule(value: unknown): value is RetentionRule {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.name === "string" && RULE_KINDS.has(value.kind as RuleKind)
    && typeof value.pattern === "string" && typeof value.duration === "number" && Number.isFinite(value.duration) && value.duration > 0
    && TIME_UNITS.has(value.unit as TimeUnit) && typeof value.enabled === "boolean"
    && (value.deleteImmediately === undefined || typeof value.deleteImmediately === "boolean")
    && (value.additionalUrls === undefined || (Array.isArray(value.additionalUrls) && value.additionalUrls.every((url) => typeof url === "string")))
    && (value.additionalDomains === undefined || (Array.isArray(value.additionalDomains) && value.additionalDomains.every((domain) => typeof domain === "string")))
    && typeof value.priority === "number" && Number.isFinite(value.priority) && typeof value.createdAt === "number" && Number.isFinite(value.createdAt)
    && (value.category === undefined || CATEGORY_IDS.has(value.category as CategoryId));
}

function isSettings(value: unknown): value is Settings {
  if (!isRecord(value)) return false;
  return typeof value.enabled === "boolean" && isIntegerBetween(value.scanIntervalMinutes, 1, 1_440)
    && isIntegerBetween(value.historyWindowDays, 1, 3_650) && isIntegerBetween(value.maxLogEntries, 10, 5_000)
    && typeof value.onboardingComplete === "boolean" && (value.theme === "light" || value.theme === "dark")
    && (value.testingBypassPassword === undefined || typeof value.testingBypassPassword === "boolean");
}

function isOverrides(value: unknown): value is CategoryOverrides {
  return isRecord(value) && Object.values(value).every((category) => category === null || CATEGORY_IDS.has(category as CategoryId));
}

function isIntegerBetween(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum;
}

function isRejections(value: unknown): value is CategoryRejections {
  return isRecord(value) && Object.values(value).every((categories) => Array.isArray(categories) && categories.every((category) => CATEGORY_IDS.has(category as CategoryId)));
}
