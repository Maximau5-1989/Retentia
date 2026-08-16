import { deleteVisitedUrlImmediately, scanHistory } from "../retention/engine";
import { sessionStorage, storage } from "../shared/storage";
import { findDashboardTab, openDashboardTab } from "../shared/dashboard-tabs";
import { recordDiagnostic } from "../shared/diagnostics";
import { isFirefox, webExtension } from "../shared/web-extension";

const ALARM_NAME = "retentia-scan";
const HISTORY_CONTEXT_MENU_ID = "retentia-history-menu";
const CREATE_RULE_CONTEXT_MENU_ID = "retentia-create-rule-from-history";
const ADD_TO_RULE_CONTEXT_MENU_ID = "retentia-add-to-rule-from-history";

function createContextMenu(properties: chrome.contextMenus.CreateProperties): Promise<void> {
  return new Promise((resolve, reject) => {
    webExtension.contextMenus.create(properties, () => {
      const error = webExtension.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

async function configureContextMenu(): Promise<void> {
  if (isFirefox()) return;
  await webExtension.contextMenus.removeAll();
  const browserScope: Pick<chrome.contextMenus.CreateProperties, "contexts" | "documentUrlPatterns"> = {
    contexts: ["link"],
    documentUrlPatterns: ["chrome://history/*"],
  };
  await createContextMenu({
    id: HISTORY_CONTEXT_MENU_ID,
    title: "Retentia",
    ...browserScope,
  });
  await createContextMenu({
    id: CREATE_RULE_CONTEXT_MENU_ID,
    parentId: HISTORY_CONTEXT_MENU_ID,
    title: "Create new rule",
    ...browserScope,
  });
  await createContextMenu({
    id: ADD_TO_RULE_CONTEXT_MENU_ID,
    parentId: HISTORY_CONTEXT_MENU_ID,
    title: "Add to existing rule",
    ...browserScope,
  });
}

async function configureAlarm(): Promise<void> {
  const settings = await storage.getSettings();
  await webExtension.alarms.clear(ALARM_NAME);
  if (settings.enabled) {
    await webExtension.alarms.create(ALARM_NAME, { delayInMinutes: 1, periodInMinutes: Math.max(1, settings.scanIntervalMinutes) });
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
    await recordDiagnostic("background", "automatic-scan-failed", error);
    const settings = await storage.getSettings();
    await storage.addActivity({
      id: crypto.randomUUID(), timestamp: Date.now(), type: "error",
      message: "Automatic history scan failed.",
    }, settings.maxLogEntries);
  }
}

async function deleteImmediatelySafely(url: string, title = ""): Promise<void> {
  try {
    await deleteVisitedUrlImmediately(url, title);
  } catch (error) {
    await recordDiagnostic("background", "immediate-removal-failed", error);
    const settings = await storage.getSettings();
    await storage.addActivity({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: "error",
      message: "Immediate history removal failed.",
    }, settings.maxLogEntries);
  }
}

async function initializeExtension(details: chrome.runtime.InstalledDetails): Promise<void> {
  try {
    await storage.sanitizePrivacyData();
    await configureAlarm();
    await configureContextMenu();
    if (details.reason === "install") {
      await storage.clearPendingChangelogVersion();
      await openDashboardTab({ view: "overview" });
    } else if (details.reason === "update") {
      await storage.setPendingChangelogVersion(webExtension.runtime.getManifest().version);
    }
  } catch (error) {
    await recordDiagnostic("background", "extension-initialization-failed", error);
  }
}

webExtension.runtime.onInstalled.addListener((details) => initializeExtension(details));
webExtension.runtime.onStartup.addListener(() => configureAlarm().catch((error) => recordDiagnostic("background", "alarm-configuration-failed", error)));
if (!isFirefox()) {
  webExtension.contextMenus.onClicked.addListener((info) => {
    if (!info.linkUrl) return;
    const action = info.menuItemId === CREATE_RULE_CONTEXT_MENU_ID
      ? "createRule"
      : info.menuItemId === ADD_TO_RULE_CONTEXT_MENU_ID
        ? "addToRule"
        : undefined;
    if (!action) return;
    return openDashboardTab({ [action]: info.linkUrl });
  });
}
webExtension.tabs.onRemoved.addListener(async (tabId) => {
  if (tabId !== await sessionStorage.getDashboardTabId()) return;
  const remainingDashboard = await findDashboardTab();
  if (remainingDashboard?.id !== undefined) await sessionStorage.setDashboardTabId(remainingDashboard.id);
  else await sessionStorage.lock();
});
webExtension.alarms.onAlarm.addListener((alarm) => alarm.name === ALARM_NAME ? runSafely() : undefined);
webExtension.history.onVisited.addListener((item) => item.url ? deleteImmediatelySafely(item.url, item.title) : undefined);
webExtension.storage.onChanged.addListener((changes) => {
  if (changes.settings) return configureAlarm().catch((error) => recordDiagnostic("background", "alarm-configuration-failed", error));
  return undefined;
});
webExtension.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
