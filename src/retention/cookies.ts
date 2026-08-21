import type { HistoryCandidate, RetentionRule } from "../shared/types";
import { isFirefox, webExtension } from "../shared/web-extension";

export function cookieDomainForRule(rule: Pick<RetentionRule, "kind" | "pattern">): string | null {
  if (rule.kind === "domain") return rule.pattern.replace(/^\.+/, "").toLowerCase();
  if (rule.kind !== "exact") return null;
  try { return new URL(rule.pattern).hostname.toLowerCase(); } catch { return null; }
}

export function cookiePermissionOrigin(rule: Pick<RetentionRule, "kind" | "pattern">): string | null {
  const domain = cookieDomainForRule(rule);
  return domain ? `*://*.${domain}/*` : null;
}

export async function requestCookiePermissionForRule(rule: Pick<RetentionRule, "kind" | "pattern">): Promise<boolean> {
  if (!isFirefox()) return false;
  const origin = cookiePermissionOrigin(rule);
  if (!origin) return false;
  return webExtension.permissions.request({ permissions: ["cookies"], origins: [origin] });
}

export async function countCookiesForRule(rule: Pick<RetentionRule, "kind" | "pattern" | "deleteCookiesOnExpiry">): Promise<number | null> {
  if (!isFirefox() || !rule.deleteCookiesOnExpiry || !webExtension.cookies) return null;
  const domain = cookieDomainForRule(rule);
  if (!domain) return null;
  try {
    const origin = cookiePermissionOrigin(rule);
    if (!origin || !await webExtension.permissions.contains({ permissions: ["cookies"], origins: [origin] })) return null;
    return (await webExtension.cookies.getAll({ domain })).length;
  } catch {
    return null;
  }
}

function cookieRemovalUrl(cookie: chrome.cookies.Cookie): string {
  const host = cookie.domain.replace(/^\./, "");
  return `${cookie.secure ? "https" : "http"}://${host}${cookie.path || "/"}`;
}

export async function deleteCookiesForExpiredCandidates(candidates: HistoryCandidate[]): Promise<number> {
  if (!isFirefox() || !webExtension.cookies) return 0;
  const targets = new Map<string, RetentionRule>();
  for (const candidate of candidates) {
    if (!candidate.rule.deleteCookiesOnExpiry) continue;
    try { targets.set(new URL(candidate.url).hostname.toLowerCase(), candidate.rule); } catch { /* Invalid history URLs are ignored. */ }
  }

  let deleted = 0;
  for (const [hostname] of targets) {
    try {
      const cookies = await webExtension.cookies.getAll({ domain: hostname });
      for (const cookie of cookies) {
        const details: chrome.cookies.CookieDetails = { url: cookieRemovalUrl(cookie), name: cookie.name };
        if (cookie.storeId) details.storeId = cookie.storeId;
        if (await webExtension.cookies.remove(details)) deleted += 1;
      }
    } catch {
      // Missing/revoked optional permission must never interrupt history cleanup.
    }
  }
  return deleted;
}
