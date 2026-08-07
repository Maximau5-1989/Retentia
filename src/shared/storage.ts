import { DEFAULT_SETTINGS, SESSION_KEYS, STORAGE_KEYS } from "./defaults";
import type { ActivityEntry, AuthThrottle, CategoryOverrides, PasswordRecord, ProtectedDomains, RetentionRule, ScanResult, Settings } from "./types";

async function getLocal<T>(key: string, fallback: T): Promise<T> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as T | undefined) ?? fallback;
}

export const storage = {
  getRules: () => getLocal<RetentionRule[]>(STORAGE_KEYS.rules, []),
  setRules: (rules: RetentionRule[]) => chrome.storage.local.set({ [STORAGE_KEYS.rules]: rules }),
  getCategoryOverrides: () => getLocal<CategoryOverrides>(STORAGE_KEYS.categoryOverrides, {}),
  setCategoryOverrides: (overrides: CategoryOverrides) => chrome.storage.local.set({ [STORAGE_KEYS.categoryOverrides]: overrides }),
  getProtectedDomains: () => getLocal<ProtectedDomains>(STORAGE_KEYS.protectedDomains, []),
  setProtectedDomains: (domains: ProtectedDomains) => chrome.storage.local.set({ [STORAGE_KEYS.protectedDomains]: domains }),
  getDefaultCategoryRulesVersion: () => getLocal<number>(STORAGE_KEYS.defaultCategoryRulesVersion, 0),
  setDefaultCategoryRulesVersion: (version: number) => chrome.storage.local.set({ [STORAGE_KEYS.defaultCategoryRulesVersion]: version }),
  async getSettings(): Promise<Settings> {
    return { ...DEFAULT_SETTINGS, ...(await getLocal<Partial<Settings>>(STORAGE_KEYS.settings, {})) };
  },
  setSettings: (settings: Settings) => chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings }),
  getActivity: () => getLocal<ActivityEntry[]>(STORAGE_KEYS.activity, []),
  async addActivity(entry: ActivityEntry, maxEntries: number): Promise<void> {
    const current = await this.getActivity();
    await chrome.storage.local.set({ [STORAGE_KEYS.activity]: [entry, ...current].slice(0, maxEntries) });
  },
  clearActivity: () => chrome.storage.local.set({ [STORAGE_KEYS.activity]: [] }),
  getLastScan: () => getLocal<ScanResult | null>(STORAGE_KEYS.lastScan, null),
  setLastScan: (result: ScanResult) => chrome.storage.local.set({ [STORAGE_KEYS.lastScan]: { ...result, candidates: [] } }),
  getPassword: () => getLocal<PasswordRecord | null>(STORAGE_KEYS.password, null),
  setPassword: (password: PasswordRecord) => chrome.storage.local.set({ [STORAGE_KEYS.password]: password }),
  removePassword: () => chrome.storage.local.remove(STORAGE_KEYS.password),
  getAuthThrottle: () => getLocal<AuthThrottle>(STORAGE_KEYS.authThrottle, { failedAttempts: 0, lockUntil: 0 }),
  setAuthThrottle: (throttle: AuthThrottle) => chrome.storage.local.set({ [STORAGE_KEYS.authThrottle]: throttle }),
  resetAuthThrottle: () => chrome.storage.local.set({ [STORAGE_KEYS.authThrottle]: { failedAttempts: 0, lockUntil: 0 } }),
  async resetProtectedData(): Promise<void> {
    const settings = await this.getSettings();
    await chrome.storage.local.remove([STORAGE_KEYS.password, STORAGE_KEYS.rules, STORAGE_KEYS.activity, STORAGE_KEYS.lastScan, STORAGE_KEYS.authThrottle, STORAGE_KEYS.categoryOverrides, STORAGE_KEYS.protectedDomains, STORAGE_KEYS.defaultCategoryRulesVersion]);
    await this.setSettings({ ...settings, onboardingComplete: false, testingBypassPassword: false });
  },
  async sanitizePrivacyData(): Promise<void> {
    const rawActivity = await getLocal<Array<ActivityEntry & { url?: string; ruleId?: string }>>(STORAGE_KEYS.activity, []);
    const legacyDeleted = rawActivity.filter((entry) => entry.type === "deleted" && (entry.url || entry.ruleId));
    const sanitized = rawActivity
      .filter((entry) => !legacyDeleted.includes(entry))
      .map(({ id, timestamp, type, message, count }) => ({ id, timestamp, type, message, ...(count ? { count } : {}) }));
    if (legacyDeleted.length) sanitized.unshift({
      id: crypto.randomUUID(), timestamp: Date.now(), type: "deleted", count: legacyDeleted.length,
      message: `${legacyDeleted.length} site${legacyDeleted.length === 1 ? "" : "s"} removed · legacy URL details cleared`,
    });
    const lastScan = await this.getLastScan();
    await chrome.storage.local.set({
      [STORAGE_KEYS.activity]: sanitized,
      ...(lastScan ? { [STORAGE_KEYS.lastScan]: { ...lastScan, candidates: [] } } : {}),
    });
  },
};

export const sessionStorage = {
  async isUnlocked(): Promise<boolean> {
    const result = await chrome.storage.session.get(SESSION_KEYS.unlocked);
    return result[SESSION_KEYS.unlocked] === true;
  },
  unlock: () => chrome.storage.session.set({ [SESSION_KEYS.unlocked]: true }),
  async lock(): Promise<void> {
    await chrome.storage.session.remove([SESSION_KEYS.unlocked, SESSION_KEYS.dashboardTabId]);
  },
  setDashboardTabId: (tabId: number) => chrome.storage.session.set({ [SESSION_KEYS.dashboardTabId]: tabId }),
  async getDashboardTabId(): Promise<number | undefined> {
    const result = await chrome.storage.session.get(SESSION_KEYS.dashboardTabId);
    return result[SESSION_KEYS.dashboardTabId] as number | undefined;
  },
};
