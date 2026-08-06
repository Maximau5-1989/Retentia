export type RuleKind = "exact" | "domain" | "wildcard" | "regex";
export type TimeUnit = "minutes" | "hours" | "days";

export interface RetentionRule {
  id: string;
  name: string;
  kind: RuleKind;
  pattern: string;
  duration: number;
  unit: TimeUnit;
  enabled: boolean;
  priority: number;
  createdAt: number;
}

export interface Settings {
  enabled: boolean;
  scanIntervalMinutes: number;
  historyWindowDays: number;
  maxLogEntries: number;
  onboardingComplete: boolean;
  theme: "light" | "dark";
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
