interface WebExtensionGlobals {
  browser?: typeof chrome;
  chrome?: typeof chrome;
}

export function resolveWebExtensionApi(scope: WebExtensionGlobals = globalThis as WebExtensionGlobals): typeof chrome {
  const api = isFirefox(scope) && scope.browser ? scope.browser : scope.chrome ?? scope.browser;
  if (!api) throw new Error("The WebExtension API is unavailable");
  return api;
}

export function isFirefox(scope: WebExtensionGlobals = globalThis as WebExtensionGlobals): boolean {
  const api = scope.browser ?? scope.chrome;
  try {
    return api?.runtime.getURL("").startsWith("moz-extension://") ?? false;
  } catch {
    return false;
  }
}

export const webExtension = new Proxy({} as typeof chrome, {
  get(_target, property) {
    return Reflect.get(resolveWebExtensionApi(), property);
  },
});
