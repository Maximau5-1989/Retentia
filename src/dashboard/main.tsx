import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { PasswordModal } from "../components/PasswordModal";
import { ThemeButton } from "../components/ThemeButton";
import { ChangePassword } from "../components/ChangePassword";
import { cleanExpiredForRule, deleteHistoryMatchingRule, scanHistory, scanHistoryCategories } from "../retention/engine";
import { detectRuleConflicts } from "../retention/conflicts";
import { addManualTarget, normalizeHttpUrl, normalizeRulePattern, removeManualTarget } from "../retention/manual-targets";
import type { ManualTargetKind } from "../retention/manual-targets";
import { groupSimulatorCandidates } from "./simulator";
import { normalizeProtectedDomain } from "../retention/protection";
import { formatDate, shortenUrl } from "../shared/format";
import { sessionStorage, storage } from "../shared/storage";
import { CATEGORY_PRESETS, getCategoryPreset, suggestCategory } from "../shared/categories";
import { addMissingDefaultCategoryRules, DEFAULT_CATEGORY_RULES_VERSION } from "../shared/default-rules";
import { DEFAULT_SETTINGS } from "../shared/defaults";
import { createBackup, parseBackup } from "../shared/backup";
import { SUPPORT_URL } from "../shared/support";
import type { ActivityEntry, CategoryId, CategoryOverrides, CategoryRejections, CategoryScanResult, RetentionRule, RuleKind, ScanResult, Settings, TimeUnit } from "../shared/types";
import "../styles.css";

type View = "overview" | "rules" | "categories" | "simulator" | "activity" | "settings";
type CategoryFilter = "all" | "review" | "custom" | "automatic";
const EMPTY_RULE: Omit<RetentionRule, "id" | "createdAt"> = { name: "", kind: "domain", pattern: "", duration: 7, unit: "days", enabled: true, deleteImmediately: false, priority: 50 };
const DASHBOARD_VIEWS: ReadonlyArray<{ id: View; label: string; description: string }> = [
  { id: "overview", label: "Overview", description: "See Retentia's current protection and recent cleanup totals." },
  { id: "rules", label: "Rules", description: "Create and manage the retention rules applied to browser history." },
  { id: "categories", label: "Categories", description: "Review local classifications and correct automatic category matches." },
  { id: "simulator", label: "Simulator", description: "Preview what enabled rules match before removing browser history." },
  { id: "activity", label: "Activity", description: "Review privacy-safe cleanup totals without stored URLs or domains." },
  { id: "settings", label: "Settings", description: "Configure protection, security, backups, and protected websites." },
];
const MATCH_TYPE_DESCRIPTIONS: Record<RuleKind, string> = {
  domain: "Matches this domain and all of its subdomains, regardless of the page path.",
  exact: "Matches only the complete URL exactly as entered, including its path and query.",
  category: "Applies the rule to all URLs that are grouped into the selected category.",
  wildcard: "Legacy advanced rule. Existing wildcard matching remains supported; choose another match type to convert it.",
  regex: "Legacy advanced rule. Existing regular-expression matching remains supported; choose another match type to convert it.",
};

function countSuggestedUrls(scan: CategoryScanResult, category: CategoryId): number {
  return scan.buckets.find((bucket) => !bucket.category)?.domains
    .filter((domain) => domain.suggestedCategory === category)
    .reduce((total, domain) => total + domain.urls, 0) ?? 0;
}

function getSuggestedDomains(scan: CategoryScanResult, category: CategoryId) {
  return scan.buckets.find((bucket) => !bucket.category)?.domains
    .filter((domain) => domain.suggestedCategory === category) ?? [];
}

function parseCategoryChoice(value: string): CategoryId | null | undefined {
  if (value === "automatic") return undefined;
  if (value === "uncategorized") return null;
  return value as CategoryId;
}

function isView(value: string | null): value is View {
  return DASHBOARD_VIEWS.some((item) => item.id === value);
}

async function loadRulesWithDefaults(): Promise<RetentionRule[]> {
  const [loadedRules, preparedVersion] = await Promise.all([
    storage.getRules(),
    storage.getDefaultCategoryRulesVersion(),
  ]);
  if (preparedVersion >= DEFAULT_CATEGORY_RULES_VERSION) return loadedRules;

  const { rules } = addMissingDefaultCategoryRules(loadedRules);
  await Promise.all([
    storage.setRules(rules),
    storage.setDefaultCategoryRulesVersion(DEFAULT_CATEGORY_RULES_VERSION),
  ]);
  return rules;
}

function Dashboard() {
  const extensionVersion = chrome.runtime.getManifest().version;
  const initialParameters = new URLSearchParams(window.location.search);
  const requestedRuleUrl = initialParameters.get("createRule") || "";
  const requestedAddToRuleUrl = initialParameters.get("addToRule") || "";
  const requestedView = initialParameters.get("view");
  const [view, setView] = useState<View>(requestedRuleUrl || requestedAddToRuleUrl ? "rules" : isView(requestedView) ? requestedView : "overview");
  const [rules, setRules] = useState<RetentionRule[]>([]);
  const [settings, setSettings] = useState<Settings>();
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [draft, setDraft] = useState(EMPTY_RULE);
  const [editingId, setEditingId] = useState<string>();
  const [simulating, setSimulating] = useState(false);
  const [notice, setNotice] = useState("");
  const [passwordReady, setPasswordReady] = useState<boolean | null>(null);
  const [appUnlocked, setAppUnlocked] = useState<boolean | null>(null);
  const [deleteExisting, setDeleteExisting] = useState(false);
  const [pendingRuleUrl, setPendingRuleUrl] = useState(requestedRuleUrl);
  const [pendingAddToRuleUrl, setPendingAddToRuleUrl] = useState(requestedAddToRuleUrl);
  const [categoryScan, setCategoryScan] = useState<CategoryScanResult>();
  const [scanningCategories, setScanningCategories] = useState(false);
  const [categoryOverrides, setCategoryOverrides] = useState<CategoryOverrides>({});
  const [categoryRejections, setCategoryRejections] = useState<CategoryRejections>({});
  const [protectedDomains, setProtectedDomains] = useState<string[]>([]);
  const [protectedDraft, setProtectedDraft] = useState("");
  const [manualRuleId, setManualRuleId] = useState("");
  const [manualTargetKind, setManualTargetKind] = useState<ManualTargetKind>("domain");
  const [manualTargetDraft, setManualTargetDraft] = useState("");
  const [historyTargetKind, setHistoryTargetKind] = useState<ManualTargetKind>("url");
  const [expandedSimulatorRules, setExpandedSimulatorRules] = useState<string[]>([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [expandedCategoryBuckets, setExpandedCategoryBuckets] = useState<string[]>([]);
  const [newRuleExpanded, setNewRuleExpanded] = useState(true);
  const [addExistingRuleExpanded, setAddExistingRuleExpanded] = useState(Boolean(requestedAddToRuleUrl));

  async function refresh() {
    await storage.sanitizePrivacyData();
    const [loadedSettings, loadedActivity, loadedScan, password, unlocked] = await Promise.all([storage.getSettings(), storage.getActivity(), storage.getLastScan(), storage.getPassword(), sessionStorage.isUnlocked()]);
    setSettings(loadedSettings); setActivity(loadedActivity); setLastScan(loadedScan);
    setPasswordReady(Boolean(password));
    const accessGranted = Boolean(loadedSettings.testingBypassPassword) || unlocked;
    setAppUnlocked(accessGranted);
    if (accessGranted) {
      const [loadedRules, loadedOverrides, loadedRejections, loadedProtected] = await Promise.all([loadRulesWithDefaults(), storage.getCategoryOverrides(), storage.getCategoryRejections(), storage.getProtectedDomains()]);
      setRules(loadedRules); setCategoryOverrides(loadedOverrides); setCategoryRejections(loadedRejections); setProtectedDomains(loadedProtected);
      setManualRuleId((current) => current || loadedRules[0]?.id || "");
      await chrome.runtime.sendMessage({ type: "REGISTER_DASHBOARD_TAB" });
      applyPendingRuleUrl();
    }
  }
  useEffect(() => {
    if (requestedAddToRuleUrl) window.history.replaceState({}, "", "dashboard.html");
    void refresh();
  }, []);

  useEffect(() => {
    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName === "local" && changes.settings?.newValue) setSettings({ ...DEFAULT_SETTINGS, ...changes.settings.newValue } as Settings);
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 10_000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function persistRules(next: RetentionRule[]) { setRules(next); await storage.setRules(next); }
  async function attachTargetToRule(ruleId: string, kind: ManualTargetKind, input: string) {
    const selectedRule = rules.find((rule) => rule.id === ruleId);
    if (!selectedRule) throw new Error("Choose an existing rule");
    const update = addManualTarget(selectedRule, kind, input);
    if (!update.alreadyExists) {
      await persistRules(rules.map((rule) => rule.id === ruleId ? update.rule : rule));
    }
    return { ...update, ruleName: selectedRule.name };
  }
  async function addPendingUrlToExistingRule(ruleId: string) {
    if (!pendingAddToRuleUrl) return;
    try {
      const update = await attachTargetToRule(ruleId, historyTargetKind, pendingAddToRuleUrl);
      setPendingAddToRuleUrl("");
      const targetLabel = historyTargetKind === "url" ? "URL" : "Domain";
      setNotice(update.alreadyExists ? `${targetLabel} already added` : `${targetLabel} added`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Chrome did not provide a valid history URL");
    }
  }
  async function addManualWebsite(event: React.FormEvent) {
    event.preventDefault();
    try {
      const update = await attachTargetToRule(manualRuleId, manualTargetKind, manualTargetDraft);
      const targetLabel = manualTargetKind === "url" ? "URL" : "Domain";
      setNotice(update.alreadyExists ? `${targetLabel} already added` : `${targetLabel} added`);
      if (!update.alreadyExists) setManualTargetDraft("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Website could not be added");
    }
  }
  async function detachTargetFromRule(ruleId: string, kind: ManualTargetKind, target: string) {
    const selectedRule = rules.find((rule) => rule.id === ruleId);
    if (!selectedRule) return;
    const updatedRule = removeManualTarget(selectedRule, kind, target);
    await persistRules(rules.map((rule) => rule.id === ruleId ? updatedRule : rule));
    setNotice(`${kind === "url" ? "URL" : "Domain"} removed from ${selectedRule.name}`);
  }
  function applyCategory(category?: CategoryId) {
    const preset = getCategoryPreset(category);
    setDraft(current => ({ ...current, category, ...(current.kind === "category" && category ? { pattern: category } : {}), ...(preset ? { duration: preset.duration, unit: preset.unit, deleteImmediately: preset.deleteImmediately ?? false } : {}) }));
  }
  function suggestDraftCategory() {
    if (draft.category) return;
    const preset = suggestCategory(draft.pattern);
    if (preset) applyCategory(preset.id);
  }
  async function saveRule(event: React.FormEvent) {
    event.preventDefault();
    const isNewRule = !editingId;
    const name = draft.name.trim();
    if (!name) { setNotice("Enter a rule name"); return; }
    let pattern: string;
    try {
      pattern = normalizeRulePattern(draft.kind, draft.pattern);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Enter a valid match pattern");
      return;
    }
    if (isNewRule && deleteExisting && !confirm("Create this rule and permanently delete every existing history URL that matches it? This cannot be undone.")) return;
    const normalizedDraft = { ...draft, name, pattern };
    const rule = editingId
      ? { ...rules.find((item) => item.id === editingId)!, ...normalizedDraft }
      : { ...normalizedDraft, id: crypto.randomUUID(), createdAt: Date.now() };
    await persistRules(editingId ? rules.map((item) => item.id === editingId ? rule : item) : [rule, ...rules]);
    let removed = 0;
    if (isNewRule && deleteExisting) removed = await deleteHistoryMatchingRule(rule);
    setDraft(EMPTY_RULE); setEditingId(undefined); setDeleteExisting(false); setNotice(removed ? `Rule saved · ${removed} matching URL${removed === 1 ? "" : "s"} removed` : "Rule saved");
    if (removed) setActivity(await storage.getActivity());
  }
  function editRule(rule: RetentionRule) { setEditingId(rule.id); setNewRuleExpanded(true); setDeleteExisting(false); setDraft({ name: rule.name, kind: rule.kind, pattern: rule.pattern, duration: rule.duration, unit: rule.unit, enabled: rule.enabled, deleteImmediately: rule.deleteImmediately ?? false, priority: rule.priority, category: rule.category }); window.scrollTo({ top: 0, behavior: "smooth" }); }
  async function simulate() { setSimulating(true); try { setLastScan(await scanHistory(false)); } finally { setSimulating(false); } }
  async function runCleanup() { if (!confirm("Delete all currently expired matching URLs from browser history? This cannot be undone.")) return; setSimulating(true); try { setLastScan(await scanHistory(true)); await refresh(); setNotice("Cleanup complete"); } finally { setSimulating(false); } }
  async function runCategoryScan() { setScanningCategories(true); try { setCategoryScan(await scanHistoryCategories()); } finally { setScanningCategories(false); } }
  async function prepareDefaultRules(activate: boolean) {
    if (activate && !confirm("Activate all built-in category rules and permanently remove matching history according to each rule's deletion timing? Immediate categories remove every match. This cannot be undone.")) return;
    const prepared = addMissingDefaultCategoryRules(rules, { enabled: activate });
    const next = activate ? prepared.rules.map((rule) => rule.kind === "category" ? { ...rule, enabled: true } : rule) : prepared.rules;
    await Promise.all([persistRules(next), storage.setDefaultCategoryRulesVersion(DEFAULT_CATEGORY_RULES_VERSION)]);
    if (!activate) {
      setNotice(prepared.additions.length
        ? `${prepared.additions.length} disabled default rule${prepared.additions.length === 1 ? "" : "s"} prepared`
        : "All default category rules are already prepared");
      return;
    }
    const result = await scanHistory(true, true);
    setLastScan(result); setActivity(await storage.getActivity());
    setNotice(`Default rules activated · ${result.deleted} matching history URL${result.deleted === 1 ? "" : "s"} removed`);
  }
  async function moveDomain(domain: string, category: CategoryId | null | undefined) {
    const [overrides, rejections] = await Promise.all([storage.getCategoryOverrides(), storage.getCategoryRejections()]);
    if (category !== undefined) overrides[domain] = category; else delete overrides[domain];
    if (category && rejections[domain]?.includes(category)) {
      rejections[domain] = rejections[domain].filter((item) => item !== category);
      if (!rejections[domain].length) delete rejections[domain];
    }
    await Promise.all([storage.setCategoryOverrides(overrides), storage.setCategoryRejections(rejections)]);
    setCategoryOverrides({ ...overrides });
    setCategoryRejections({ ...rejections });
    setCategoryScan(await scanHistoryCategories());
    setNotice(category
      ? `${domain} classified as ${getCategoryPreset(category)?.label}`
      : category === null
        ? `${domain} will remain uncategorized`
        : `${domain} restored to automatic categorization`);
  }
  async function restoreCategorySuggestion(domain: string, category: CategoryId) {
    const rejections = await storage.getCategoryRejections();
    rejections[domain] = (rejections[domain] ?? []).filter((item) => item !== category);
    if (!rejections[domain].length) delete rejections[domain];
    await storage.setCategoryRejections(rejections);
    setCategoryRejections({ ...rejections });
    if (categoryScan) setCategoryScan(await scanHistoryCategories());
    setNotice(`${getCategoryPreset(category)?.label} suggestion restored for ${domain}`);
  }
  async function toggleCategoryRule(category: CategoryId) {
    const preset = getCategoryPreset(category)!;
    const existing = rules.find((rule) => rule.kind === "category" && rule.pattern === category);
    const nextRule: RetentionRule = existing ? { ...existing, enabled: !existing.enabled } : {
      id: crypto.randomUUID(), name: preset.label, kind: "category", pattern: category, category,
      duration: preset.duration, unit: preset.unit, deleteImmediately: preset.deleteImmediately ?? false, enabled: true, priority: 40, createdAt: Date.now(),
    };
    await persistRules(existing ? rules.map((rule) => rule.id === existing.id ? nextRule : rule) : [nextRule, ...rules]);
    setNotice(`${preset.label} rule ${nextRule.enabled ? "activated" : "paused"}`);
  }
  async function cleanCategory(category: CategoryId) {
    const preset = getCategoryPreset(category)!;
    const existing = rules.find((rule) => rule.kind === "category" && rule.pattern === category);
    const cleanupDescription = (existing?.deleteImmediately ?? preset.deleteImmediately)
      ? "all matching history for this category"
      : `history that is older than ${existing?.duration ?? preset.duration} ${existing?.unit ?? preset.unit}`;
    if (!confirm(`Activate ${preset.label} and permanently remove ${cleanupDescription}? Protected websites are always skipped.`)) return;
    const activeRule: RetentionRule = existing ? { ...existing, enabled: true } : {
      id: crypto.randomUUID(), name: preset.label, kind: "category", pattern: category, category,
      duration: preset.duration, unit: preset.unit, deleteImmediately: preset.deleteImmediately ?? false, enabled: true, priority: 40, createdAt: Date.now(),
    };
    await persistRules(existing ? rules.map((rule) => rule.id === existing.id ? activeRule : rule) : [activeRule, ...rules]);
    const removed = await cleanExpiredForRule(activeRule);
    setActivity(await storage.getActivity()); setNotice(`${preset.label} activated · ${removed} matching URL${removed === 1 ? "" : "s"} removed`);
  }
  async function addProtectedDomain(event: React.FormEvent) {
    event.preventDefault();
    const domain = normalizeProtectedDomain(protectedDraft);
    if (!domain) { setNotice("Enter a valid website or domain"); return; }
    if (protectedDomains.includes(domain)) { setNotice(`${domain} is already protected`); return; }
    const next = [...protectedDomains, domain].sort();
    await storage.setProtectedDomains(next); setProtectedDomains(next); setProtectedDraft(""); setNotice(`${domain} will never be removed`);
  }
  async function removeProtectedDomain(domain: string) {
    if (!confirm(`Stop protecting ${domain}? Retention rules may remove it during a future cleanup.`)) return;
    const next = protectedDomains.filter((item) => item !== domain);
    await storage.setProtectedDomains(next); setProtectedDomains(next); setNotice(`${domain} removed from protection`);
  }
  async function exportBackup() {
    const [backupRules, backupSettings, overrides, rejections, domains] = await Promise.all([storage.getRules(), storage.getSettings(), storage.getCategoryOverrides(), storage.getCategoryRejections(), storage.getProtectedDomains()]);
    const backup = createBackup({ appVersion: extensionVersion, rules: backupRules, settings: backupSettings, categoryOverrides: overrides, categoryRejections: rejections, protectedDomains: domains });
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `retentia-backup-v${extensionVersion}.json`; link.click(); URL.revokeObjectURL(url);
    setNotice("Privacy-safe backup exported");
  }
  async function importBackup(file?: File) {
    if (!file) return;
    try {
      const backup = parseBackup(await file.text());
      if (!confirm(`Restore ${backup.rules.length} rules, settings, category overrides, and protected websites? Current configuration will be replaced. Password, activity totals, and browser history are unchanged.`)) return;
      const restoredRejections = backup.categoryRejections ?? {};
      await Promise.all([storage.setRules(backup.rules), storage.setSettings(backup.settings), storage.setCategoryOverrides(backup.categoryOverrides), storage.setCategoryRejections(restoredRejections), storage.setProtectedDomains(backup.protectedDomains)]);
      setRules(backup.rules); setSettings(backup.settings); setCategoryOverrides(backup.categoryOverrides); setCategoryRejections(restoredRejections); setProtectedDomains(backup.protectedDomains); setNotice("Backup restored successfully");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Backup restore failed"); }
  }
  async function updateSettings(next: Settings) { setSettings(next); await storage.setSettings(next); }
  async function toggleTheme() {
    const next = { ...settings!, theme: settings!.theme === "light" ? "dark" as const : "light" as const };
    await updateSettings(next);
  }
  async function toggleTestingMode() {
    const enable = !settings?.testingBypassPassword;
    if (enable && !confirm("Enable Testing mode? Retentia will temporarily stop asking for the password in the popup and dashboard. The saved password is not removed.")) return;
    const next = { ...settings!, testingBypassPassword: enable };
    await updateSettings(next);
    if (enable) {
      setAppUnlocked(true);
      setNotice("Testing mode enabled · password prompts are temporarily bypassed");
    } else {
      await sessionStorage.lock();
      setAppUnlocked(false);
      setNotice("Testing mode disabled · password lock restored");
    }
  }
  function selectView(next: View) {
    setView(next);
  }
  function toggleCategoryBucket(key: string) {
    setExpandedCategoryBuckets((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  }
  function toggleSimulatorRule(ruleId: string) {
    setExpandedSimulatorRules((current) => current.includes(ruleId) ? current.filter((id) => id !== ruleId) : [...current, ruleId]);
  }

  function applyPendingRuleUrl() {
    if (pendingRuleUrl) {
      try {
        const normalizedUrl = normalizeHttpUrl(pendingRuleUrl);
        const parsed = new URL(normalizedUrl);
        const preset = suggestCategory(parsed.hostname);
        setNewRuleExpanded(true);
        setDraft({ ...EMPTY_RULE, name: parsed.hostname, kind: "exact", pattern: normalizedUrl, ...(preset ? { category: preset.id, duration: preset.duration, unit: preset.unit } : {}) });
        setNotice("History URL loaded · choose a retention period and save the rule");
      } catch { setNotice("Chrome did not provide a valid history URL"); }
      setPendingRuleUrl("");
      window.history.replaceState({}, "", "dashboard.html");
    }
  }
  async function unlockApplication() {
    await sessionStorage.unlock();
    const [loadedRules, loadedOverrides, loadedRejections, loadedProtected] = await Promise.all([loadRulesWithDefaults(), storage.getCategoryOverrides(), storage.getCategoryRejections(), storage.getProtectedDomains()]);
    setRules(loadedRules); setCategoryOverrides(loadedOverrides); setCategoryRejections(loadedRejections); setProtectedDomains(loadedProtected);
    setManualRuleId((current) => current || loadedRules[0]?.id || "");
    setAppUnlocked(true);
    await chrome.runtime.sendMessage({ type: "REGISTER_DASHBOARD_TAB" });
    applyPendingRuleUrl();
  }
  async function resetProtectedData() {
    if (!confirm("Reset Retentia security? This permanently deletes the password, all retention rules, and the activity log. Browser history will NOT be deleted.")) return;
    await storage.resetProtectedData();
    await sessionStorage.lock(); setRules([]); setActivity([]); setLastScan(null); setCategoryRejections({}); setPasswordReady(false); setAppUnlocked(false); setView("overview");
  }

  useEffect(() => {
    if (!settings) return;
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
  }, [settings?.theme]);

  const enabledRules = rules.filter((rule) => rule.enabled).length;
  const ruleConflicts = detectRuleConflicts(rules, categoryOverrides);
  const deletedCount = activity.filter((entry) => entry.type === "deleted").reduce((total, entry) => total + (entry.count ?? 0), 0);
  const selectedManualRule = rules.find((rule) => rule.id === manualRuleId);
  const rejectedCategorySuggestions = Object.entries(categoryRejections).flatMap(([domain, categories]) => categories.map((category) => ({ domain, category })));
  const customCategoryClassifications = Object.entries(categoryOverrides).sort(([first], [second]) => first.localeCompare(second));
  const simulatorRuleGroups = groupSimulatorCandidates(rules, lastScan?.candidates ?? []);
  const currentView = DASHBOARD_VIEWS.find((item) => item.id === view)!;
  const normalizedCategorySearch = categorySearch.trim().toLowerCase();
  const filteredCategoryBuckets = categoryScan?.buckets.map((bucket) => ({
    ...bucket,
    domains: bucket.domains.filter((item) => {
      const matchesSearch = !normalizedCategorySearch || item.domain.toLowerCase().includes(normalizedCategorySearch);
      const matchesFilter = categoryFilter === "all"
        || (categoryFilter === "review" && Boolean(item.suggestedCategory))
        || (categoryFilter === "custom" && item.overridden)
        || (categoryFilter === "automatic" && !item.overridden && !item.suggestedCategory);
      return matchesSearch && matchesFilter;
    }),
  })).filter((bucket) => bucket.domains.length > 0) ?? [];

  if (!settings) return <div className="p-8">Loading Retentia…</div>;
  return <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#edf7e7,transparent_34%),#f5f7f3]">
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r border-[#e0e6dc] bg-white/90 p-5 backdrop-blur dark:border-[#29394a] dark:bg-[#101b28]/95 lg:flex">
      <div className="mb-8 flex items-center gap-3"><img src="/icons/icon-48.png" alt="" className="h-11 w-11" /><div><h1 className="m-0 text-xl font-black">Retentia</h1><span className="pill">v{extensionVersion}</span></div></div>
      <nav aria-label="Dashboard sections" className="space-y-1">{DASHBOARD_VIEWS.map(({ id, label }) => <button type="button" key={id} onClick={() => selectView(id)} aria-current={view === id ? "page" : undefined} className={`w-full rounded-xl border-0 px-4 py-3 text-left font-bold ${view === id ? 'bg-[#18283d] text-white dark:bg-[#82c950] dark:text-[#102017]' : 'bg-transparent text-[#526071] hover:bg-[#f0f4ed] dark:text-[#c4cfdb] dark:hover:bg-[#1a2838]'}`}>{label}</button>)}</nav>
      <div className="mt-auto rounded-2xl bg-[#eef7e8] p-4 text-[#162235] dark:bg-[#203729] dark:text-[#e8eef5]"><p className="m-0 text-sm font-extrabold">Private by design</p><p className="mb-0 mt-1 text-xs text-[#5d6b7a] dark:text-[#b6c4d3]">Your rules and history stay on this device.</p></div>
    </aside>
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#edf7e7,transparent_34%),#f5f7f3] p-4 dark:bg-[radial-gradient(circle_at_top_left,#193324,transparent_34%),#0c1420] sm:p-7 lg:ml-64 lg:p-12">
      <div className="mx-auto max-w-6xl">
        <div className="card mb-5 flex items-center gap-3 p-3 lg:hidden"><img src="/icons/icon-48.png" alt="" className="h-9 w-9"/><label className="min-w-0 flex-1"><span className="sr-only">Dashboard section</span><select className="field !py-2" value={view} onChange={(event) => selectView(event.target.value as View)}>{DASHBOARD_VIEWS.map(({ id, label }) => <option value={id} key={`mobile-${id}`}>{label}</option>)}</select></label><span className="pill">v{extensionVersion}</span></div>
        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="muted mb-1 text-sm font-bold uppercase tracking-[.16em]">Control your digital trail</p><h2 className="m-0 text-3xl font-black">{currentView.label}</h2><p className="muted mb-0 mt-2 max-w-xl text-sm">{currentView.description}</p></div><div className="flex flex-wrap items-center gap-3">{settings.testingBypassPassword && <span className="pill !bg-amber-100 !text-amber-800 dark:!bg-amber-900 dark:!text-amber-100">Testing mode · no password</span>}<span className={`pill ${settings.enabled ? '' : '!bg-gray-100 !text-gray-600 dark:!bg-gray-800 dark:!text-gray-200'}`}>{settings.enabled ? 'Protection active' : 'Paused'}</span><button type="button" role="switch" aria-checked={settings.enabled} aria-label="Toggle automatic protection" className={`toggle ${settings.enabled ? 'on' : ''}`} onClick={() => updateSettings({ ...settings, enabled: !settings.enabled })} /><ThemeButton theme={settings.theme} onToggle={toggleTheme}/></div></header>
        {notice && <div role="status" className="notice-success mb-5 flex items-center gap-3"><span className="min-w-0 flex-1 font-semibold">{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss notification" className="rounded-lg border-0 bg-transparent px-2 py-1 text-lg leading-none">×</button></div>}

        {view === "overview" && <>
          {!settings.onboardingComplete && <section className="card mb-6 overflow-hidden p-7" style={{ background: "#18283d", color: "#ffffff" }}><p className="mb-2 text-xs font-bold uppercase tracking-[.18em]" style={{ color: "#9bd66f" }}>Welcome to Retentia</p><h3 className="m-0 text-2xl font-black" style={{ color: "#ffffff" }}>Give history an expiration date.</h3><p className="max-w-2xl" style={{ color: "#cbd4df" }}>Create rules, preview their effect in the simulator, then let Retentia clean matching URLs automatically.</p><div className="flex gap-3"><button className="rounded-xl border-0 bg-[#82c950] px-4 py-2 font-bold text-[#162235]" onClick={() => setView('rules')}>Create first rule</button><button className="rounded-xl border border-white/30 bg-white/10 px-4 py-2 font-bold" style={{ color: "#ffffff" }} onClick={() => updateSettings({ ...settings, onboardingComplete: true })}>Got it</button></div></section>}
          <section className="grid gap-5 md:grid-cols-3">{[[enabledRules,'Active rules'],[deletedCount,'URLs removed'],[lastScan?.scanned ?? 0,'Last scan size']].map(([value,label]) => <div className="card p-6" key={label}><p className="m-0 text-4xl font-black">{value}</p><p className="muted mb-0 mt-2 font-semibold">{label}</p></div>)}</section>
          <section className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]"><div className="card p-6"><div className="flex items-center justify-between"><h3 className="m-0 text-lg font-extrabold">System status</h3><button className="btn-primary" onClick={() => { setView('simulator'); void simulate(); }}>Run preview</button></div><dl className="mt-5 grid grid-cols-2 gap-4"><div><dt className="muted text-xs font-bold uppercase">Last scan</dt><dd className="ml-0 mt-1 font-bold">{formatDate(lastScan?.runAt)}</dd></div><div><dt className="muted text-xs font-bold uppercase">Schedule</dt><dd className="ml-0 mt-1 font-bold">Every {settings.scanIntervalMinutes} min</dd></div><div><dt className="muted text-xs font-bold uppercase">Matched last scan</dt><dd className="ml-0 mt-1 font-bold">{lastScan?.matched ?? 0}</dd></div><div><dt className="muted text-xs font-bold uppercase">Ready to expire</dt><dd className="ml-0 mt-1 font-bold">{lastScan?.expired ?? 0}</dd></div></dl></div><div className="card p-6"><h3 className="m-0 text-lg font-extrabold">Privacy-safe activity</h3><p className="muted text-sm">Retentia stores removal totals only. Deleted URLs and domains are never written to its activity or scan history.</p><div className="mt-5 text-3xl font-black">{deletedCount}</div><p className="muted mt-1 text-xs font-bold uppercase">History URLs removed</p></div></section>
        </>}

        {view === "categories" && <section><div className="card mb-6 flex flex-wrap items-center justify-between gap-4 p-6"><div><h3 className="m-0 text-lg font-extrabold">Local history classifier</h3><p className="muted mb-0 mt-1 max-w-2xl text-sm">Classifies Chrome history locally from known domains, an offline popular-domain database, URL structure, and stored page titles. Retentia never opens pages or reads page content. Scan results are discarded; only classifications you choose are saved locally.</p><p className="muted mb-0 mt-3 max-w-2xl text-xs">Database sources: <a href="https://dsi.ut-capitole.fr/blacklists/" target="_blank" rel="noreferrer">UT1 Blacklists</a>, Google <a href="https://developer.chrome.com/docs/crux/" target="_blank" rel="noreferrer">CrUX</a>, and content from <a href="https://curlie.org/" target="_blank" rel="noreferrer">Curlie.org</a> — the largest human-edited directory of the web. Contribute by submitting a website or becoming an editor.</p></div><button className="btn-primary" disabled={scanningCategories} onClick={runCategoryScan}>{scanningCategories ? 'Scanning history…' : categoryScan ? 'Scan again' : 'Scan all history'}</button></div>{categoryScan ? <><div className="mb-5 grid gap-4 md:grid-cols-3">{[[categoryScan.scanned,'History URLs scanned'],[categoryScan.categorized,'High-confidence matches'],[categoryScan.uncategorized,'Uncategorized or uncertain']].map(([value,label]) => <div className="card p-5" key={label}><strong className="text-3xl">{value}</strong><p className="muted mb-0 mt-1 text-sm font-semibold">{label}</p></div>)}</div>{categoryScan.resultLimitReached && <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">Chrome returned the one-million-result safety limit. The displayed totals may not include older entries beyond that limit.</div>}<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{categoryScan.buckets.map(bucket => { const preset=getCategoryPreset(bucket.category); const possible=preset ? countSuggestedUrls(categoryScan, preset.id) : 0; return <article className="card p-5" key={bucket.category ?? 'uncategorized'}><div className="flex items-start justify-between gap-3"><div><h3 className="m-0 text-base font-extrabold">{preset?.label ?? 'Uncategorized'}</h3><p className="muted mb-0 mt-1 text-xs">{preset?.description ?? 'No high-confidence local match was found.'}</p></div><span className="pill">{bucket.urls}</span></div><div className="muted mt-4 text-xs font-semibold">{bucket.visits} recorded visits</div>{possible > 0 && <div className="mt-2 text-xs font-bold text-amber-700 dark:text-amber-300">{possible} possible match{possible === 1 ? '' : 'es'} for review</div>}{preset && <div className="mt-3 text-xs font-bold">{preset.deleteImmediately ? 'Suggested deletion: immediately after visit' : `Suggested retention: ${preset.duration} ${preset.unit}`}</div>}</article>})}</div><p className="muted mt-5 text-xs">High-confidence matches may be used by category rules. You can correct every scanned domain below, including false positives. Closing or refreshing this page discards the scan details but keeps your chosen classifications.</p></> : <div className="card p-12 text-center"><h3>Nothing has been scanned yet</h3><p className="muted mx-auto max-w-xl">Start a local scan to classify history without opening websites or reading their page content. Every category remains visible, including categories with zero matches.</p></div>}</section>}

        {view === "categories" && categoryScan && CATEGORY_PRESETS.map(preset => { const possibleDomains=getSuggestedDomains(categoryScan, preset.id); return possibleDomains.length > 0 ? <section className="card mb-6 overflow-hidden border-[#bddcac] dark:border-[#3f6747]" key={`review-${preset.id}`}><div className="border-b border-[#d8ead0] bg-[#f1f8ed] p-5 dark:border-[#31513a] dark:bg-[#193123]"><h3 className="m-0 text-lg font-extrabold">Review possible matches for {preset.label}</h3><p className="muted mb-0 mt-1 text-sm">Confirm the suggestion, reject it and keep the domain uncategorized, or choose a different category. Your choice is stored locally and takes priority during future scans.</p></div><div>{possibleDomains.map(item => <div className="flex flex-wrap items-center gap-4 border-t border-[#edf0ea] px-5 py-4 first:border-t-0 dark:border-[#29394a]" key={`review-${preset.id}-${item.domain}`}><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{item.domain}</div><div className="muted text-xs">{item.urls} URLs · {item.visits} visits · confidence score {item.score}</div></div><div className="flex shrink-0 flex-wrap gap-2"><button className="btn-secondary" onClick={() => void moveDomain(item.domain, null)}>Reject</button><button className="btn-primary" onClick={() => void moveDomain(item.domain, preset.id)}>Confirm {preset.label}</button><select aria-label={`Classify ${item.domain}`} className="field !w-52" defaultValue="" onChange={event => void moveDomain(item.domain, parseCategoryChoice(event.target.value))}><option value="" disabled>Different category…</option>{CATEGORY_PRESETS.filter(option => option.id !== preset.id).map(option => <option value={option.id} key={option.id}>{option.label}</option>)}</select></div></div>)}</div></section> : null; })}

        {view === "categories" && rejectedCategorySuggestions.length > 0 && <section className="card mb-6 overflow-hidden"><div className="border-b border-[#e5eae2] p-5 dark:border-[#2b3a4b]"><h3 className="m-0 text-lg font-extrabold">Rejected category suggestions</h3><p className="muted mb-0 mt-1 text-sm">These domains remain uncategorized for the rejected suggestion. Restore one if you want Retentia to review it again.</p></div><div>{rejectedCategorySuggestions.map(item => <div className="flex items-center gap-4 border-t border-[#edf0ea] px-5 py-4 first:border-t-0 dark:border-[#29394a]" key={`rejected-${item.domain}-${item.category}`}><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{item.domain}</div><div className="muted text-xs">Rejected for {getCategoryPreset(item.category)?.label}</div></div><button className="btn-secondary shrink-0" onClick={() => void restoreCategorySuggestion(item.domain, item.category)}>Restore suggestion</button></div>)}</div></section>}

        {view === "categories" && <div className="card mb-6 p-6"><h3 className="mt-0 text-lg font-extrabold">Default category rules</h3><p className="muted mb-0 text-sm">Retentia includes a ready-made rule for every built-in category. <strong>Prepare disabled rules</strong> adds any missing rules without activating them or changing browser history, so you can review their timing first. <strong>Activate and clean matching history</strong> enables all category rules and removes history that is already due; categories configured for immediate deletion remove every current match.</p><div className="mt-6 flex flex-wrap gap-3"><button className="btn-secondary" onClick={() => void prepareDefaultRules(false)}>Prepare disabled rules</button><button className="btn-danger" onClick={() => void prepareDefaultRules(true)}>Activate and clean matching history</button></div></div>}

        {view === "categories" && categoryScan && <section className="mb-6"><div className="card mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_220px]"><label><span className="label">Find a domain</span><input type="search" className="field" value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} placeholder="Search scanned domains"/></label><label><span className="label">Show classifications</span><select className="field" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as CategoryFilter)}><option value="all">All results</option><option value="review">Possible matches</option><option value="custom">My classifications</option><option value="automatic">Automatic matches</option></select></label></div>{filteredCategoryBuckets.length > 0 ? <div className="space-y-4">{filteredCategoryBuckets.map(bucket => { const preset=getCategoryPreset(bucket.category); const key=bucket.category ?? 'uncategorized'; const expanded=expandedCategoryBuckets.includes(key) || Boolean(normalizedCategorySearch); return <section className="card overflow-hidden" key={`domains-${key}`}><button type="button" className="flex w-full items-center gap-4 border-0 bg-transparent p-5 text-left text-inherit" onClick={() => toggleCategoryBucket(key)} aria-expanded={expanded}><span aria-hidden="true" className="expand-marker">{expanded ? '−' : '+'}</span><div className="min-w-0 flex-1"><h3 className="m-0 text-base font-extrabold">Classify websites from {preset?.label ?? 'Uncategorized'}</h3><p className="muted mb-0 mt-1 text-xs">Correct automatic results or keep false positives uncategorized.</p></div><span className="pill shrink-0">{bucket.domains.length} domains</span></button>{expanded && <div className="max-h-96 overflow-y-auto border-t border-[#e5eae2] dark:border-[#2b3a4b]">{bucket.domains.map(item => <div className="flex flex-col gap-3 border-t border-[#edf0ea] px-5 py-4 first:border-t-0 dark:border-[#29394a] sm:flex-row sm:items-center" key={`${item.domain}-${item.suggestedCategory ?? bucket.category ?? 'none'}`}><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{item.domain}</div><div className="muted text-xs">{item.urls} URLs · {item.visits} visits{item.overridden ? ' · user classification' : ''}{item.suggestedCategory ? ` · Possible ${getCategoryPreset(item.suggestedCategory)?.label}` : ' · automatic result'}</div></div><select aria-label={`Category for ${item.domain}`} className="field sm:!w-56" value={item.overridden ? bucket.category ?? 'uncategorized' : 'automatic'} onChange={event => void moveDomain(item.domain, parseCategoryChoice(event.target.value))}><option value="automatic">Automatic database</option><option value="uncategorized">Keep uncategorized</option>{CATEGORY_PRESETS.map(option => <option value={option.id} key={option.id}>{option.label}</option>)}</select></div>)}</div>}</section>})}</div> : <div className="card p-10 text-center"><h3 className="mt-0">No domains match this filter</h3><p className="muted mb-0 text-sm">Try another search term or classification filter.</p></div>}</section>}

        {view === "categories" && customCategoryClassifications.length > 0 && <section className="card mt-6 overflow-hidden"><div className="border-b border-[#e5eae2] p-5 dark:border-[#2b3a4b]"><h3 className="m-0 text-lg font-extrabold">Your local category database</h3><p className="muted mb-0 mt-1 text-sm">These domain choices are stored only in this browser and always take priority over Retentia's bundled database.</p></div><div className="max-h-72 overflow-y-auto">{customCategoryClassifications.map(([domain, category]) => <div className="flex items-center gap-4 border-t border-[#edf0ea] px-5 py-4 first:border-t-0 dark:border-[#29394a]" key={`custom-${domain}`}><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{domain}</div><div className="muted text-xs">{category ? getCategoryPreset(category)?.label : 'Keep uncategorized'}</div></div><button className="btn-secondary shrink-0" onClick={() => void moveDomain(domain, undefined)}>Use automatic database</button></div>)}</div></section>}

        {view === "categories" && <section className="mt-6"><h3 className="mb-4 text-lg font-extrabold">Manage categories separately</h3><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{CATEGORY_PRESETS.map(preset => { const categoryRule=rules.find(rule => rule.kind === 'category' && rule.pattern === preset.id); const immediate=categoryRule?.deleteImmediately ?? preset.deleteImmediately; return <article className="card p-5" key={`control-${preset.id}`}><div className="flex items-start justify-between gap-3"><div><h4 className="m-0 font-extrabold">{preset.label}</h4><p className="muted mb-0 mt-1 text-xs">{immediate ? 'Remove immediately after visit' : `Keep for ${categoryRule?.duration ?? preset.duration} ${categoryRule?.unit ?? preset.unit}`}</p></div><button type="button" role="switch" aria-checked={Boolean(categoryRule?.enabled)} aria-label={`Toggle ${preset.label}`} className={`toggle ${categoryRule?.enabled ? 'on' : ''}`} onClick={() => void toggleCategoryRule(preset.id)}/></div><button className="btn-danger mt-4 w-full" onClick={() => void cleanCategory(preset.id)}>{immediate ? 'Activate & clean matching' : 'Activate & clean expired'}</button></article>})}</div></section>}

        {view === "rules" && pendingAddToRuleUrl && <section className="card mb-6 border-[#b9d9aa] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="m-0 text-lg font-extrabold">Add history website to an existing rule</h3><p className="muted mb-0 mt-1 text-sm">Choose whether this specific URL or its complete domain should inherit an existing rule's timing and enabled state.</p></div><button className="btn-secondary" onClick={() => setPendingAddToRuleUrl("")}>Cancel</button></div>
          <label className="mt-5 block max-w-sm"><span className="label">Website match</span><select className="field" value={historyTargetKind} onChange={event => setHistoryTargetKind(event.target.value as ManualTargetKind)}><option value="url">This specific URL</option><option value="domain">Complete domain</option></select></label>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{rules.map(rule => <button className="rounded-xl border border-[#dce7d6] bg-[#f7faf5] p-4 text-left hover:border-[#82c950] dark:border-[#334658] dark:bg-[#152332]" key={`add-to-${rule.id}`} onClick={() => void addPendingUrlToExistingRule(rule.id)}><strong className="block truncate">{rule.name}</strong><span className="muted mt-1 block text-xs">{rule.enabled ? 'Enabled' : 'Disabled'} · {rule.deleteImmediately ? 'Immediate deletion' : `Keep for ${rule.duration} ${rule.unit}`}</span></button>)}</div>
        </section>}

        {view === "rules" && ruleConflicts.length > 0 && <section className="card mb-6 border-amber-300 bg-amber-50 p-6 dark:border-amber-700 dark:bg-amber-950"><h3 className="mt-0 text-lg font-extrabold">Rule conflicts detected</h3><p className="muted text-sm">Retentia always uses the highest priority. If priorities match, the oldest rule wins.</p><div className="space-y-3">{ruleConflicts.map(conflict => <div className="rounded-xl border border-amber-200 bg-white/70 p-4 text-sm dark:border-amber-800 dark:bg-black/20" key={`${conflict.first.id}-${conflict.second.id}`}><strong>{conflict.first.name}</strong> overlaps <strong>{conflict.second.name}</strong><p className="muted mb-0 mt-1 text-xs">{conflict.reason} Winner: {conflict.winner.name}.</p></div>)}</div></section>}

        {view === "settings" && <section className="card mb-6 max-w-3xl p-7"><h3 className="mt-0 text-lg font-extrabold">Protected websites</h3><p className="muted text-sm">Protected domains and all of their subdomains are skipped by previews, manual deletion, category cleanup, and automatic cleanup.</p><form className="flex flex-col gap-3 sm:flex-row" onSubmit={addProtectedDomain}><label className="flex-1"><span className="sr-only">Domain to protect</span><input aria-label="Domain to protect" className="field" value={protectedDraft} onChange={event => setProtectedDraft(event.target.value)} placeholder="bank.example or https://portal.example"/></label><button className="btn-primary" type="submit">Protect website</button></form><div className="mt-5 space-y-2">{protectedDomains.length ? protectedDomains.map(domain => <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5eae2] px-4 py-3 dark:border-[#2b3a4b]" key={domain}><span className="min-w-0 truncate font-bold">{domain}</span><button className="btn-danger" onClick={() => void removeProtectedDomain(domain)}>Remove</button></div>) : <p className="muted text-sm">No websites are protected yet.</p>}</div></section>}

        {view === "settings" && <section className="card mb-6 max-w-3xl p-7"><h3 className="mt-0 text-lg font-extrabold">Backup and restore</h3><p className="muted text-sm">Export rules, settings, category overrides, rejected suggestions, and protected websites. Passwords, activity totals, scan results, and browser history are never included.</p><div className="flex flex-wrap gap-3"><button className="btn-secondary" onClick={() => void exportBackup()}>Export backup</button><label className="btn-primary cursor-pointer">Restore backup<input className="hidden" type="file" accept="application/json,.json" onChange={event => { void importBackup(event.target.files?.[0]); event.target.value=''; }}/></label></div></section>}

        {view === "rules" && <div className="grid items-start gap-6 xl:grid-cols-[.9fr_1.35fr]">
          <div className="space-y-6">
          <form className="card overflow-hidden" onSubmit={saveRule}>
            <button type="button" className="flex w-full items-center gap-4 border-0 bg-transparent p-5 text-left text-inherit" onClick={() => setNewRuleExpanded((current) => !current)} aria-expanded={newRuleExpanded}><span className="expand-marker" aria-hidden="true">{newRuleExpanded ? '−' : '+'}</span><div><h3 className="m-0 text-lg font-extrabold">{editingId ? 'Edit rule' : 'New rule'}</h3><p className="muted mb-0 mt-1 text-xs">Create a new retention target and choose when matching history expires.</p></div></button>
            {newRuleExpanded && <div className="space-y-4 border-t border-[#e5eae2] p-6 dark:border-[#2b3a4b]">
              <label><span className="label">Rule name</span><input required className="field" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Sensitive searches" /></label>
              <label><span className="label">Category preset</span><select className="field" value={draft.category ?? ""} onChange={e => applyCategory((e.target.value || undefined) as CategoryId | undefined)}><option value="">Uncategorized</option>{CATEGORY_PRESETS.map(preset => <option value={preset.id} key={preset.id}>{preset.label} · {preset.deleteImmediately ? 'immediate' : `${preset.duration} ${preset.unit}`}</option>)}</select>{draft.category && <span className="muted mt-1 block text-xs">{getCategoryPreset(draft.category)?.description} You can still customize the deletion timing.</span>}</label>
              <label><span className="label">Match type</span><select className="field" value={draft.kind} onChange={e => setDraft({ ...draft, kind: e.target.value as RuleKind })}><option value="domain">Complete domain</option><option value="exact">Specific URL</option>{draft.kind === "category" && <option value="category">Category rule (managed separately)</option>}{draft.kind === "wildcard" && <option value="wildcard">Wildcard (legacy advanced rule)</option>}{draft.kind === "regex" && <option value="regex">Regular expression (legacy advanced rule)</option>}</select><span className="muted mt-1 block text-xs">{MATCH_TYPE_DESCRIPTIONS[draft.kind]}</span></label>
              <label><span className="label">Pattern</span><input required className="field" value={draft.pattern} onChange={e => setDraft({ ...draft, pattern: e.target.value })} onBlur={suggestDraftCategory} placeholder={draft.kind === 'domain' ? 'example.com' : draft.kind === 'exact' ? 'https://example.com/private/page' : draft.kind === 'wildcard' ? 'https://example.com/private/*' : draft.kind === 'category' ? 'news' : '/private/\\d+$'} /></label>
              <label><span className="label">Deletion timing</span><select className="field" value={draft.deleteImmediately ? 'immediate' : 'retention'} onChange={e => setDraft({ ...draft, deleteImmediately: e.target.value === 'immediate' })}><option value="retention">After a retention period</option><option value="immediate">Immediately after visit</option></select><span className="muted mt-1 block text-xs">Immediate rules remove the URL from history without closing the website.</span></label>
              {!draft.deleteImmediately && <div className="grid grid-cols-2 gap-3"><label><span className="label">Keep for</span><input required min="1" type="number" className="field" value={draft.duration} onChange={e => setDraft({ ...draft, duration: Number(e.target.value) })} /></label><label><span className="label">Duration</span><select className="field" value={draft.unit} onChange={e => setDraft({ ...draft, unit: e.target.value as TimeUnit })}><option value="minutes">Minutes</option><option value="hours">Hours</option><option value="days">Days</option></select></label></div>}
              <label><span className="label">Priority (higher wins)</span><input type="number" className="field" value={draft.priority} onChange={e => setDraft({ ...draft, priority: Number(e.target.value) })} /></label>
              {!editingId && <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#f0cfbd] bg-[#fff7f1] p-4 dark:border-[#694331] dark:bg-[#2a201b]"><input className="mt-1 h-4 w-4 accent-[#a94f1c]" type="checkbox" checked={deleteExisting} onChange={e => setDeleteExisting(e.target.checked)} /><span><strong className="block text-sm">Delete existing matching history now</strong><span className="muted mt-1 block text-xs">Permanently removes every existing URL matched by this rule immediately after creation. You will be asked to confirm.</span></span></label>}
              <div className="flex gap-2"><button className="btn-primary flex-1" type="submit">Save rule</button>{editingId && <button type="button" className="btn-secondary" onClick={() => { setEditingId(undefined); setDraft(EMPTY_RULE); }}>Cancel</button>}</div>
            </div>}
          </form>
          <form className="card overflow-hidden" onSubmit={addManualWebsite}>
            <button type="button" className="flex w-full items-center gap-4 border-0 bg-transparent p-5 text-left text-inherit" onClick={() => setAddExistingRuleExpanded((current) => !current)} aria-expanded={addExistingRuleExpanded}><span className="expand-marker" aria-hidden="true">{addExistingRuleExpanded ? '−' : '+'}</span><div><h3 className="m-0 text-lg font-extrabold">Add to existing rule</h3><p className="muted mb-0 mt-1 text-xs">Attach a complete domain or one specific URL to an existing rule.</p></div></button>
            {addExistingRuleExpanded && <div className="space-y-4 border-t border-[#e5eae2] p-6 dark:border-[#2b3a4b]">
              <label><span className="label">Existing rule</span><select required className="field" value={manualRuleId} onChange={event => setManualRuleId(event.target.value)}><option value="" disabled>Choose a rule</option>{rules.map(rule => <option value={rule.id} key={`manual-${rule.id}`}>{rule.name}</option>)}</select></label>
              <label><span className="label">Website match</span><select className="field" value={manualTargetKind} onChange={event => setManualTargetKind(event.target.value as ManualTargetKind)}><option value="domain">Complete domain</option><option value="url">Specific URL</option></select></label>
              <label><span className="label">{manualTargetKind === 'url' ? 'URL' : 'Domain or website URL'}</span><input required className="field" value={manualTargetDraft} onChange={event => setManualTargetDraft(event.target.value)} placeholder={manualTargetKind === 'url' ? 'https://example.com/private/page' : 'example.com'} /></label>
              <p className="muted text-xs">The website uses the selected rule's current retention period, immediate-deletion setting, priority, and enabled state.</p>
              <button className="btn-primary w-full" type="submit">Add to rule</button>
              {selectedManualRule && ((selectedManualRule.additionalDomains?.length ?? 0) + (selectedManualRule.additionalUrls?.length ?? 0) > 0) && <div className="border-t border-[#e5eae2] pt-4 dark:border-[#2b3a4b]"><h4 className="mb-3 mt-0 text-sm font-extrabold">Manually attached websites</h4><div className="space-y-2">{selectedManualRule.additionalDomains?.map(domain => <div className="flex items-center gap-2 rounded-xl border border-[#e5eae2] px-3 py-2 dark:border-[#2b3a4b]" key={`domain-${domain}`}><span className="pill">Domain</span><span className="min-w-0 flex-1 truncate text-sm" title={domain}>{domain}</span><button className="btn-danger !px-3 !py-1" type="button" onClick={() => void detachTargetFromRule(selectedManualRule.id, 'domain', domain)}>Remove</button></div>)}{selectedManualRule.additionalUrls?.map(url => <div className="flex items-center gap-2 rounded-xl border border-[#e5eae2] px-3 py-2 dark:border-[#2b3a4b]" key={`url-${url}`}><span className="pill">URL</span><span className="min-w-0 flex-1 truncate text-sm" title={url}>{shortenUrl(url)}</span><button className="btn-danger !px-3 !py-1" type="button" onClick={() => void detachTargetFromRule(selectedManualRule.id, 'url', url)}>Remove</button></div>)}</div></div>}
            </div>}
          </form>
          </div>
          <section className="space-y-3">{rules.length === 0 ? <div className="card p-8 text-center"><h3>No rules yet</h3><p className="muted">Add your first retention rule to begin.</p></div> : rules.map(rule => <article className="card flex flex-wrap items-center gap-3 p-5" key={rule.id}><button type="button" role="switch" aria-checked={rule.enabled} aria-label={`${rule.enabled ? 'Disable' : 'Enable'} ${rule.name}`} className={`toggle shrink-0 ${rule.enabled?'on':''}`} onClick={() => persistRules(rules.map(item => item.id === rule.id ? {...item,enabled:!item.enabled}:item))}/><div className="min-w-[150px] flex-1"><h3 className="m-0 truncate text-base font-extrabold">{rule.name}</h3></div><button className="btn-secondary" onClick={() => editRule(rule)}>Edit</button><button className="btn-danger" onClick={() => confirm(`Delete “${rule.name}”?`) && void persistRules(rules.filter(item => item.id !== rule.id))}>Delete</button></article>)}</section>
        </div>}

        {view === "simulator" && <section>
          <div className="card mb-6 flex flex-wrap items-center justify-between gap-4 p-6"><div><h3 className="m-0 text-lg font-extrabold">Dry-run simulator</h3><p className="muted mb-0 mt-1 text-sm">Preview matches per enabled rule without changing browser history. Open a rule to inspect its URLs.</p></div><div className="flex gap-2"><button className="btn-secondary" disabled={simulating} onClick={simulate}>{simulating?'Scanning…':'Refresh preview'}</button><button className="btn-primary" disabled={simulating || !lastScan?.expired} onClick={runCleanup}>Remove {lastScan?.expired ?? 0} expired</button></div></div>
          {lastScan ? <><div className="mb-4 grid gap-4 sm:grid-cols-3">{[[lastScan.scanned,'Scanned'],[lastScan.matched,'Matched'],[lastScan.expired,'Expired']].map(([v,l])=><div className="card p-4" key={l}><strong className="text-2xl">{v}</strong><span className="muted ml-2 text-sm">{l}</span></div>)}</div>{lastScan.resultLimitReached && <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">Chrome returned the 100,000-result automatic-scan safety limit. Older matching history may not be included in this preview or cleanup.</div>}<div className="space-y-3">{simulatorRuleGroups.length ? simulatorRuleGroups.map(group => { const expanded=expandedSimulatorRules.includes(group.rule.id); return <article className="card overflow-hidden" key={`simulator-${group.rule.id}`}><button className="flex w-full flex-wrap items-center gap-3 border-0 bg-transparent p-5 text-left text-inherit" onClick={() => toggleSimulatorRule(group.rule.id)} aria-expanded={expanded}><span className="expand-marker">{expanded ? '−' : '+'}</span><div className="min-w-[150px] flex-1"><h3 className="m-0 truncate text-base font-extrabold">{group.rule.name}</h3><p className="muted mb-0 mt-1 text-xs">{group.rule.deleteImmediately ? 'Immediate deletion' : `Keep for ${group.rule.duration} ${group.rule.unit}`}</p></div><span className="pill">{group.matched} matched</span><span className={`pill ${group.expired ? '!bg-[#fff0e8] !text-[#a94f1c]' : ''}`}>{group.expired} expired</span></button>{expanded && <div className="overflow-x-auto border-t border-[#e5eae2] dark:border-[#2b3a4b]">{group.candidates.length ? <><table className="w-full border-collapse text-left text-sm"><thead className="bg-[#eef2eb] dark:bg-[#172536]"><tr><th className="p-4">URL</th><th className="p-4">Expires</th><th className="p-4">Status</th></tr></thead><tbody>{group.candidates.slice(0,500).map(item=><tr className="border-t border-[#edf0ea] dark:border-[#29394a]" key={item.url}><td className="max-w-[520px] truncate p-4" title={item.url}>{shortenUrl(item.url)}</td><td className="p-4">{formatDate(item.expiresAt)}</td><td className="p-4"><span className={`pill ${item.expired?'!bg-[#fff0e8] !text-[#a94f1c]':''}`}>{item.expired?'Expired':'Retained'}</span></td></tr>)}</tbody></table>{group.candidates.length > 500 && <p className="muted m-0 border-t border-[#edf0ea] p-4 text-xs dark:border-[#29394a]">Showing the first 500 of {group.candidates.length} matched URLs.</p>}</> : <p className="muted m-0 p-6 text-center text-sm">No matching URLs for this rule.</p>}</div>}</article>}) : <div className="card p-10 text-center"><h3>No enabled rules</h3><p className="muted">Enable at least one rule to compare simulator results.</p></div>}</div></> : <div className="card p-12 text-center"><h3>Ready to preview</h3><p className="muted">Run a scan to see matching totals for every enabled rule.</p></div>}
        </section>}

        {view === "activity" && <section className="card overflow-hidden"><div className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="m-0 text-lg font-extrabold">Privacy-safe activity log</h3><p className="muted mb-0 mt-1 text-sm">Stores totals and timestamps only—never deleted URLs or domains.</p></div><button className="btn-danger shrink-0" onClick={async()=>{if(confirm('Clear the activity log?')){await storage.clearActivity();setActivity([])}}}>Clear log</button></div><div>{activity.length ? activity.map(entry=><article className="flex gap-4 border-t border-[#edf0ea] px-6 py-4 dark:border-[#29394a]" key={entry.id}><div aria-hidden="true" className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${entry.type==='error'?'bg-red-500':entry.type==='deleted'?'bg-[#6db33f]':'bg-blue-400'}`}/><div className="min-w-0"><p className="m-0 text-sm font-bold">{entry.message}</p><time className="muted text-xs">{formatDate(entry.timestamp)}</time></div></article>):<p className="muted p-10 text-center">No activity recorded yet.</p>}</div></section>}

        {view === "settings" && <section className="card mb-6 max-w-3xl border-amber-300 p-7 dark:border-amber-700"><div className="flex items-start justify-between gap-5"><div><h3 className="m-0 text-lg font-extrabold">Testing mode</h3><p className="muted mb-0 mt-2 text-sm">Temporarily bypass password prompts while testing. Your password remains stored and all password code stays active. Turning this off immediately restores the lock.</p></div><button type="button" role="switch" aria-checked={Boolean(settings.testingBypassPassword)} aria-label="Toggle Testing mode" className={`toggle shrink-0 ${settings.testingBypassPassword ? 'on' : ''}`} onClick={() => void toggleTestingMode()}/></div></section>}

        {view === "settings" && <section className="card max-w-3xl p-7"><h3 className="mt-0 text-lg font-extrabold">Protection settings</h3><div className="space-y-6"><div className="flex items-center justify-between"><div><strong>Automatic cleanup</strong><p className="muted m-0 text-sm">Run scans in the background.</p></div><button type="button" role="switch" aria-checked={settings.enabled} aria-label="Toggle automatic cleanup" className={`toggle ${settings.enabled?'on':''}`} onClick={()=>updateSettings({...settings,enabled:!settings.enabled})}/></div><label><span className="label">Scan interval (minutes)</span><input className="field" type="number" min="1" max="1440" value={settings.scanIntervalMinutes} onChange={e=>updateSettings({...settings,scanIntervalMinutes:Number(e.target.value)})}/></label><label><span className="label">History scan window (days)</span><input className="field" type="number" min="1" max="3650" value={settings.historyWindowDays} onChange={e=>updateSettings({...settings,historyWindowDays:Number(e.target.value)})}/></label><label><span className="label">Maximum activity entries</span><input className="field" type="number" min="10" max="5000" value={settings.maxLogEntries} onChange={e=>updateSettings({...settings,maxLogEntries:Number(e.target.value)})}/></label><div className="!mt-5 rounded-xl bg-[#eef7e8] p-4 text-sm dark:bg-[#203729]"><strong>Security scope</strong><p className="muted mb-0">The password lock discourages casual access to Retentia. It cannot protect local data from someone with full access to your Windows account, Chrome profile, or extension developer tools.</p></div></div><ChangePassword/><div className="mt-7 border-t border-[#e5eae2] pt-6 dark:border-[#2b3a4b]"><h4 className="mb-1 mt-0 text-base font-extrabold text-red-700 dark:text-red-300">Forgotten-password reset</h4><p className="muted mt-0 text-sm">Deletes the password, rules, and activity log. Your browser history is never deleted by this reset.</p><button className="btn-danger" onClick={resetProtectedData}>Reset protected Retentia data</button></div></section>}

        {view === "settings" && <section className="card mt-6 max-w-3xl overflow-hidden border-[#cfe3c4] dark:border-[#365b39]"><div className="grid gap-5 bg-[linear-gradient(135deg,#f4faef,#ffffff)] p-7 dark:bg-[linear-gradient(135deg,#193123,#14202e)] sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="mb-2 text-xs font-extrabold uppercase tracking-[.16em] text-[#4d8b2c] dark:text-[#a8e77d]">Optional support</p><h3 className="m-0 text-xl font-extrabold">Enjoying Retentia?</h3><p className="muted mb-0 mt-2 max-w-xl text-sm">If Retentia is useful to you and you'd like to support its continued development, you can buy me a coffee.</p></div><a className="btn-primary inline-flex items-center justify-center whitespace-nowrap no-underline" href={SUPPORT_URL} target="_blank" rel="noreferrer" aria-label="Buy me a coffee via PayPal; opens in a new tab">Buy me a coffee</a></div><p className="muted m-0 border-t border-[#e5eae2] px-7 py-4 text-xs dark:border-[#2b3a4b]">Optional support. Retentia remains fully functional without a contribution. The button opens PayPal in a new tab.</p></section>}
      </div>
      {passwordReady === false && <PasswordModal mode="setup" onSuccess={() => { setPasswordReady(true); void unlockApplication(); }} />}
      {passwordReady === true && appUnlocked === false && <PasswordModal mode="unlock" onSuccess={unlockApplication} onReset={resetProtectedData} />}
    </main>
  </div>;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><Dashboard /></React.StrictMode>);
