import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { PasswordModal } from "../components/PasswordModal";
import { ThemeButton } from "../components/ThemeButton";
import { sessionStorage, storage } from "../shared/storage";
import { deleteHistoryMatchingRule } from "../retention/engine";
import type { RetentionRule, Settings, TimeUnit } from "../shared/types";
import "../styles.css";

function Popup() {
  const [tab, setTab] = useState<chrome.tabs.Tab>();
  const [settings, setSettings] = useState<Settings>();
  const [duration, setDuration] = useState(7);
  const [unit, setUnit] = useState<TimeUnit>("days");
  const [saved, setSaved] = useState(false);
  const [passwordReady, setPasswordReady] = useState<boolean | null>(null);
  const [appUnlocked, setAppUnlocked] = useState<boolean | null>(null);
  const [deleteExisting, setDeleteExisting] = useState(false);

  useEffect(() => {
    void Promise.all([chrome.tabs.query({ active: true, currentWindow: true }), storage.getSettings(), storage.getPassword(), sessionStorage.isUnlocked()]).then(([tabs, value, password, unlocked]) => {
      setTab(tabs[0]); setSettings(value); setPasswordReady(Boolean(password)); setAppUnlocked(unlocked);
    });
  }, []);

  useEffect(() => {
    if (!settings) return;
    document.documentElement.classList.toggle("dark", settings.theme === "dark");
  }, [settings?.theme]);

  async function addRule() {
    if (!tab?.url || tab.url.startsWith("chrome://")) return;
    const url = new URL(tab.url);
    const rules = await storage.getRules();
    const rule: RetentionRule = {
      id: crypto.randomUUID(), name: url.hostname, kind: "domain", pattern: url.hostname,
      duration, unit, enabled: true, priority: 50, createdAt: Date.now(),
    };
    await storage.setRules([rule, ...rules]);
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

  return <main className="w-[360px] bg-[#f6f8f4] p-4 dark:bg-[#0c1420]">
    <header className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-3"><img src="/icons/icon-48.png" className="h-10 w-10" /><div><h1 className="m-0 text-lg font-extrabold">Retentia</h1><p className="muted m-0 text-xs">History on your terms</p></div></div>
      <div className="flex items-center gap-2"><button aria-label="Toggle Retentia" className={`toggle ${settings?.enabled ? "on" : ""}`} onClick={toggleEnabled} />{settings && <ThemeButton theme={settings.theme} onToggle={toggleTheme}/>}</div>
    </header>
    <section className="card p-4">
      <p className="muted mb-1 text-xs font-semibold uppercase tracking-wide">Current website</p>
      <p className="mb-4 mt-0 truncate font-bold">{tab?.url ? new URL(tab.url).hostname : "Unavailable"}</p>
      <div className="grid grid-cols-[1fr_1.3fr] gap-2">
        <input className="field" type="number" min="1" value={duration} onChange={(event) => setDuration(Number(event.target.value))} />
        <select className="field" value={unit} onChange={(event) => setUnit(event.target.value as TimeUnit)}><option value="minutes">Minutes</option><option value="hours">Hours</option><option value="days">Days</option></select>
      </div>
      <button className="btn-primary mt-3 w-full" onClick={quickAdd}>{saved ? "Rule added ✓" : "Add retention rule"}</button>
      <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg bg-[#fff5ee] p-3 text-xs dark:bg-[#2a201b]"><input className="mt-0.5 accent-[#a94f1c]" type="checkbox" checked={deleteExisting} onChange={event=>setDeleteExisting(event.target.checked)}/><span><strong>Delete existing history now</strong><span className="muted mt-0.5 block">Permanently remove current matches after password confirmation.</span></span></label>
      <p className="muted mb-0 text-center text-[11px]">The timer resets on every new visit.</p>
    </section>
    <button className="btn-secondary mt-3 w-full" onClick={() => chrome.runtime.openOptionsPage()}>Open dashboard</button>
    <p className="muted mb-0 mt-3 text-center text-[10px]">Processed locally. Nothing leaves your browser.</p>
    {passwordReady === false && <PasswordModal mode="setup" onSuccess={() => { setPasswordReady(true); void sessionStorage.unlock().then(() => setAppUnlocked(true)); }} />}
    {passwordReady === true && appUnlocked === false && <PasswordModal mode="unlock" onSuccess={() => { void sessionStorage.unlock().then(() => setAppUnlocked(true)); }} />}
  </main>;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><Popup /></React.StrictMode>);
