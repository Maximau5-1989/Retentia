import { storage } from "./storage";
import type { DiagnosticCode, DiagnosticEntry, DiagnosticSource } from "./types";

interface DiagnosticLocation {
  filename?: string;
  line?: number;
  column?: number;
}

function safeIdentifier(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const sanitized = value.replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 80);
  return sanitized || fallback;
}

function safeBasename(filename: string | undefined): string | undefined {
  if (!filename) return undefined;
  try {
    const pathname = new URL(filename).pathname;
    return safeIdentifier(pathname.split("/").pop(), "unknown");
  } catch {
    return safeIdentifier(filename.split(/[\\/]/).pop(), "unknown");
  }
}

function safePosition(value: number | undefined): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

const DIAGNOSTIC_CODES = new Set<DiagnosticCode>([
  "alarm-configuration-failed",
  "automatic-scan-failed",
  "extension-initialization-failed",
  "immediate-removal-failed",
  "uncaught-error",
  "unhandled-promise-rejection",
  "unexpected-error",
]);

function safeDiagnosticCode(value: string): DiagnosticCode {
  return DIAGNOSTIC_CODES.has(value as DiagnosticCode) ? value as DiagnosticCode : "unexpected-error";
}

export function createDiagnosticEntry(
  source: DiagnosticSource,
  code: string,
  error?: unknown,
  location: DiagnosticLocation = {},
): DiagnosticEntry {
  const errorName = error instanceof Error ? safeIdentifier(error.name, "Error") : undefined;
  const file = safeBasename(location.filename);
  const line = safePosition(location.line);
  const column = safePosition(location.column);
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    source,
    code: safeDiagnosticCode(code),
    appVersion: chrome.runtime.getManifest().version,
    ...(errorName ? { errorName } : {}),
    ...(file ? { file } : {}),
    ...(line ? { line } : {}),
    ...(column ? { column } : {}),
  };
}

export async function recordDiagnostic(
  source: DiagnosticSource,
  code: string,
  error?: unknown,
  location?: DiagnosticLocation,
): Promise<void> {
  try {
    await storage.addDiagnostic(createDiagnosticEntry(source, code, error, location));
  } catch {
    // Diagnostics must never interfere with Retentia's core behavior.
  }
}

export function installWindowDiagnostics(source: Exclude<DiagnosticSource, "background">): () => void {
  const handleError = (event: ErrorEvent) => {
    void recordDiagnostic(source, "uncaught-error", event.error, {
      filename: event.filename,
      line: event.lineno,
      column: event.colno,
    });
  };
  const handleRejection = (event: PromiseRejectionEvent) => {
    void recordDiagnostic(source, "unhandled-promise-rejection", event.reason);
  };
  window.addEventListener("error", handleError);
  window.addEventListener("unhandledrejection", handleRejection);
  return () => {
    window.removeEventListener("error", handleError);
    window.removeEventListener("unhandledrejection", handleRejection);
  };
}
