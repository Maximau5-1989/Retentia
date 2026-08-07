import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { PasswordModal } from "../components/PasswordModal";
import { ThemeButton } from "../components/ThemeButton";
import { ChangePassword } from "../components/ChangePassword";
import { cleanExpiredForRule, deleteHistoryMatchingRule, scanHistory, scanHistoryCategories } from "../retention/engine";
import { detectRuleConflicts } from "../retention/conflicts";
import { normalizeProtectedDomain } from "../retention/protection";
import { formatDate, shortenUrl } from "../shared/format";
import { sessionStorage, storage } from "../shared/storage";
import { CATEGORY_PRESETS, getCategoryPreset, suggestCategory } from "../shared/categories";
import { addMissingDefaultCategoryRules, DEFAULT_CATEGORY_RULES_VERSION } from "../shared/default-rules";
import { createBackup, parseBackup } from "../shared/backup";
import type { ActivityEntry, CategoryId, CategoryOverrides, CategoryScanResult, RetentionRule, RuleKind, ScanResult, Settings, TimeUnit } from "../shared/types";
import "../styles.css";

type View = "overview" | "rules" | "categories" | "simulator" | "activity" | "settings";
const EMPTY_RULE: Omit<RetentionRule, "id" | "createdAt"> = { name: "", kind: "domain", pattern: "", duration: 7, unit: "days", enabled: true, deleteImmediately: false, priority: 50 };

function countSuggestedUrls(scan: CategoryScanResult, category: CategoryId): number {
  return scan.buckets.find((bucket) => !bucket.category)?.domains
    .filter((domain) => domain.suggestedCategory === category)
    .reduce((total, domain) => total + domain.urls, 0) ?? 0;
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
  const requestedRuleUrl = new URLSearchParams(window.location.search).get("createRule") || "";
  const [view, setView] = useState<View>(requestedRuleUrl ? "rules" : "overview");
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
  const [categoryScan, setCategoryScan] = useState<CategoryScanResult>();
  const [scanningCategories, setScanningCategories] = useState(false);
  const [categoryOverrides, setCategoryOverrides] = useState<CategoryOverrides>({});
  const [protectedDomains, setProtectedDomains] = useState<string[]>([]);
  const [protectedDraft, setProtectedDraft] = useState("");

  async function refresh() {
    await storage.sanitizePrivacyData();
    const [loadedSettings, loadedActivity, loadedScan, password, unlocked] = await Promise.all([storage.getSettings(), storage.getActivity(), storage.getLastScan(), storage.getPassword(), sessionStorage.isUnlocked()]);
    setSettings(loadedSettings); setActivity(loadedActivity); setLastScan(loadedScan);
    setPasswordReady(Boolean(password));
    setAppUnlocked(unlocked);
    if (unlocked) {
      const [loadedRules, loadedOverrides, loadedProtected] = await Promise.all([loadRulesWithDefaults(), storage.getCategoryOverrides(), storage.getProtectedDomains()]);
      setRules(loadedRules); setCategoryOverrides(loadedOverrides); setProtectedDomains(loadedProtected);
      await chrome.runtime.sendMessage({ type: "REGISTER_DASHBOARD_TAB" });
      applyPendingRuleUrl();
    }
  }
  useEffect(() => { void refresh(); }, []);

  async function persistRules(next: RetentionRule[]) { setRules(next); await storage.setRules(next); }
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
    if (isNewRule && deleteExisting && !confirm("Create this rule and permanently delete every existing history URL that matches it? This cannot be undone.")) return;
    const rule = editingId
      ? { ...rules.find((item) => item.id === editingId)!, ...draft }
      : { ...draft, id: crypto.randomUUID(), createdAt: Date.now() };
    await persistRules(editingId ? rules.map((item) => item.id === editingId ? rule : item) : [rule, ...rules]);
    let removed = 0;
    if (isNewRule && deleteExisting) removed = await deleteHistoryMatchingRule(rule);
    setDraft(EMPTY_RULE); setEditingId(undefined); setDeleteExisting(false); setNotice(removed ? `Rule saved · ${removed} matching URL${removed === 1 ? "" : "s"} removed` : "Rule saved");
    if (removed) setActivity(await storage.getActivity());
  }
  function editRule(rule: RetentionRule) { setEditingId(rule.id); setDeleteExisting(false); setDraft({ name: rule.name, kind: rule.kind, pattern: rule.pattern, duration: rule.duration, unit: rule.unit, enabled: rule.enabled, deleteImmediately: rule.deleteImmediately ?? false, priority: rule.priority, category: rule.category }); window.scrollTo({ top: 0, behavior: "smooth" }); }
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
  async function moveDomain(domain: string, category?: CategoryId) {
    const overrides = await storage.getCategoryOverrides();
    if (category) overrides[domain] = category; else delete overrides[domain];
    await storage.setCategoryOverrides(overrides);
    setCategoryOverrides({ ...overrides });
    setCategoryScan(await scanHistoryCategories());
    setNotice(category ? `${domain} moved to ${getCategoryPreset(category)?.label}` : `${domain} restored to automatic categorization`);
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
    const [backupRules, backupSettings, overrides, domains] = await Promise.all([storage.getRules(), storage.getSettings(), storage.getCategoryOverrides(), storage.getProtectedDomains()]);
    const backup = createBackup({ appVersion: extensionVersion, rules: backupRules, settings: backupSettings, categoryOverrides: overrides, protectedDomains: domains });
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = `retentia-backup-v${extensionVersion}.json`; link.click(); URL.revokeObjectURL(url);
    setNotice("Privacy-safe backup exported");
  }
  async function importBackup(file?: File) {
    if (!file) return;
    try {
      const backup = parseBackup(await file.text());
      if (!confirm(`Restore ${backup.rules.length} rules, settings, category overrides, and protected websites? Current configuration will be replaced. Password, activity totals, and browser history are unchanged.`)) return;
      await Promise.all([storage.setRules(backup.rules), storage.setSettings(backup.settings), storage.setCategoryOverrides(backup.categoryOverrides), storage.setProtectedDomains(backup.protectedDomains)]);
      setRules(backup.rules); setSettings(backup.settings); setCategoryOverrides(backup.categoryOverrides); setProtectedDomains(backup.protectedDomains); setNotice("Backup restored successfully");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Backup restore failed"); }
  }
  async function updateSettings(next: Settings) { setSettings(next); await storage.setSettings(next); }
  async function toggleTheme() {
    const next = { ...settings!, theme: settings!.theme === "light" ? "dark" as const : "light" as const };
    await updateSettings(next);
  }
  function selectView(next: View) {
    setView(next);
  }

  function applyPendingRuleUrl() {
    if (pendingRuleUrl) {
      try {
        const parsed = new URL(pendingRuleUrl);
        const preset = suggestCategory(parsed.hostname);
        setDraft({ ...EMPTY_RULE, name: parsed.hostname, kind: "exact", pattern: pendingRuleUrl, ...(preset ? { category: preset.id, duration: preset.duration, unit: preset.unit } : {}) });
        setNotice("History URL loaded · choose a retention period and save the rule");
      } catch { setNotice("Chrome did not provide a valid history URL"); }
      setPendingRuleUrl("");
      window.history.replaceState({}, "", "dashboard.html");
    }
  }
  async function unlockApplication() {
    await sessionStorage.unlock();
    const [loadedRules, loadedOverrides, loadedProtected] = await Promise.all([loadRulesWithDefaults(), storage.getCategoryOverrides(), storage.getProtectedDomains()]);
    setRules(loadedRules); setCategoryOverrides(loadedOverrides); setProtectedDomains(loadedProtected);
    setAppUnlocked(true);
    await chrome.runtime.sendMessage({ type: "REGISTER_DASHBOARD_TAB" });
    applyPendingRuleUrl();
  }
  async function resetProtectedData() {
    if (!confirm("Reset Retentia security? This permanently deletes the password, all retention rules, and the activity log. Browser history will NOT be deleted.")) return;
    await storage.resetProtectedData();
    await sessionStorage.lock(); setRules([]); setActivity([]); setLastScan(null); setPasswordReady(false); setAppUnlocked(false); setView("overview");
  }

  useEffect(() => {
    if (!settings) return;
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
  }, [settings?.theme]);

  const enabledRules = rules.filter((rule) => rule.enabled).length;
  const ruleConflicts = detectRuleConflicts(rules, categoryOverrides);
  const deletedCount = activity.filter((entry) => entry.type === "deleted").reduce((total, entry) => total + (entry.count ?? 0), 0);

  if (!settings) return <div className="p-8">Loading Retentia…</div>;
  return <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#edf7e7,transparent_34%),#f5f7f3]">
    <aside className="fixed inset-y-0 left-0 z-10 flex w-64 flex-col border-r border-[#e0e6dc] bg-white/90 p-5 backdrop-blur dark:border-[#29394a] dark:bg-[#101b28]/95">
      <div className="mb-8 flex items-center gap-3"><img src="/icons/icon-48.png" className="h-11 w-11" /><div><h1 className="m-0 text-xl font-black">Retentia</h1><span className="pill">v{extensionVersion}</span></div></div>
      <nav className="space-y-1">{([['overview','Overview'],['rules','Rules'],['categories','Categories'],['simulator','Simulator'],['activity','Activity'],['settings','Settings']] as [View,string][]).map(([id,label]) => <button key={id} onClick={() => selectView(id)} className={`w-full rounded-xl border-0 px-4 py-3 text-left font-bold ${view === id ? 'bg-[#18283d] text-white' : 'bg-transparent text-[#526071] hover:bg-[#f0f4ed] dark:text-[#c4cfdb] dark:hover:bg-[#1a2838]'}`}>{label}</button>)}</nav>
      <div className="mt-auto rounded-2xl bg-[#eef7e8] p-4 text-[#162235] dark:bg-[#203729] dark:text-[#e8eef5]"><p className="m-0 text-sm font-extrabold">Private by design</p><p className="mb-0 mt-1 text-xs text-[#5d6b7a] dark:text-[#b6c4d3]">Your rules and history stay on this device.</p></div>
    </aside>
    <main className="ml-64 min-h-screen bg-[radial-gradient(circle_at_top_left,#edf7e7,transparent_34%),#f5f7f3] p-8 dark:bg-[radial-gradient(circle_at_top_left,#193324,transparent_34%),#0c1420] lg:p-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-start justify-between"><div><p className="muted mb-1 text-sm font-bold uppercase tracking-[.16em]">Control your digital trail</p><h2 className="m-0 text-3xl font-black capitalize">{view}</h2></div><div className="flex items-center gap-3"><span className={`pill ${settings.enabled ? '' : '!bg-gray-100 !text-gray-600'}`}>{settings.enabled ? 'Protection active' : 'Paused'}</span><button className={`toggle ${settings.enabled ? 'on' : ''}`} onClick={() => updateSettings({ ...settings, enabled: !settings.enabled })} /><ThemeButton theme={settings.theme} onToggle={toggleTheme}/></div></header>
        {notice && <button onClick={() => setNotice("")} className="mb-5 w-full rounded-xl border border-[#cfe3c4] bg-[#eff8ea] p-3 text-left font-semibold text-[#397323]">{notice} · click to dismiss</button>}

        {view === "overview" && <>
          {!settings.onboardingComplete && <section className="card mb-6 overflow-hidden p-7" style={{ background: "#18283d", color: "#ffffff" }}><p className="mb-2 text-xs font-bold uppercase tracking-[.18em]" style={{ color: "#9bd66f" }}>Welcome to Retentia</p><h3 className="m-0 text-2xl font-black" style={{ color: "#ffffff" }}>Give history an expiration date.</h3><p className="max-w-2xl" style={{ color: "#cbd4df" }}>Create rules, preview their effect in the simulator, then let Retentia clean matching URLs automatically.</p><div className="flex gap-3"><button className="rounded-xl border-0 bg-[#82c950] px-4 py-2 font-bold text-[#162235]" onClick={() => setView('rules')}>Create first rule</button><button className="rounded-xl border border-white/30 bg-white/10 px-4 py-2 font-bold" style={{ color: "#ffffff" }} onClick={() => updateSettings({ ...settings, onboardingComplete: true })}>Got it</button></div></section>}
          <section className="grid gap-5 md:grid-cols-3">{[[enabledRules,'Active rules'],[deletedCount,'URLs removed'],[lastScan?.scanned ?? 0,'Last scan size']].map(([value,label]) => <div className="card p-6" key={label}><p className="m-0 text-4xl font-black">{value}</p><p className="muted mb-0 mt-2 font-semibold">{label}</p></div>)}</section>
          <section className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]"><div className="card p-6"><div className="flex items-center justify-between"><h3 className="m-0 text-lg font-extrabold">System status</h3><button className="btn-primary" onClick={() => { setView('simulator'); void simulate(); }}>Run preview</button></div><dl className="mt-5 grid grid-cols-2 gap-4"><div><dt className="muted text-xs font-bold uppercase">Last scan</dt><dd className="ml-0 mt-1 font-bold">{formatDate(lastScan?.runAt)}</dd></div><div><dt className="muted text-xs font-bold uppercase">Schedule</dt><dd className="ml-0 mt-1 font-bold">Every {settings.scanIntervalMinutes} min</dd></div><div><dt className="muted text-xs font-bold uppercase">Matched last scan</dt><dd className="ml-0 mt-1 font-bold">{lastScan?.matched ?? 0}</dd></div><div><dt className="muted text-xs font-bold uppercase">Ready to expire</dt><dd className="ml-0 mt-1 font-bold">{lastScan?.expired ?? 0}</dd></div></dl></div><div className="card p-6"><h3 className="m-0 text-lg font-extrabold">Privacy-safe activity</h3><p className="muted text-sm">Retentia stores removal totals only. Deleted URLs and domains are never written to its activity or scan history.</p><div className="mt-5 text-3xl font-black">{deletedCount}</div><p className="muted mt-1 text-xs font-bold uppercase">Sites removed</p></div></section>
        </>}

        {view === "categories" && <section><div className="card mb-6 flex flex-wrap items-center justify-between gap-4 p-6"><div><h3 className="m-0 text-lg font-extrabold">Local history classifier</h3><p className="muted mb-0 mt-1 max-w-2xl text-sm">Classifies Chrome history locally from known domains, URL structure, and stored page titles. Retentia never opens pages or reads page content. URLs, titles, domains, and scan results are not saved.</p></div><button className="btn-primary" disabled={scanningCategories} onClick={runCategoryScan}>{scanningCategories ? 'Scanning history…' : categoryScan ? 'Scan again' : 'Scan all history'}</button></div>{categoryScan ? <><div className="mb-5 grid gap-4 md:grid-cols-3">{[[categoryScan.scanned,'History URLs scanned'],[categoryScan.categorized,'High-confidence matches'],[categoryScan.uncategorized,'Uncategorized or uncertain']].map(([value,label]) => <div className="card p-5" key={label}><strong className="text-3xl">{value}</strong><p className="muted mb-0 mt-1 text-sm font-semibold">{label}</p></div>)}</div>{categoryScan.resultLimitReached && <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">Chrome returned the one-million-result safety limit. The displayed totals may not include older entries beyond that limit.</div>}<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{categoryScan.buckets.map(bucket => { const preset=getCategoryPreset(bucket.category); const possible=preset ? countSuggestedUrls(categoryScan, preset.id) : 0; return <article className="card p-5" key={bucket.category ?? 'uncategorized'}><div className="flex items-start justify-between gap-3"><div><h3 className="m-0 text-base font-extrabold">{preset?.label ?? 'Uncategorized'}</h3><p className="muted mb-0 mt-1 text-xs">{preset?.description ?? 'No high-confidence local match was found.'}</p></div><span className="pill">{bucket.urls}</span></div><div className="muted mt-4 text-xs font-semibold">{bucket.visits} recorded visits</div>{possible > 0 && <div className="mt-2 text-xs font-bold text-amber-700 dark:text-amber-300">{possible} possible match{possible === 1 ? '' : 'es'} for review</div>}{preset && <div className="mt-3 text-xs font-bold">{preset.deleteImmediately ? 'Suggested deletion: immediately after visit' : `Suggested retention: ${preset.duration} ${preset.unit}`}</div>}</article>})}</div><p className="muted mt-5 text-xs">High-confidence matches may be used by category rules. Possible matches stay uncategorized until you move their domain manually. Closing or refreshing this page discards all scan details.</p></> : <div className="card p-12 text-center"><h3>Nothing has been scanned yet</h3><p className="muted mx-auto max-w-xl">Start a local scan to classify history without opening websites or reading their page content. Every category remains visible, including categories with zero matches.</p></div>}</section>}

        {view === "categories" && <div className="card mb-6 p-6"><h3 className="mt-0 text-lg font-extrabold">Default category rules</h3><p className="muted text-sm">Prepare all built-in categories as disabled rules, or activate them and remove matching history according to each rule's deletion timing. Immediate categories remove every match.</p><div className="flex flex-wrap gap-3"><button className="btn-secondary" onClick={() => void prepareDefaultRules(false)}>Prepare disabled rules</button><button className="btn-danger" onClick={() => void prepareDefaultRules(true)}>Activate and clean matching history</button></div></div>}

        {view === "categories" && categoryScan && <div className="space-y-5">{categoryScan.buckets.filter(bucket => bucket.domains.length > 0).map(bucket => { const preset=getCategoryPreset(bucket.category); return <section className="card overflow-hidden" key={`domains-${bucket.category ?? 'uncategorized'}`}><div className="flex items-center justify-between border-b border-[#e5eae2] p-5 dark:border-[#2b3a4b]"><div><h3 className="m-0 text-base font-extrabold">Move websites from {preset?.label ?? 'Uncategorized'}</h3><p className="muted mb-0 mt-1 text-xs">Only a domain you manually move is saved as a local override. Possible matches are never deleted automatically.</p></div><span className="pill">{bucket.domains.length} domains</span></div><div className="max-h-72 overflow-y-auto">{bucket.domains.map(item => <div className="flex items-center gap-3 border-t border-[#edf0ea] px-5 py-3 first:border-t-0 dark:border-[#29394a]" key={`${item.domain}-${item.suggestedCategory ?? bucket.category ?? 'none'}`}><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{item.domain}</div><div className="muted text-xs">{item.urls} URLs · {item.visits} visits{item.overridden ? ' · custom category' : ''}{item.suggestedCategory ? ` · Possible ${getCategoryPreset(item.suggestedCategory)?.label}` : ''}</div></div><select aria-label={`Category for ${item.domain}`} className="field !w-56" value={item.overridden ? bucket.category ?? '' : 'automatic'} onChange={event => void moveDomain(item.domain, event.target.value === 'automatic' ? undefined : event.target.value as CategoryId)}><option value="automatic">Automatic</option>{CATEGORY_PRESETS.map(option => <option value={option.id} key={option.id}>{option.label}</option>)}</select></div>)}</div></section>})}</div>}

        {view === "categories" && <section className="mt-6"><h3 className="mb-4 text-lg font-extrabold">Manage categories separately</h3><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{CATEGORY_PRESETS.map(preset => { const categoryRule=rules.find(rule => rule.kind === 'category' && rule.pattern === preset.id); const immediate=categoryRule?.deleteImmediately ?? preset.deleteImmediately; return <article className="card p-5" key={`control-${preset.id}`}><div className="flex items-start justify-between gap-3"><div><h4 className="m-0 font-extrabold">{preset.label}</h4><p className="muted mb-0 mt-1 text-xs">{immediate ? 'Remove immediately after visit' : `Keep for ${categoryRule?.duration ?? preset.duration} ${categoryRule?.unit ?? preset.unit}`}</p></div><button aria-label={`Toggle ${preset.label}`} className={`toggle ${categoryRule?.enabled ? 'on' : ''}`} onClick={() => void toggleCategoryRule(preset.id)}/></div><button className="btn-danger mt-4 w-full" onClick={() => void cleanCategory(preset.id)}>{immediate ? 'Activate & clean matching' : 'Activate & clean expired'}</button></article>})}</div></section>}

        {view === "rules" && ruleConflicts.length > 0 && <section className="card mb-6 border-amber-300 bg-amber-50 p-6 dark:border-amber-700 dark:bg-amber-950"><h3 className="mt-0 text-lg font-extrabold">Rule conflicts detected</h3><p className="muted text-sm">Retentia always uses the highest priority. If priorities match, the oldest rule wins.</p><div className="space-y-3">{ruleConflicts.map(conflict => <div className="rounded-xl border border-amber-200 bg-white/70 p-4 text-sm dark:border-amber-800 dark:bg-black/20" key={`${conflict.first.id}-${conflict.second.id}`}><strong>{conflict.first.name}</strong> overlaps <strong>{conflict.second.name}</strong><p className="muted mb-0 mt-1 text-xs">{conflict.reason} Winner: {conflict.winner.name}.</p></div>)}</div></section>}

        {view === "settings" && <section className="card mb-6 max-w-3xl p-7"><h3 className="mt-0 text-lg font-extrabold">Protected websites</h3><p className="muted text-sm">Protected domains and all of their subdomains are skipped by previews, manual deletion, category cleanup, and automatic cleanup.</p><form className="flex gap-3" onSubmit={addProtectedDomain}><input className="field flex-1" value={protectedDraft} onChange={event => setProtectedDraft(event.target.value)} placeholder="bank.example or https://portal.example"/><button className="btn-primary" type="submit">Protect website</button></form><div className="mt-5 space-y-2">{protectedDomains.length ? protectedDomains.map(domain => <div className="flex items-center justify-between rounded-xl border border-[#e5eae2] px-4 py-3 dark:border-[#2b3a4b]" key={domain}><span className="font-bold">{domain}</span><button className="btn-danger" onClick={() => void removeProtectedDomain(domain)}>Remove</button></div>) : <p className="muted text-sm">No websites are protected yet.</p>}</div></section>}

        {view === "settings" && <section className="card mb-6 max-w-3xl p-7"><h3 className="mt-0 text-lg font-extrabold">Backup and restore</h3><p className="muted text-sm">Export rules, settings, category overrides, and protected websites. Passwords, activity totals, scan results, and browser history are never included.</p><div className="flex flex-wrap gap-3"><button className="btn-secondary" onClick={() => void exportBackup()}>Export backup</button><label className="btn-primary cursor-pointer">Restore backup<input className="hidden" type="file" accept="application/json,.json" onChange={event => { void importBackup(event.target.files?.[0]); event.target.value=''; }}/></label></div></section>}

        {view === "rules" && <div className="grid items-start gap-6 xl:grid-cols-[.9fr_1.35fr]">
          <form className="card p-6" onSubmit={saveRule}>
            <h3 className="mt-0 text-lg font-extrabold">{editingId ? 'Edit rule' : 'New rule'}</h3>
            <div className="space-y-4">
              <label><span className="label">Rule name</span><input required className="field" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Sensitive searches" /></label>
              <label><span className="label">Category preset</span><select className="field" value={draft.category ?? ""} onChange={e => applyCategory((e.target.value || undefined) as CategoryId | undefined)}><option value="">Uncategorized</option>{CATEGORY_PRESETS.map(preset => <option value={preset.id} key={preset.id}>{preset.label} · {preset.deleteImmediately ? 'immediate' : `${preset.duration} ${preset.unit}`}</option>)}</select>{draft.category && <span className="muted mt-1 block text-xs">{getCategoryPreset(draft.category)?.description} You can still customize the deletion timing.</span>}</label>
              <label><span className="label">Match type</span><select className="field" value={draft.kind} onChange={e => setDraft({ ...draft, kind: e.target.value as RuleKind })}><option value="domain">Domain</option><option value="exact">Exact URL</option><option value="wildcard">Wildcard</option><option value="regex">Regular expression</option></select></label>
              <label><span className="label">Pattern</span><input required className="field" value={draft.pattern} onChange={e => setDraft({ ...draft, pattern: e.target.value })} onBlur={suggestDraftCategory} placeholder={draft.kind === 'domain' ? 'example.com' : 'https://example.com/*'} /></label>
              <label><span className="label">Deletion timing</span><select className="field" value={draft.deleteImmediately ? 'immediate' : 'retention'} onChange={e => setDraft({ ...draft, deleteImmediately: e.target.value === 'immediate' })}><option value="retention">After a retention period</option><option value="immediate">Immediately after visit</option></select><span className="muted mt-1 block text-xs">Immediate rules remove the URL from history without closing the website.</span></label>
              {!draft.deleteImmediately && <div className="grid grid-cols-2 gap-3"><label><span className="label">Keep for</span><input required min="1" type="number" className="field" value={draft.duration} onChange={e => setDraft({ ...draft, duration: Number(e.target.value) })} /></label><label><span className="label">Unit</span><select className="field" value={draft.unit} onChange={e => setDraft({ ...draft, unit: e.target.value as TimeUnit })}><option value="minutes">Minutes</option><option value="hours">Hours</option><option value="days">Days</option></select></label></div>}
              <label><span className="label">Priority (higher wins)</span><input type="number" className="field" value={draft.priority} onChange={e => setDraft({ ...draft, priority: Number(e.target.value) })} /></label>
              {!editingId && <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#f0cfbd] bg-[#fff7f1] p-4 dark:border-[#694331] dark:bg-[#2a201b]"><input className="mt-1 h-4 w-4 accent-[#a94f1c]" type="checkbox" checked={deleteExisting} onChange={e => setDeleteExisting(e.target.checked)} /><span><strong className="block text-sm">Delete existing matching history now</strong><span className="muted mt-1 block text-xs">Permanently removes every existing URL matched by this rule immediately after creation. You will be asked to confirm.</span></span></label>}
              <div className="flex gap-2"><button className="btn-primary flex-1" type="submit">Save rule</button>{editingId && <button type="button" className="btn-secondary" onClick={() => { setEditingId(undefined); setDraft(EMPTY_RULE); }}>Cancel</button>}</div>
            </div>
          </form>
          <section className="space-y-3">{rules.length === 0 ? <div className="card p-8 text-center"><h3>No rules yet</h3><p className="muted">Add your first retention rule to begin.</p></div> : rules.map(rule => <article className="card flex items-center gap-4 p-5" key={rule.id}><button aria-label={`${rule.enabled ? 'Disable' : 'Enable'} ${rule.name}`} className={`toggle shrink-0 ${rule.enabled?'on':''}`} onClick={() => persistRules(rules.map(item => item.id === rule.id ? {...item,enabled:!item.enabled}:item))}/><div className="min-w-0 flex-1"><h3 className="m-0 truncate text-base font-extrabold">{rule.name}</h3></div><button className="btn-secondary" onClick={() => editRule(rule)}>Edit</button><button className="btn-danger" onClick={() => confirm(`Delete “${rule.name}”?`) && void persistRules(rules.filter(item => item.id !== rule.id))}>Delete</button></article>)}</section>
        </div>}

        {view === "simulator" && <section><div className="card mb-6 flex flex-wrap items-center justify-between gap-4 p-6"><div><h3 className="m-0 text-lg font-extrabold">Dry-run simulator</h3><p className="muted mb-0 mt-1 text-sm">Preview matches without changing browser history.</p></div><div className="flex gap-2"><button className="btn-secondary" disabled={simulating} onClick={simulate}>{simulating?'Scanning…':'Refresh preview'}</button><button className="btn-primary" disabled={simulating || !lastScan?.expired} onClick={runCleanup}>Remove {lastScan?.expired ?? 0} expired</button></div></div>{lastScan ? <><div className="mb-4 grid grid-cols-3 gap-4">{[[lastScan.scanned,'Scanned'],[lastScan.matched,'Matched'],[lastScan.expired,'Expired']].map(([v,l])=><div className="card p-4" key={l}><strong className="text-2xl">{v}</strong><span className="muted ml-2 text-sm">{l}</span></div>)}</div><div className="card overflow-hidden"><table className="w-full border-collapse text-left text-sm"><thead className="bg-[#eef2eb]"><tr><th className="p-4">URL</th><th className="p-4">Rule</th><th className="p-4">Expires</th><th className="p-4">Status</th></tr></thead><tbody>{lastScan.candidates.slice(0,500).map(item=><tr className="border-t border-[#edf0ea]" key={item.url}><td className="max-w-[420px] truncate p-4" title={item.url}>{shortenUrl(item.url)}</td><td className="p-4 font-semibold">{item.rule.name}</td><td className="p-4">{formatDate(item.expiresAt)}</td><td className="p-4"><span className={`pill ${item.expired?'!bg-[#fff0e8] !text-[#a94f1c]':''}`}>{item.expired?'Expired':'Retained'}</span></td></tr>)}</tbody></table>{!lastScan.candidates.length&&<p className="muted p-8 text-center">No matching history items.</p>}</div></>:<div className="card p-12 text-center"><h3>Ready to preview</h3><p className="muted">Run a scan to see exactly what your rules match.</p></div>}</section>}

        {view === "activity" && <section className="card overflow-hidden"><div className="flex items-center justify-between p-6"><div><h3 className="m-0 text-lg font-extrabold">Privacy-safe activity log</h3><p className="muted mb-0 mt-1 text-sm">Stores totals and timestamps only—never deleted URLs or domains.</p></div><button className="btn-danger" onClick={async()=>{if(confirm('Clear the activity log?')){await storage.clearActivity();setActivity([])}}}>Clear log</button></div><div>{activity.length ? activity.map(entry=><article className="flex gap-4 border-t border-[#edf0ea] px-6 py-4" key={entry.id}><div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${entry.type==='error'?'bg-red-500':entry.type==='deleted'?'bg-[#6db33f]':'bg-blue-400'}`}/><div className="min-w-0"><p className="m-0 text-sm font-bold">{entry.message}</p><time className="muted text-xs">{formatDate(entry.timestamp)}</time></div></article>):<p className="muted p-10 text-center">No activity recorded yet.</p>}</div></section>}

        {view === "settings" && <section className="card max-w-3xl p-7"><h3 className="mt-0 text-lg font-extrabold">Protection settings</h3><div className="space-y-6"><div className="flex items-center justify-between"><div><strong>Automatic cleanup</strong><p className="muted m-0 text-sm">Run scans in the background.</p></div><button className={`toggle ${settings.enabled?'on':''}`} onClick={()=>updateSettings({...settings,enabled:!settings.enabled})}/></div><label><span className="label">Scan interval (minutes)</span><input className="field" type="number" min="1" max="1440" value={settings.scanIntervalMinutes} onChange={e=>updateSettings({...settings,scanIntervalMinutes:Number(e.target.value)})}/></label><label><span className="label">History scan window (days)</span><input className="field" type="number" min="1" max="3650" value={settings.historyWindowDays} onChange={e=>updateSettings({...settings,historyWindowDays:Number(e.target.value)})}/></label><label><span className="label">Maximum activity entries</span><input className="field" type="number" min="10" max="5000" value={settings.maxLogEntries} onChange={e=>updateSettings({...settings,maxLogEntries:Number(e.target.value)})}/></label><div className="rounded-xl bg-[#eef7e8] p-4 text-sm dark:bg-[#203729]"><strong>Security scope</strong><p className="muted mb-0">The password lock discourages casual access to Retentia. It cannot protect local data from someone with full access to your Windows account, Chrome profile, or extension developer tools.</p></div></div><ChangePassword/><div className="mt-7 border-t border-[#e5eae2] pt-6 dark:border-[#2b3a4b]"><h4 className="mb-1 mt-0 text-base font-extrabold text-red-700 dark:text-red-300">Forgotten-password reset</h4><p className="muted mt-0 text-sm">Deletes the password, rules, and activity log. Your browser history is never deleted by this reset.</p><button className="btn-danger" onClick={resetProtectedData}>Reset protected Retentia data</button></div></section>}
      </div>
      {passwordReady === false && <PasswordModal mode="setup" onSuccess={() => { setPasswordReady(true); void unlockApplication(); }} />}
      {passwordReady === true && appUnlocked === false && <PasswordModal mode="unlock" onSuccess={unlockApplication} onReset={resetProtectedData} />}
    </main>
  </div>;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><Dashboard /></React.StrictMode>);
