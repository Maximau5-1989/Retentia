import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { PasswordModal } from "../components/PasswordModal";
import { ThemeButton } from "../components/ThemeButton";
import { sessionStorage, storage } from "../shared/storage";
import { deleteHistoryMatchingRule } from "../retention/engine";
import { CATEGORY_PRESETS, getCategoryPreset, suggestCategory } from "../shared/categories";
import { findDashboardTab, openDashboardTab } from "../shared/dashboard-tabs";
import { installWindowDiagnostics } from "../shared/diagnostics";
import type { CategoryId, RetentionRule, ScanResult, Settings, TimeUnit } from "../shared/types";
import "../styles.css";

function Popup() {
  const extensionVersion = chrome.runtime.getManifest().version;
  const [tab, setTab] = useState<chrome.tabs.Tab>();
  const [settings, setSettings] = useState<Settings>();
  const [rules, setRules] = useState<RetentionRule[]>([]);
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [duration, setDuration] = useState(7);
  const [unit, setUnit] = useState<TimeUnit>("days");
  const [saved, setSaved] = useState(false);
  const [passwordReady, setPasswordReady] = useState<boolean | null>(null);
  const [appUnlocked, setAppUnlocked] = useState<boolean | null>(null);
  const [deleteExisting, setDeleteExisting] = useState(false);
  const [deleteImmediately, setDeleteImmediately] = useState(false);
  const [category, setCategory] = useState<CategoryId>();

  useEffect(() => installWindowDiagnostics("popup"), []);

  useEffect(() => {
    void (async () => {
      const [tabs, value, password, unlocked, loadedRules, loadedScan] = await Promise.all([chrome.tabs.query({ active: true, currentWindow: true }), storage.getSettings(), storage.getPassword(), sessionStorage.isUnlocked(), storage.getRules(), storage.getLastScan()]);
      const dashboardSessionActive = unlocked && Boolean(await findDashboardTab());
      if (unlocked && !dashboardSessionActive) await sessionStorage.lock();
      const activeTab = tabs[0];
      setTab(activeTab); setSettings(value); setRules(loadedRules); setLastScan(loadedScan); setPasswordReady(Boolean(password)); setAppUnlocked(dashboardSessionActive);
      if (activeTab?.url) {
        const preset = suggestCategory(activeTab.url, activeTab.title);
        if (preset) { setCategory(preset.id); setDuration(preset.duration); setUnit(preset.unit); setDeleteImmediately(preset.deleteImmediately ?? false); }
      }
    })();
  }, []);

  useEffect(() => {
    if (!saved) return;
    const timeout = window.setTimeout(() => setSaved(false), 3_000);
    return () => window.clearTimeout(timeout);
  }, [saved]);

  useEffect(() => {
    if (!settings) return;
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
  }, [settings?.theme]);

  useEffect(() => {
    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName === "local" && changes.settings?.newValue) setSettings(changes.settings.newValue as Settings);
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  async function addRule() {
    if (!tab?.url || tab.url.startsWith("chrome://")) return;
    const url = new URL(tab.url);
    const rules = await storage.getRules();
    const rule: RetentionRule = {
      id: crypto.randomUUID(), name: url.hostname, kind: "domain", pattern: url.hostname,
      duration, unit, enabled: true, deleteImmediately, priority: 50, category, createdAt: Date.now(),
    };
    await storage.setRules([rule, ...rules]);
    setRules([rule, ...rules]);
    if (deleteExisting) await deleteHistoryMatchingRule(rule);
    setSaved(true);
  }

  async function quickAdd() {
    if (deleteExisting && !confirm("Create this rule and permanently delete all existing history from this domain? This cannot be undone.")) return;
    await addRule();
  }

  async function toggleEnabled() {
    if (!settings) return;
    const next = { ...settings, enabled: !settings.enabled };
    setSettings(next); await storage.setSettings(next);
  }
  async function toggleTheme() {
    if (!settings) return;
    const next = { ...settings, theme: settings.theme === "light" ? "dark" as const : "light" as const };
    setSettings(next); await storage.setSettings(next);
  }
  function selectCategory(id?: CategoryId) {
    setCategory(id);
    const preset = getCategoryPreset(id);
    if (preset) { setDuration(preset.duration); setUnit(preset.unit); setDeleteImmediately(preset.deleteImmediately ?? false); }
  }

  async function openDashboard(view?: "overview" | "rules" | "categories") {
    await sessionStorage.unlock();
    await openDashboardTab({ view: view ?? "overview" });
    window.close();
  }

  const activeRules = rules.filter((rule) => rule.enabled).length;
  const currentHostname = (() => {
    if (!tab?.url) return "Unavailable";
    try { return new URL(tab.url).hostname || "Browser page"; } catch { return "Unavailable"; }
  })();

  return <main className="w-[380px] bg-[#f6f8f4] p-4 dark:bg-[#0c1420]">
    <header className="mb-4 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3"><img src="/icons/icon-48.png" alt="" className="h-10 w-10" /><div className="min-w-0"><div className="flex items-center gap-2"><h1 className="m-0 text-lg font-extrabold">Retentia</h1><span className="pill !px-2 !py-0.5">v{extensionVersion}</span></div><p className="muted m-0 text-xs">History on your terms</p></div></div>
      <ThemeButton theme={settings?.theme ?? "light"} onToggle={toggleTheme}/>
    </header>
    <section className={`mb-3 rounded-2xl border p-4 ${settings?.enabled ? 'border-[#cfe3c4] bg-[#eff8ea] dark:border-[#365b39] dark:bg-[#18301f]' : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950'}`}>
      <div className="flex items-center justify-between gap-3"><div><p className="m-0 text-sm font-extrabold">{settings?.enabled ? 'Protection is active' : 'Protection is paused'}</p><p className="muted mb-0 mt-1 text-xs">{activeRules} active rule{activeRules === 1 ? '' : 's'} · {lastScan ? `${lastScan.matched} matched last scan` : 'No scan yet'}</p></div><button type="button" role="switch" aria-checked={Boolean(settings?.enabled)} aria-label="Toggle automatic protection" className={`toggle shrink-0 ${settings?.enabled ? "on" : ""}`} onClick={toggleEnabled} /></div>
    </section>
    <section className="card p-4">
      <p className="muted mb-1 text-xs font-semibold uppercase tracking-wide">Current website</p>
      <p className="mb-4 mt-0 truncate font-bold" title={currentHostname}>{currentHostname}</p>
      <label><span className="label">Category preset</span><select className="field mb-2" value={category ?? ""} onChange={event => selectCategory((event.target.value || undefined) as CategoryId | undefined)}><option value="">Uncategorized</option>{CATEGORY_PRESETS.map(preset => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</select></label>
      <label><span className="label">Deletion timing</span><select className="field mb-2" value={deleteImmediately ? "immediate" : "retention"} onChange={event => setDeleteImmediately(event.target.value === "immediate")}><option value="retention">After a retention period</option><option value="immediate">Immediately after visit</option></select></label>
      {!deleteImmediately && <div className="grid grid-cols-[1fr_1.3fr] gap-2">
        <label><span className="sr-only">Retention duration</span><input aria-label="Retention duration" className="field" type="number" min="1" value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></label>
        <label><span className="sr-only">Retention unit</span><select aria-label="Retention unit" className="field" value={unit} onChange={(event) => setUnit(event.target.value as TimeUnit)}><option value="minutes">Minutes</option><option value="hours">Hours</option><option value="days">Days</option></select></label>
      </div>}
      <button disabled={saved || currentHostname === "Unavailable" || currentHostname === "Browser page"} className="btn-primary mt-3 w-full" onClick={quickAdd}>{saved ? "Rule added ✓" : deleteImmediately ? "Add immediate rule" : "Add retention rule"}</button>
      <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-[#f0cfbd] bg-[#fff5ee] p-3 text-xs dark:border-[#694331] dark:bg-[#2a201b]"><input className="mt-0.5 accent-[#a94f1c]" type="checkbox" checked={deleteExisting} onChange={event=>setDeleteExisting(event.target.checked)}/><span><strong>Delete existing history now</strong><span className="muted mt-0.5 block">Permanently remove current matches after confirmation.</span></span></label>
      <p className="muted mb-0 text-center text-[11px]">{deleteImmediately ? "Future visits are removed from history without closing the website." : "The timer resets on every new visit."}</p>
    </section>
    <nav aria-label="Dashboard shortcuts" className="mt-3 grid grid-cols-3 gap-2"><button className="btn-secondary !px-2 text-xs" onClick={() => void openDashboard("overview")}>Overview</button><button className="btn-secondary !px-2 text-xs" onClick={() => void openDashboard("rules")}>Rules</button><button className="btn-secondary !px-2 text-xs" onClick={() => void openDashboard("categories")}>Categories</button></nav>
    <p className="muted mb-0 mt-3 text-center text-[10px]">Processed locally. Nothing leaves your browser.</p>
    {passwordReady === false && <PasswordModal mode="setup" onSuccess={() => { setPasswordReady(true); setAppUnlocked(true); }} />}
    {passwordReady === true && appUnlocked === false && <PasswordModal mode="unlock" onSuccess={() => setAppUnlocked(true)} />}
  </main>;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><Popup /></React.StrictMode>);
