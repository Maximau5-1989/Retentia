import { normalizeHostname } from "../shared/categories";

export function normalizeProtectedDomain(input: string): string | undefined {
  return normalizeHostname(input);
}

export function isProtectedUrl(url: string, protectedDomains: readonly string[]): boolean {
  const hostname = normalizeHostname(url);
  if (!hostname) return false;
  return protectedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}
