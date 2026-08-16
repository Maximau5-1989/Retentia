export type BrowserTarget = "chrome" | "firefox";

export interface ReleaseNotes {
  version: string;
  date: string;
  title: string;
  changes: readonly string[];
}
