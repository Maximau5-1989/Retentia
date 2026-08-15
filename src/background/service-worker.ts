import { deleteVisitedUrlImmediately, scanHistory } from "../retention/engine";
import { sessionStorage, storage } from "../shared/storage";

const ALARM_NAME = "retentia-scan";
const HISTORY_CONTEXT_MENU_ID = "retentia-history-menu";
const CREATE_RULE_CONTEXT_MENU_ID = "retentia-create-rule-from-history";
const ADD_TO_RULE_CONTEXT_MENU_ID = "retentia-add-to-rule-from-history";

async function configureContextMenu(): Promise<void> {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: HISTORY_CONTEXT_MENU_ID,
    title: "Retentia",
    contexts: ["link"],
    documentUrlPatterns: ["chrome://history/*"],
  });
  chrome.contextMenus.create({
    id: CREATE_RULE_CONTEXT_MENU_ID,
    parentId: HISTORY_CONTEXT_MENU_ID,
    title: "Create new rule",
    contexts: ["link"],
    documentUrlPatterns: ["chrome://history/*"],
  });
  chrome.contextMenus.create({
    id: ADD_TO_RULE_CONTEXT_MENU_ID,
    parentId: HISTORY_CONTEXT_MENU_ID,
    title: "Add to existing rule",
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

chrome.runtime.onInstalled.addListener(async (details) => {
  await storage.sanitizePrivacyData();
  await configureAlarm();
  await configureContextMenu();
  if (details.reason === "install") {
    await chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html?view=overview") });
  }
});
chrome.runtime.onStartup.addListener(configureAlarm);
chrome.contextMenus.onClicked.addListener((info) => {
  if (!info.linkUrl) return;
  const action = info.menuItemId === CREATE_RULE_CONTEXT_MENU_ID
    ? "createRule"
    : info.menuItemId === ADD_TO_RULE_CONTEXT_MENU_ID
      ? "addToRule"
      : undefined;
  if (!action) return;
  const target = new URL(chrome.runtime.getURL("dashboard.html"));
  target.searchParams.set(action, info.linkUrl);
  void chrome.tabs.create({ url: target.href });
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
