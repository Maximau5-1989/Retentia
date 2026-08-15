import { sessionStorage } from "./storage";

export type DashboardView = "overview" | "rules" | "categories" | "simulator" | "activity" | "settings";

export async function findDashboardTab(): Promise<chrome.tabs.Tab | undefined> {
  const dashboardUrl = chrome.runtime.getURL("dashboard.html");
  const registeredTabId = await sessionStorage.getDashboardTabId();

  if (registeredTabId !== undefined) {
    try {
      const registeredTab = await chrome.tabs.get(registeredTabId);
      if (registeredTab.url?.startsWith(dashboardUrl)) return registeredTab;
    } catch {
      // The registered tab was closed before its session state was updated.
    }
  }

  const tabs = await chrome.tabs.query({});
  return tabs.find((tab) => tab.url?.startsWith(dashboardUrl));
}

export async function openDashboardTab(parameters: Record<string, string> = {}): Promise<chrome.tabs.Tab | undefined> {
  const target = new URL(chrome.runtime.getURL("dashboard.html"));
  for (const [key, value] of Object.entries(parameters)) target.searchParams.set(key, value);

  const existing = await findDashboardTab();
  if (existing?.id !== undefined) {
    return chrome.tabs.update(existing.id, { url: target.href, active: true });
  }
  return chrome.tabs.create({ url: target.href });
}
