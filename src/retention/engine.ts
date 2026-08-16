import { storage } from "../shared/storage";
import { categorizeHistoryEntries } from "../shared/categories";
import type { CategoryScanResult, HistoryCandidate, RetentionRule, ScanResult } from "../shared/types";
import { isFirefox, webExtension } from "../shared/web-extension";
import { findWinningRule, getExpirationTime, matchesRule } from "./matcher";
import { isProtectedUrl } from "./protection";

const AUTOMATIC_SCAN_LIMIT = 100_000;
const MANUAL_SCAN_LIMIT = 1_000_000;

function categoryScanLimit(): number {
  // Firefox buffers history.search results before resolving the promise. Keeping
  // its interactive dashboard scan aligned with Retentia's automatic safety
  // limit avoids a large profile freezing the page or exhausting memory.
  return isFirefox() ? AUTOMATIC_SCAN_LIMIT : MANUAL_SCAN_LIMIT;
}

export async function scanHistoryCategories(): Promise<CategoryScanResult> {
  const limit = categoryScanLimit();
  const [history, overrides, rejections] = await Promise.all([webExtension.history.search({ text: "", startTime: 0, maxResults: limit }), storage.getCategoryOverrides(), storage.getCategoryRejections()]);
  const buckets = categorizeHistoryEntries(history, overrides, rejections);
  const categorized = buckets.filter((bucket) => bucket.category).reduce((total, bucket) => total + bucket.urls, 0);
  const uncategorized = buckets.find((bucket) => !bucket.category)?.urls ?? 0;
  return {
    scanned: history.filter((item) => item.url).length,
    categorized,
    uncategorized,
    buckets,
    runAt: Date.now(),
    resultLimitReached: history.length === limit,
  };
}

export async function deleteHistoryMatchingRule(rule: RetentionRule): Promise<number> {
  const [settings, overrides, protectedDomains] = await Promise.all([storage.getSettings(), storage.getCategoryOverrides(), storage.getProtectedDomains()]);
  const history = await webExtension.history.search({ text: "", startTime: 0, maxResults: MANUAL_SCAN_LIMIT });
  const matchingUrls = [...new Set(history.flatMap((item) => item.url && !isProtectedUrl(item.url, protectedDomains) && matchesRule({ url: item.url, title: item.title }, rule, overrides) ? [item.url] : []))];
  for (const url of matchingUrls) {
    await webExtension.history.deleteUrl({ url });
  }
  if (matchingUrls.length) await storage.addActivity({
    id: crypto.randomUUID(), timestamp: Date.now(), type: "deleted", count: matchingUrls.length,
    message: `${matchingUrls.length} history URL${matchingUrls.length === 1 ? "" : "s"} removed when a rule was created`,
  }, settings.maxLogEntries);
  return matchingUrls.length;
}

export async function scanHistory(deleteExpired = false, forceDelete = false): Promise<ScanResult> {
  const [rules, settings, overrides, protectedDomains] = await Promise.all([storage.getRules(), storage.getSettings(), storage.getCategoryOverrides(), storage.getProtectedDomains()]);
  const runAt = Date.now();
  const history = await webExtension.history.search({ text: "", startTime: runAt - settings.historyWindowDays * 86_400_000, maxResults: AUTOMATIC_SCAN_LIMIT });
  const candidates: HistoryCandidate[] = [];

  for (const item of history) {
    if (!item.url || !item.lastVisitTime || isProtectedUrl(item.url, protectedDomains)) continue;
    const rule = findWinningRule({ url: item.url, title: item.title }, rules, overrides);
    if (!rule) continue;
    const expiresAt = getExpirationTime(item.lastVisitTime, rule);
    candidates.push({
      url: item.url,
      title: item.title || item.url,
      lastVisitTime: item.lastVisitTime,
      visitCount: item.visitCount || 0,
      rule,
      expiresAt,
      expired: expiresAt <= runAt,
    });
  }

  const expired = candidates.filter((candidate) => candidate.expired);
  let deleted = 0;
  if (deleteExpired && (settings.enabled || forceDelete)) {
    for (const candidate of expired) {
      await webExtension.history.deleteUrl({ url: candidate.url });
      deleted += 1;
    }
    if (deleted) await storage.addActivity({
      id: crypto.randomUUID(), timestamp: Date.now(), type: "deleted", count: deleted,
      message: `${deleted} history URL${deleted === 1 ? "" : "s"} removed by retention rules`,
    }, settings.maxLogEntries);
  }

  const result: ScanResult = {
    scanned: history.length, matched: candidates.length, expired: expired.length, deleted,
    candidates: candidates.sort((a, b) => a.expiresAt - b.expiresAt), runAt,
    resultLimitReached: history.length === AUTOMATIC_SCAN_LIMIT,
  };
  await storage.setLastScan(result);
  return result;
}

export async function cleanExpiredForRule(rule: RetentionRule): Promise<number> {
  const [settings, overrides, protectedDomains] = await Promise.all([storage.getSettings(), storage.getCategoryOverrides(), storage.getProtectedDomains()]);
  const now = Date.now();
  const history = await webExtension.history.search({ text: "", startTime: 0, maxResults: MANUAL_SCAN_LIMIT });
  const expiredUrls = [...new Set(history.flatMap((item) => {
    if (!item.url || !item.lastVisitTime || isProtectedUrl(item.url, protectedDomains) || !matchesRule({ url: item.url, title: item.title }, rule, overrides)) return [];
    return getExpirationTime(item.lastVisitTime, rule) <= now ? [item.url] : [];
  }))];
  for (const url of expiredUrls) await webExtension.history.deleteUrl({ url });
  if (expiredUrls.length) await storage.addActivity({
    id: crypto.randomUUID(), timestamp: now, type: "deleted", count: expiredUrls.length,
    message: `${expiredUrls.length} history URL${expiredUrls.length === 1 ? "" : "s"} removed by a category rule`,
  }, settings.maxLogEntries);
  return expiredUrls.length;
}

export async function deleteVisitedUrlImmediately(url: string, title = ""): Promise<boolean> {
  const [rules, settings, overrides, protectedDomains] = await Promise.all([
    storage.getRules(),
    storage.getSettings(),
    storage.getCategoryOverrides(),
    storage.getProtectedDomains(),
  ]);
  if (!settings.enabled || isProtectedUrl(url, protectedDomains)) return false;

  const rule = findWinningRule({ url, title }, rules, overrides);
  if (!rule?.deleteImmediately) return false;

  await webExtension.history.deleteUrl({ url });
  await storage.addActivity({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    type: "deleted",
    count: 1,
    message: "1 history URL removed immediately by a rule",
  }, settings.maxLogEntries);
  return true;
}
