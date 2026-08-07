import { deleteVisitedUrlImmediately, scanHistory } from "../retention/engine";
import { sessionStorage, storage } from "../shared/storage";

const ALARM_NAME = "retentia-scan";
const HISTORY_CONTEXT_MENU_ID = "retentia-create-rule-from-history";

async function configureContextMenu(): Promise<void> {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: HISTORY_CONTEXT_MENU_ID,
    title: "Create Retentia rule",
    contexts: ["link"],
    documentUrlPatterns: ["chrome://history/*"],
  });
}

async function configureAlarm(): Promise<void> {
  const settings = await storage.getSettings();
  await chrome.alarms.clear(ALARM_NAME);
  if (settings.enabled) {
    chrome.alarms.create(ALARM_NAME, { delayInMinutes: 1, periodInMinutes: Math.max(1, settings.scanIntervalMinutes) });
  }
}

async function runSafely(): Promise<void> {
  try {
    const settings = await storage.getSettings();
    const result = await scanHistory(true);
    await storage.addActivity({
      id: crypto.randomUUID(), timestamp: Date.now(), type: "scan",
      message: `Scan complete: ${result.scanned} checked, ${result.deleted} removed.`,
    }, settings.maxLogEntries);
  } catch (error) {
    const settings = await storage.getSettings();
    await storage.addActivity({
      id: crypto.randomUUID(), timestamp: Date.now(), type: "error",
      message: error instanceof Error ? error.message : "Unknown scan error",
    }, settings.maxLogEntries);
  }
}

async function deleteImmediatelySafely(url: string, title = ""): Promise<void> {
  try {
    await deleteVisitedUrlImmediately(url, title);
  } catch {
    const settings = await storage.getSettings();
    await storage.addActivity({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: "error",
      message: "Immediate history removal failed.",
    }, settings.maxLogEntries);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await storage.sanitizePrivacyData();
  await configureAlarm();
  await configureContextMenu();
  chrome.runtime.openOptionsPage();
});
chrome.runtime.onStartup.addListener(configureAlarm);
chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== HISTORY_CONTEXT_MENU_ID || !info.linkUrl) return;
  const target = chrome.runtime.getURL(`dashboard.html?createRule=${encodeURIComponent(info.linkUrl)}`);
  void chrome.tabs.create({ url: target });
});
chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (tabId === await sessionStorage.getDashboardTabId()) await sessionStorage.lock();
});
chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === ALARM_NAME) void runSafely(); });
chrome.history.onVisited.addListener((item) => { if (item.url) void deleteImmediatelySafely(item.url, item.title); });
chrome.storage.onChanged.addListener((changes) => { if (changes.settings) void configureAlarm(); });
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "REGISTER_DASHBOARD_TAB" && _sender.tab?.id !== undefined) {
    void sessionStorage.setDashboardTabId(_sender.tab.id).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "RUN_SCAN") {
    runSafely().then(() => sendResponse({ ok: true })).catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
  return false;
});
