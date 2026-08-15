export interface ReleaseNotes {
  version: string;
  date: string;
  title: string;
  changes: readonly string[];
}

export const RELEASE_NOTES: readonly ReleaseNotes[] = [
  {
    version: "2.0.0",
    date: "2026-08-15",
    title: "A clearer, safer Retentia",
    changes: [
      "Refined the dashboard and popup with clearer navigation, responsive layouts, and single-tab behavior.",
      "Expanded local category classification with an offline popular-domain database, review panels, and user-controlled corrections.",
      "Simplified new rules to complete domains and specific URLs while preserving existing wildcard and regular-expression rules.",
      "Improved the simulator, protected websites, backups, privacy-safe reporting, and scan-limit guidance.",
      "Hardened rule validation, settings bounds, password handling, activity writes, and dashboard session locking.",
      "Added one-time update notes, a permanent in-app changelog, and a direct What's new link beside the version.",
    ],
  },
  { version: "1.9.1", date: "2026-08-15", title: "User-controlled classifications", changes: ["Added persistent local classifications for every scanned domain, including an uncategorized override for false positives."] },
  { version: "1.9.0", date: "2026-08-15", title: "Offline category database", changes: ["Bundled a privacy-preserving popular-domain database for every category, including 46,021 18+ domains."] },
  { version: "1.8.0", date: "2026-08-15", title: "Stricter classification", changes: ["Expanded category coverage and reduced ambiguous or single-source automatic matches."] },
  { version: "1.7.1", date: "2026-08-08", title: "Privacy policy availability", changes: ["Corrected the public privacy policy URL and documentation links."] },
  { version: "1.7.0", date: "2026-08-07", title: "Consistent interface", changes: ["Synchronized themes, added temporary notifications, grouped simulator results, and improved guidance."] },
  { version: "1.6.4", date: "2026-08-07", title: "Review rejections", changes: ["Added persistent local rejection and restoration controls for uncertain category suggestions."] },
  { version: "1.6.3", date: "2026-08-07", title: "Manual rule targets", changes: ["Enabled users to attach domains and exact URLs to existing built-in and custom rules."] },
  { version: "1.6.2", date: "2026-08-07", title: "Category review and testing", changes: ["Added dedicated possible-match review panels and a temporary password testing mode."] },
  { version: "1.6.1", date: "2026-08-07", title: "Chrome History actions", changes: ["Added nested Chrome History actions for creating a rule or adding a URL to an existing rule."] },
  { version: "1.6.0", date: "2026-08-07", title: "Local classification engine", changes: ["Combined domains, URL structure, and stored page titles without opening websites or sending browsing data."] },
  { version: "1.5.1", date: "2026-08-07", title: "Optional 18+ category", changes: ["Added local recognition, scanner support, overrides, and a disabled immediate-deletion rule for the 18+ category."] },
  { version: "1.5.0", date: "2026-08-07", title: "Immediate deletion", changes: ["Allowed rules and categories to remove matching history immediately after a visit."] },
  { version: "1.4.3", date: "2026-08-07", title: "Clearer category rule names", changes: ["Removed the word default from built-in category rule names and migrated generated names."] },
  { version: "1.4.2", date: "2026-08-07", title: "Built-in category rules", changes: ["Prepared one disabled rule for every built-in category without duplicating existing rules."] },
  { version: "1.4.1", date: "2026-08-07", title: "Chrome preload fix", changes: ["Removed module preload hints that Chrome reported as cross-world resource mismatches."] },
  { version: "1.4.0", date: "2026-08-07", title: "Protection and backups", changes: ["Added protected websites, independent category controls, conflict detection, and privacy-safe backups."] },
  { version: "1.3.0", date: "2026-08-06", title: "Category controls", changes: ["Added ready-to-use category rules, cleanup controls, and local per-domain overrides."] },
  { version: "1.2.0", date: "2026-08-06", title: "History category scanner", changes: ["Added a privacy-safe full-history scanner with aggregate category and visit counts."] },
  { version: "1.1.0", date: "2026-08-06", title: "Category presets", changes: ["Added local presets for social media, shopping, news, streaming, search, travel, and entertainment."] },
  { version: "1.0.9", date: "2026-08-06", title: "Automated checks", changes: ["Added GitHub Actions quality checks for pushes and pull requests."] },
  { version: "1.0.8", date: "2026-08-06", title: "Release workflow", changes: ["Added automated semantic versioning and release preparation."] },
  { version: "1.0.7", date: "2026-08-06", title: "Privacy-safe activity", changes: ["Replaced URL-level activity details with aggregate removal totals and corrected light-mode contrast."] },
  { version: "1.0.6", date: "2026-08-06", title: "Shared password session", changes: ["Protected the complete interface with a tab-lifetime session and corrected dark-mode sidebar contrast."] },
  { version: "1.0.5", date: "2026-08-06", title: "Interface corrections", changes: ["Fixed warning contrast, synchronized the displayed version, and simplified rule cards."] },
  { version: "1.0.4", date: "2026-08-06", title: "History context menu", changes: ["Added secure rule creation directly from Chrome History's context menu."] },
  { version: "1.0.3", date: "2026-08-06", title: "Clean while creating", changes: ["Added optional immediate cleanup of existing history when creating a rule."] },
  { version: "1.0.2", date: "2026-08-06", title: "Authentication hardening", changes: ["Added session limits, failed-attempt delays, password changes, reset behavior, and security guidance."] },
  { version: "1.0.1", date: "2026-08-06", title: "First complete release", changes: ["Introduced retention rules, scheduled cleanup, simulator, dashboard, themes, activity totals, and password protection."] },
];

export function getReleaseNotes(version: string | null | undefined): ReleaseNotes | undefined {
  return RELEASE_NOTES.find((release) => release.version === version);
}
