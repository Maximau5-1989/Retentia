export type RuleKind = "exact" | "domain" | "category" | "wildcard" | "regex";
export type TimeUnit = "minutes" | "hours" | "days";
export type CategoryId = "social" | "shopping" | "news" | "streaming" | "search" | "travel" | "entertainment" | "adult";

export interface RetentionRule {
  id: string;
  name: string;
  kind: RuleKind;
  pattern: string;
  duration: number;
  unit: TimeUnit;
  enabled: boolean;
  deleteImmediately?: boolean;
  additionalUrls?: string[];
  priority: number;
  category?: CategoryId;
  createdAt: number;
}

export interface Settings {
  enabled: boolean;
  scanIntervalMinutes: number;
  historyWindowDays: number;
  maxLogEntries: number;
  onboardingComplete: boolean;
  theme: "light" | "dark";
  testingBypassPassword?: boolean;
}

export interface PasswordRecord {
  salt: string;
  hash: string;
  iterations: number;
  createdAt: number;
}

export interface AuthThrottle {
  failedAttempts: number;
  lockUntil: number;
}

export interface ActivityEntry {
  id: string;
  timestamp: number;
  type: "deleted" | "scan" | "error";
  message: string;
  count?: number;
}

export interface HistoryCandidate {
  url: string;
  title: string;
  lastVisitTime: number;
  visitCount: number;
  rule: RetentionRule;
  expiresAt: number;
  expired: boolean;
}

export interface ScanResult {
  scanned: number;
  matched: number;
  expired: number;
  deleted: number;
  candidates: HistoryCandidate[];
  runAt: number;
}

export interface CategoryScanBucket {
  category?: CategoryId;
  urls: number;
  visits: number;
  domains: CategoryScanDomain[];
}

export interface CategoryScanDomain {
  domain: string;
  urls: number;
  visits: number;
  overridden: boolean;
  confidence: "high" | "medium" | "none";
  score: number;
  suggestedCategory?: CategoryId;
}

export type CategoryOverrides = Record<string, CategoryId>;
export type ProtectedDomains = string[];

export interface RetentiaBackup {
  format: "retentia-backup";
  schemaVersion: 1;
  exportedAt: string;
  appVersion: string;
  rules: RetentionRule[];
  settings: Settings;
  categoryOverrides: CategoryOverrides;
  protectedDomains: ProtectedDomains;
}

export interface CategoryScanResult {
  scanned: number;
  categorized: number;
  uncategorized: number;
  buckets: CategoryScanBucket[];
  runAt: number;
  resultLimitReached: boolean;
}
