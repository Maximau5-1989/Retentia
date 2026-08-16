import { sessionStorage } from "./storage";
import { webExtension } from "./web-extension";

export type DashboardView = "overview" | "rules" | "categories" | "simulator" | "activity" | "settings";

export async function findDashboardTab(): Promise<chrome.tabs.Tab | undefined> {
  const dashboardUrl = webExtension.runtime.getURL("dashboard.html");
  const registeredTabId = await sessionStorage.getDashboardTabId();

  if (registeredTabId !== undefined) {
    try {
      const registeredTab = await webExtension.tabs.get(registeredTabId);
      if (registeredTab.url?.startsWith(dashboardUrl)) return registeredTab;
    } catch {
      // The registered tab was closed before its session state was updated.
    }
  }

  const tabs = await webExtension.tabs.query({});
  return tabs.find((tab) => tab.url?.startsWith(dashboardUrl));
}

export async function openDashboardTab(parameters: Record<string, string> = {}): Promise<chrome.tabs.Tab | undefined> {
  const target = new URL(webExtension.runtime.getURL("dashboard.html"));
  for (const [key, value] of Object.entries(parameters)) target.searchParams.set(key, value);

  const existing = await findDashboardTab();
  if (existing?.id !== undefined) {
    return webExtension.tabs.update(existing.id, { url: target.href, active: true });
  }
  return webExtension.tabs.create({ url: target.href });
}
