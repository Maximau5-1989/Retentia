import { storage } from "../shared/storage";
import { categorizeHistoryEntries } from "../shared/categories";
import type { CategoryScanResult, HistoryCandidate, RetentionRule, ScanResult } from "../shared/types";
import { durationToMs, findWinningRule, matchesRule } from "./matcher";

const CATEGORY_SCAN_LIMIT = 1_000_000;

export async function scanHistoryCategories(): Promise<CategoryScanResult> {
  const [history, overrides] = await Promise.all([chrome.history.search({ text: "", startTime: 0, maxResults: CATEGORY_SCAN_LIMIT }), storage.getCategoryOverrides()]);
  const buckets = categorizeHistoryEntries(history, overrides);
  const categorized = buckets.filter((bucket) => bucket.category).reduce((total, bucket) => total + bucket.urls, 0);
  const uncategorized = buckets.find((bucket) => !bucket.category)?.urls ?? 0;
  return {
    scanned: history.filter((item) => item.url).length,
    categorized,
    uncategorized,
    buckets,
    runAt: Date.now(),
    resultLimitReached: history.length === CATEGORY_SCAN_LIMIT,
  };
}

export async function deleteHistoryMatchingRule(rule: RetentionRule): Promise<number> {
  const [settings, overrides] = await Promise.all([storage.getSettings(), storage.getCategoryOverrides()]);
  const history = await chrome.history.search({ text: "", startTime: 0, maxResults: 100_000 });
  const matchingUrls = [...new Set(history.flatMap((item) => item.url && matchesRule(item.url, rule, overrides) ? [item.url] : []))];
  for (const url of matchingUrls) {
    await chrome.history.deleteUrl({ url });
  }
  if (matchingUrls.length) await storage.addActivity({
    id: crypto.randomUUID(), timestamp: Date.now(), type: "deleted", count: matchingUrls.length,
    message: `${matchingUrls.length} site${matchingUrls.length === 1 ? "" : "s"} removed when a rule was created`,
  }, settings.maxLogEntries);
  return matchingUrls.length;
}

export async function scanHistory(deleteExpired = false, forceDelete = false): Promise<ScanResult> {
  const [rules, settings, overrides] = await Promise.all([storage.getRules(), storage.getSettings(), storage.getCategoryOverrides()]);
  const runAt = Date.now();
  const history = await chrome.history.search({ text: "", startTime: runAt - settings.historyWindowDays * 86_400_000, maxResults: 100_000 });
  const candidates: HistoryCandidate[] = [];

  for (const item of history) {
    if (!item.url || !item.lastVisitTime) continue;
    const rule = findWinningRule(item.url, rules, overrides);
    if (!rule) continue;
    const expiresAt = item.lastVisitTime + durationToMs(rule);
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
      await chrome.history.deleteUrl({ url: candidate.url });
      deleted += 1;
    }
    if (deleted) await storage.addActivity({
      id: crypto.randomUUID(), timestamp: Date.now(), type: "deleted", count: deleted,
      message: `${deleted} site${deleted === 1 ? "" : "s"} removed by retention rules`,
    }, settings.maxLogEntries);
  }

  const result: ScanResult = {
    scanned: history.length, matched: candidates.length, expired: expired.length, deleted,
    candidates: candidates.sort((a, b) => a.expiresAt - b.expiresAt), runAt,
  };
  await storage.setLastScan(result);
  return result;
}
