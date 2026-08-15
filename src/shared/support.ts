const PAYPAL_ME_HOSTS = new Set(["paypal.me", "www.paypal.me"]);

export function normalizeSupportUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || !PAYPAL_ME_HOSTS.has(url.hostname) || url.pathname === "/") {
    throw new Error("Support links must use a public HTTPS PayPal.Me profile");
  }
  return url.toString();
}

export const SUPPORT_URL = normalizeSupportUrl("https://paypal.me/Maximau5");
